package server

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/soroushbar/vantage/internal/config"
	"github.com/soroushbar/vantage/internal/store"
	pkgmiddleware "github.com/soroushbar/vantage/pkg/middleware"
)

type Server struct {
	Router *chi.Mux
	Store  *store.Store
	Config *config.Config
	Proxy  *httputil.ReverseProxy
}

func NewServer(st *store.Store, cfg *config.Config, cohereKey string, auditChan chan pkgmiddleware.Interaction) *Server {
	s := &Server{
		Router: chi.NewRouter(),
		Store:  st,
		Config: cfg,
	}

	// Setup Proxy
	cohereURL, _ := url.Parse("https://api.cohere.com")
	s.Proxy = httputil.NewSingleHostReverseProxy(cohereURL)
	s.Proxy.Director = func(req *http.Request) {
		req.Header.Set("Authorization", "Bearer "+cohereKey)
		req.Header.Set("Host", cohereURL.Host)
		req.URL.Scheme = cohereURL.Scheme
		req.URL.Host = cohereURL.Host
		req.Host = cohereURL.Host
	}

	s.setupRoutes(auditChan)
	return s
}

func (s *Server) setupRoutes(auditChan chan pkgmiddleware.Interaction) {
	r := s.Router

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Basic CORS for UI
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-User-ID"},
		AllowCredentials: true,
	}))

	// Status Endpoint
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "Vantage v2.0.0 is operational",
			"node":   "Vantage-Core-01",
		})
	})

	// Metrics & Health
	r.Handle("/metrics", promhttp.Handler())
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})

	// Internal APIs
	r.Route("/api", func(r chi.Router) {
		r.Get("/logs", s.handleGetLogs)
	})

	// The AI Proxy Pipeline
	r.Group(func(r chi.Router) {
		r.Use(pkgmiddleware.AuditMiddleware(auditChan))
		r.Use(pkgmiddleware.GovernanceMiddleware(s.Config.ForbiddenKeywords, true))

		r.HandleFunc("/v1/*", func(w http.ResponseWriter, r *http.Request) {
			s.Proxy.ServeHTTP(w, r)
		})
	})
}

func (s *Server) handleGetLogs(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limit == 0 {
		limit = 50
	}
	logs, err := s.Store.GetLogs(limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
