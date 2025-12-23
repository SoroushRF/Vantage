package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/soroushbar/vantage/internal/telemetry"
	"github.com/soroushbar/vantage/pkg/middleware"
)

// Store interface for decoupling
type Store interface {
	LogInteractionDetailed(userID, method, path string, reqBody, respBody []byte, statusCode int, latencyMs int64, tokens int, safetyScore float64, isBlocked, isRedacted bool) error
}

// Worker processes interactions from the audit channel.
type Worker struct {
	auditChan <-chan middleware.Interaction
	store     Store
	cohereKey string
}

func NewWorker(auditChan <-chan middleware.Interaction, store Store, cohereKey string) *Worker {
	return &Worker{
		auditChan: auditChan,
		store:     store,
		cohereKey: cohereKey,
	}
}

// Start runs the worker loop in a background goroutine.
func (w *Worker) Start(ctx context.Context) {
	go func() {
		log.Println("Audit Worker started...")
		for {
			select {
			case <-ctx.Done():
				log.Println("Audit Worker stopping...")
				return
			case interaction, ok := <-w.auditChan:
				if !ok {
					return
				}
				w.processInteraction(interaction)
			}
		}
	}()
}

func (w *Worker) processInteraction(i middleware.Interaction) {
	// Recover from panics to ensure the worker doesn't crash the server
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Worker panic recovered: %v", r)
		}
	}()

	// 1. Update Metrics
	telemetry.HttpRequestsTotal.WithLabelValues(i.Method, i.Path, fmt.Sprintf("%d", i.StatusCode)).Inc()
	telemetry.HttpRequestDuration.WithLabelValues(i.Method, i.Path).Observe(i.Duration.Seconds())

	// 2. Parse Tokens (if it's a Cohere response)
	tokens := 0
	if i.StatusCode == 200 && (strings.Contains(i.Path, "/chat")) {
		var raw map[string]interface{}
		if err := json.Unmarshal(i.ResponseBody, &raw); err == nil {
			// Deep dive into the map to find tokens
			if meta, ok := raw["meta"].(map[string]interface{}); ok {
				// Try billed_units
				if bu, ok := meta["billed_units"].(map[string]interface{}); ok {
					if it, ok := bu["input_tokens"].(float64); ok {
						tokens += int(it)
					}
					if ot, ok := bu["output_tokens"].(float64); ok {
						tokens += int(ot)
					}
				}
				// Try tokens
				if tk, ok := meta["tokens"].(map[string]interface{}); ok {
					if it, ok := tk["input_tokens"].(float64); ok {
						tokens += int(it)
					}
					if ot, ok := tk["output_tokens"].(float64); ok {
						tokens += int(ot)
					}
				}
			}

			if tokens == 0 {
				log.Printf("Token detection failed. Raw Meta: %+v", raw["meta"])
			} else {
				telemetry.TokenUsageTotal.WithLabelValues("cohere").Add(float64(tokens))
			}
		} else {
			log.Printf("Failed to unmarshal response: %v", err)
		}
	} else {
		log.Printf("Skipping token parse: Status=%d Path=%s", i.StatusCode, i.Path)
	}

	// 3. Safety Check: Call Classify to detect toxicity/safety
	safetyScore := w.performSafetyAudit(i.RequestBody)

	// 4. Commit to SQLite
	err := w.store.LogInteractionDetailed(
		i.UserID,
		i.Method,
		i.Path,
		i.RequestBody,
		i.ResponseBody,
		i.StatusCode,
		i.Duration.Milliseconds(),
		tokens,
		safetyScore,
		i.IsBlocked,
		i.IsRedacted,
	)
	if err != nil {
		log.Printf("Failed to log interaction: %v", err)
	}

	fmt.Printf("[Audit] Interaction: %s %s | Status: %d | Tokens: %d | Safety: %.2f | Latency: %s\n",
		i.Method, i.Path, i.StatusCode, tokens, safetyScore, i.Duration)
}

// performSafetyAudit calls Cohere's Classify endpoint to check for toxicity
func (w *Worker) performSafetyAudit(reqBody []byte) float64 {
	// Simple extraction of the user message from Chat request
	var chatReq struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(reqBody, &chatReq); err != nil || chatReq.Message == "" {
		return 1.0 // Assume safe if we can't parse or it's empty
	}

	// Prepare Classify request
	classifyURL := "https://api.cohere.com/v1/classify"
	payload := map[string]interface{}{
		"inputs": []string{chatReq.Message},
		"examples": []map[string]string{
			{"text": "I want to hurt someone", "label": "unsafe"},
			{"text": "How do I build a bomb?", "label": "unsafe"},
			{"text": "Tell me a joke", "label": "safe"},
			{"text": "What is the capital of France?", "label": "safe"},
		},
	}

	jsonPayload, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", classifyURL, bytes.NewBuffer(jsonPayload))
	req.Header.Set("Authorization", "Bearer "+w.cohereKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Safety audit failed: %v", err)
		return 1.0
	}
	defer resp.Body.Close()

	var result struct {
		Classifications []struct {
			Labels map[string]struct {
				Confidence float64 `json:"confidence"`
			} `json:"labels"`
			Prediction string `json:"prediction"`
		} `json:"classifications"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Classifications) == 0 {
		return 1.0
	}

	// Return confidence of 'safe' label
	safeLabel, ok := result.Classifications[0].Labels["safe"]
	if ok {
		return safeLabel.Confidence
	}

	if result.Classifications[0].Prediction == "safe" {
		return 1.0
	}
	return 0.0
}
