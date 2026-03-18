package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/ydcloud-dy/webanalytics/internal/auth"
	"github.com/ydcloud-dy/webanalytics/internal/config"
	"github.com/ydcloud-dy/webanalytics/internal/middleware"
	"github.com/ydcloud-dy/webanalytics/internal/query"
	"github.com/ydcloud-dy/webanalytics/internal/site"
	"github.com/ydcloud-dy/webanalytics/internal/store"
	"github.com/ydcloud-dy/webanalytics/internal/system"
	"github.com/ydcloud-dy/webanalytics/internal/tracking"
)

//go:embed all:static
var staticFS embed.FS

func main() {
	cfg := config.Load()

	// ClickHouse
	ch, err := store.NewClickHouse(cfg.ClickHouseDSN)
	if err != nil {
		log.Fatalf("clickhouse: %v", err)
	}
	defer ch.Close()

	if err := ch.RunMigrations(context.Background()); err != nil {
		log.Fatalf("clickhouse migrations: %v", err)
	}
	log.Println("ClickHouse connected and migrations applied")

	// SQLite
	sq, err := store.NewSQLite(cfg.SQLitePath)
	if err != nil {
		log.Fatalf("sqlite: %v", err)
	}
	defer sq.Close()
	log.Println("SQLite connected")

	// Services
	geoip := tracking.NewGeoIP(cfg.GeoIPPath, cfg.GeoIPDefaultIP)
	defer geoip.Close()

	buffer := tracking.NewBuffer(ch.Conn, cfg.BufferSize, cfg.FlushInterval)

	authSvc := auth.NewService(sq, cfg.JWTSecret)
	siteSvc := site.NewService(sq)
	siteSvc.SetAuthService(authSvc)
	trackingHandler := tracking.NewHandler(buffer, geoip, siteSvc, cfg.Timezone)
	queryRepo := query.NewRepository(ch.Conn, cfg.Timezone)
	queryHandler := query.NewHandler(queryRepo, siteSvc, cfg.Timezone)
	systemHandler := system.NewHandler(buffer)

	// Router
	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(middleware.CORS(cfg.CORSAllowAll))

	collectLimiter := middleware.NewRateLimiter(100, time.Minute)

	// Tracking endpoints (public)
	r.Group(func(r chi.Router) {
		r.Use(collectLimiter.Limit)
		r.Post("/api/collect", trackingHandler.Collect)
		r.Get("/api/collect", trackingHandler.Pixel)
	})

	// SDK
	r.Get("/sdk/tracker.js", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		data, err := staticFS.ReadFile("static/tracker.js")
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Write(data)
	})

	// Auth endpoints (public)
	r.Post("/api/auth/register", authSvc.Register)
	r.Post("/api/auth/login", authSvc.Login)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(authSvc.AuthMiddleware)

		r.Post("/api/auth/refresh", authSvc.Refresh)
		r.Get("/api/auth/me", authSvc.Me)

		// Sites
		r.Get("/api/sites", siteSvc.List)
		r.Post("/api/sites", siteSvc.Create)
		r.Get("/api/sites/{siteId}", siteSvc.Get)
		r.Put("/api/sites/{siteId}", siteSvc.Update)
		r.Delete("/api/sites/{siteId}", siteSvc.Delete)

		// Admin routes
		r.Group(func(r chi.Router) {
			r.Use(authSvc.AdminMiddleware)

			// User management
			r.Get("/api/admin/users", authSvc.ListUsers)
			r.Post("/api/admin/users", authSvc.CreateUser)
			r.Put("/api/admin/users/{userId}", authSvc.UpdateUser)
			r.Delete("/api/admin/users/{userId}", authSvc.DeleteUser)
			r.Put("/api/admin/users/{userId}/password", authSvc.ResetPassword)

			// Site member management
			r.Get("/api/admin/sites/{siteId}/members", siteSvc.ListMembers)
			r.Post("/api/admin/sites/{siteId}/members", siteSvc.AddMember)
			r.Delete("/api/admin/sites/{siteId}/members/{userId}", siteSvc.RemoveMember)

			// Batch member management
			r.Post("/api/admin/batch-members", siteSvc.BatchAddMembers)
			r.Post("/api/admin/batch-members/remove", siteSvc.BatchRemoveMembers)

			// System monitoring
			r.Get("/api/system/stats", systemHandler.Stats)
		})

		// Dashboard
		r.Get("/api/dashboard/{siteId}/overview", queryHandler.Overview)
		r.Get("/api/dashboard/{siteId}/timeseries", queryHandler.Timeseries)
		r.Get("/api/dashboard/{siteId}/channels", queryHandler.Channels)
		r.Get("/api/dashboard/{siteId}/browsers", queryHandler.Browsers)
		r.Get("/api/dashboard/{siteId}/devices", queryHandler.Devices)
		r.Get("/api/dashboard/{siteId}/os", queryHandler.OSStats)
		r.Get("/api/dashboard/{siteId}/geo", queryHandler.Geo)
		r.Get("/api/dashboard/{siteId}/geo/regions", queryHandler.GeoRegions)
		r.Get("/api/dashboard/{siteId}/pages", queryHandler.Pages)
		r.Get("/api/dashboard/{siteId}/pages-ext", queryHandler.PagesExt)
		r.Get("/api/dashboard/{siteId}/referrers", queryHandler.Referrers)
		r.Get("/api/dashboard/{siteId}/screen-resolutions", queryHandler.ScreenResolutions)
		r.Get("/api/dashboard/{siteId}/hourly-visitors", queryHandler.HourlyVisitors)
		r.Get("/api/dashboard/{siteId}/realtime", queryHandler.Realtime)
		r.Get("/api/dashboard/{siteId}/realtime-overview", queryHandler.RealtimeOverview)
		r.Get("/api/dashboard/{siteId}/realtime-stats", queryHandler.RealtimeStatsExt)
		r.Get("/api/dashboard/{siteId}/qps-trend", queryHandler.QPSTrend)
		r.Get("/api/dashboard/{siteId}/recent-visits", queryHandler.RecentVisits)

		// Loyalty
		r.Get("/api/dashboard/{siteId}/loyalty", queryHandler.Loyalty)

		// Performance
		r.Get("/api/dashboard/{siteId}/performance-overview", queryHandler.PerformanceOverview)
		r.Get("/api/dashboard/{siteId}/performance-timeseries", queryHandler.PerformanceTimeseries)
		r.Get("/api/dashboard/{siteId}/page-performance", queryHandler.PagePerformance)

		// Errors
		r.Get("/api/dashboard/{siteId}/error-overview", queryHandler.ErrorOverview)
		r.Get("/api/dashboard/{siteId}/error-timeseries", queryHandler.ErrorTimeseries)
		r.Get("/api/dashboard/{siteId}/error-groups", queryHandler.ErrorGroups)
		r.Get("/api/dashboard/{siteId}/error-pages", queryHandler.ErrorPages)
	})

	// Health check
	r.Get("/api/health", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Serve React SPA
	frontendFS, err := fs.Sub(staticFS, "static/dist")
	if err != nil {
		log.Printf("No embedded frontend found, SPA will not be served: %v", err)
	} else {
		fileServer := http.FileServer(http.FS(frontendFS))
		r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			// Try to serve the file, fallback to index.html for SPA
			if _, err := fs.Stat(frontendFS, req.URL.Path[1:]); err != nil {
				req.URL.Path = "/"
			}
			fileServer.ServeHTTP(w, req)
		})
	}

	// Server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		srv.Shutdown(ctx)
		buffer.Close()
		log.Println("Buffer flushed, server stopped")
	}()

	log.Printf("Server starting on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
