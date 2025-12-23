package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/soroushbar/vantage/internal/audit"
	"github.com/soroushbar/vantage/internal/config"
	"github.com/soroushbar/vantage/internal/server"
	"github.com/soroushbar/vantage/internal/store"
	pkgmiddleware "github.com/soroushbar/vantage/pkg/middleware"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cohereKey := os.Getenv("COHERE_API_KEY")
	if cohereKey == "" {
		log.Fatal("COHERE_API_KEY environment variable is required")
	}

	// 1. Load Governance Config
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Printf("Failed to load config.yaml, using defaults: %v", err)
		cfg = &config.Config{ForbiddenKeywords: []string{}}
	}

	// 2. Initialize Infrastructure
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "./audit.db"
	}
	st, err := store.NewStore(dbPath)
	if err != nil {
		log.Fatalf("failed to initialize store: %v", err)
	}
	defer st.Close()

	// 3. Initialize Audit Worker
	auditChan := make(chan pkgmiddleware.Interaction, 100)
	worker := audit.NewWorker(auditChan, st, cohereKey)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	worker.Start(ctx)

	// 4. Initialize Server
	srv := server.NewServer(st, cfg, cohereKey, auditChan)

	httpServer := &http.Server{
		Addr:    ":8080",
		Handler: srv.Router,
	}

	// 5. Lifecycle Management
	go func() {
		log.Printf("Vantage Gateway listening on %s", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Initiating graceful shutdown...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Vantage exited cleanly")
}
