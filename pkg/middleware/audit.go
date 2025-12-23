package middleware

import (
	"bytes"
	"io"
	"net/http"
	"time"
)

// Interaction represents a single request-response cycle captured by the proxy.
type Interaction struct {
	Timestamp    time.Time
	Method       string
	Path         string
	RequestBody  []byte
	ResponseBody []byte
	StatusCode   int
	Duration     time.Duration
}

// AuditMiddleware captures request and response data and sends it to a channel for async processing.
func AuditMiddleware(auditChan chan<- Interaction) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Capture Request Body
			var reqBody []byte
			if r.Body != nil {
				reqBody, _ = io.ReadAll(r.Body)
				// Restore body for the next handler
				r.Body = io.NopCloser(bytes.NewBuffer(reqBody))
			}

			// Wrap ResponseWriter to capture body and status code
			rw := &responseWriterWrapper{
				ResponseWriter: w,
				body:           &bytes.Buffer{},
				statusCode:     http.StatusOK,
			}

			// Call the next handler
			next.ServeHTTP(rw, r)

			// Prepare Interaction record
			interaction := Interaction{
				Timestamp:    start,
				Method:       r.Method,
				Path:         r.URL.Path,
				RequestBody:  reqBody,
				ResponseBody: rw.body.Bytes(),
				StatusCode:   rw.statusCode,
				Duration:     time.Since(start),
			}

			// Non-blocking send to the audit channel
			select {
			case auditChan <- interaction:
			default:
				// If channel is full, we log and drop to maintain performance
				// In a real app, maybe log a warning or use a larger buffer
			}
		})
	}
}

// responseWriterWrapper captures the status code and body written to the ResponseWriter.
type responseWriterWrapper struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

func (rw *responseWriterWrapper) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriterWrapper) Write(b []byte) (int, error) {
	rw.body.Write(b)
	return rw.ResponseWriter.Write(b)
}
