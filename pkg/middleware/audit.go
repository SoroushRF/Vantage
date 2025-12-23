package middleware

import (
	"bytes"
	"io"
	"net/http"
	"time"
)

// AuditMiddleware captures request and response data and sends it to a channel for async processing.
func AuditMiddleware(auditChan chan<- Interaction) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Extract User ID
			userID := r.Header.Get("X-User-ID")
			if userID == "" {
				userID = "anonymous"
			}

			// Capture Request Body
			var reqBody []byte
			if r.Body != nil {
				reqBody, _ = io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(reqBody))
			}

			// Wrap ResponseWriter
			rw := &responseWriterWrapper{
				ResponseWriter: w,
				body:           &bytes.Buffer{},
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(rw, r)

			// Capture metadata from context if added by other middlewares
			isRedacted, _ := r.Context().Value("is_redacted").(bool)

			// Check for blocked header from Governance
			isBlocked := rw.Header().Get("X-Vantage-Blocked") == "true"
			if isBlocked {
				rw.Header().Del("X-Vantage-Blocked") // Clean up
			}

			interaction := Interaction{
				Timestamp:    start,
				UserID:       userID,
				Method:       r.Method,
				Path:         r.URL.Path,
				RequestBody:  reqBody,
				ResponseBody: rw.body.Bytes(),
				StatusCode:   rw.statusCode,
				Duration:     time.Since(start),
				IsBlocked:    isBlocked,
				IsRedacted:   isRedacted,
			}

			select {
			case auditChan <- interaction:
			default:
			}
		})
	}
}

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
