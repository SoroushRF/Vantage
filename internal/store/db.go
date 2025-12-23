package store

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type InteractionRecord struct {
	ID           int       `json:"id"`
	Timestamp    time.Time `json:"timestamp"`
	UserID       string    `json:"user_id"`
	Method       string    `json:"method"`
	Path         string    `json:"path"`
	RequestBody  string    `json:"request_body"`
	ResponseBody string    `json:"response_body"`
	StatusCode   int       `json:"status_code"`
	LatencyMs    int64     `json:"latency_ms"`
	Tokens       int       `json:"tokens"`
	SafetyScore  float64   `json:"safety_score"`
	IsBlocked    bool      `json:"is_blocked"`
	IsRedacted   bool      `json:"is_redacted"`
}

type Store struct {
	db *sql.DB
}

func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping sqlite: %w", err)
	}

	s := &Store{db: db}
	if err := s.InitSchema(); err != nil {
		return nil, fmt.Errorf("failed to init schema: %w", err)
	}

	return s, nil
}

func (s *Store) InitSchema() error {
	query := `
	CREATE TABLE IF NOT EXISTS interaction_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		user_id TEXT,
		method TEXT,
		path TEXT,
		request_body BLOB,
		response_body BLOB,
		status_code INTEGER,
		latency_ms INTEGER,
		token_count INTEGER,
		safety_score REAL,
		is_blocked BOOLEAN DEFAULT 0,
		is_redacted BOOLEAN DEFAULT 0
	);`
	_, err := s.db.Exec(query)
	return err
}

func (s *Store) LogInteractionDetailed(userID, method, path string, reqBody, respBody []byte, statusCode int, latencyMs int64, tokens int, safetyScore float64, isBlocked, isRedacted bool) error {
	query := `
	INSERT INTO interaction_logs (user_id, method, path, request_body, response_body, status_code, latency_ms, token_count, safety_score, is_blocked, is_redacted)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, userID, method, path, reqBody, respBody, statusCode, latencyMs, tokens, safetyScore, isBlocked, isRedacted)
	return err
}

func (s *Store) GetLogs(limit int) ([]InteractionRecord, error) {
	query := `SELECT id, timestamp, user_id, method, path, request_body, response_body, status_code, latency_ms, token_count, safety_score, is_blocked, is_redacted 
	          FROM interaction_logs ORDER BY timestamp DESC LIMIT ?`
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []InteractionRecord
	for rows.Next() {
		var r InteractionRecord
		var req, resp []byte
		err := rows.Scan(&r.ID, &r.Timestamp, &r.UserID, &r.Method, &r.Path, &req, &resp, &r.StatusCode, &r.LatencyMs, &r.Tokens, &r.SafetyScore, &r.IsBlocked, &r.IsRedacted)
		if err != nil {
			return nil, err
		}
		r.RequestBody = string(req)
		r.ResponseBody = string(resp)
		logs = append(logs, r)
	}
	return logs, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}
