package telemetry

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	HttpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "vantage_http_requests_total",
			Help: "Total number of HTTP requests processed by Vantage.",
		},
		[]string{"method", "path", "status"},
	)

	HttpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "vantage_http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	TokenUsageTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "vantage_token_usage_total",
			Help: "Total number of tokens consumed.",
		},
		[]string{"model"},
	)
)
