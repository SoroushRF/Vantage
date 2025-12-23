package store

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

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
		method TEXT,
		path TEXT,
		request_body BLOB,
		response_body BLOB,
		status_code INTEGER,
		latency_ms INTEGER,
		token_count INTEGER,
		safety_score REAL
	);`
	_, err := s.db.Exec(query)
	return err
}

func (s *Store) LogInteractionDetailed(method, path string, reqBody, respBody []byte, statusCode int, latencyMs int64, tokens int, safetyScore float64) error {
	query := `
	INSERT INTO interaction_logs (method, path, request_body, response_body, status_code, latency_ms, token_count, safety_score)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, method, path, reqBody, respBody, statusCode, latencyMs, tokens, safetyScore)
	return err
}

func (s *Store) Close() error {
	return s.db.Close()
}
