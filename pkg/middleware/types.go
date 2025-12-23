package middleware

import (
	"time"
)

// Interaction represents a single request-response cycle captured by the proxy.
type Interaction struct {
	Timestamp    time.Time
	UserID       string
	Method       string
	Path         string
	RequestBody  []byte
	ResponseBody []byte
	StatusCode   int
	Duration     time.Duration
	IsBlocked    bool
	IsRedacted   bool
}
