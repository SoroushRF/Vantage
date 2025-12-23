package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
)

var (
	emailRegex = regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	phoneRegex = regexp.MustCompile(`(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}`)
	uuidRegex  = regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)
)

// GovernanceMiddleware handles PII redaction and forbidden keywords.
func GovernanceMiddleware(forbiddenKeywords []string, redactionEnabled bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost || r.Body == nil {
				next.ServeHTTP(w, r)
				return
			}

			body, _ := io.ReadAll(r.Body)
			bodyStr := string(body)

			// 1. Rule Engine: Forbidden Keywords
			for _, kw := range forbiddenKeywords {
				if strings.Contains(strings.ToLower(bodyStr), strings.ToLower(kw)) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					json.NewEncoder(w).Encode(map[string]string{
						"error": "Security Policy Violation",
						"code":  "FORBIDDEN_CONTENT",
					})

					// Set header for AuditMiddleware to pick up
					w.Header().Set("X-Vantage-Blocked", "true")
					return
				}
			}

			// 2. PII Redactor
			isRedacted := false
			if redactionEnabled {
				original := bodyStr
				bodyStr = emailRegex.ReplaceAllString(bodyStr, "[REDACTED_EMAIL]")
				bodyStr = phoneRegex.ReplaceAllString(bodyStr, "[REDACTED_PHONE]")
				bodyStr = uuidRegex.ReplaceAllString(bodyStr, "[REDACTED_UUID]")

				if bodyStr != original {
					isRedacted = true
					body = []byte(bodyStr)
				}
			}

			// Restore body
			r.Body = io.NopCloser(bytes.NewBuffer(body))

			// Add to context for audit
			ctx := context.WithValue(r.Context(), "is_redacted", isRedacted)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
