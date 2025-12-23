package main

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/soroushbar/vantage/internal/audit"
	"github.com/soroushbar/vantage/internal/store"
	pkgmiddleware "github.com/soroushbar/vantage/pkg/middleware"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cohereKey := os.Getenv("COHERE_API_KEY")
	if cohereKey == "" {
		log.Fatal("COHERE_API_KEY is not set")
	}

	// 1. Initialize Store
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "./audit.db"
	}
	st, err := store.NewStore(dbPath)
	if err != nil {
		log.Fatalf("failed to initialize store: %v", err)
	}
	defer st.Close()

	// 2. Initialize Audit Channel and Worker
	auditChan := make(chan pkgmiddleware.Interaction, 100)
	worker := audit.NewWorker(auditChan, st, cohereKey)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	worker.Start(ctx)

	// 3. Setup Reverse Proxy to Cohere
	cohereURL, _ := url.Parse("https://api.cohere.com")
	proxy := httputil.NewSingleHostReverseProxy(cohereURL)

	proxy.Director = func(req *http.Request) {
		req.Header.Set("Authorization", "Bearer "+cohereKey)
		req.Header.Set("Host", cohereURL.Host)
		req.URL.Scheme = cohereURL.Scheme
		req.URL.Host = cohereURL.Host
		req.Host = cohereURL.Host
	}

	// 4. Setup Router
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(pkgmiddleware.AuditMiddleware(auditChan))
	r.Use(middleware.Recoverer)

	// Metrics Endpoint
	r.Handle("/metrics", promhttp.Handler())

	// Proxy all requests to /v1/* to Cohere
	r.HandleFunc("/v1/*", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})

	// Health check and Metrics (placeholder)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Vantage is online"))
	})

	// 4. Start Server
	server := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	go func() {
		log.Printf("Vantage Proxy listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Vantage exited cleanly")
}
