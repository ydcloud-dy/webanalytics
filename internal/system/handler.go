package system

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"time"

	"github.com/ydcloud-dy/webanalytics/internal/tracking"
)

type Handler struct {
	buffer    *tracking.Buffer
	startTime time.Time
}

func NewHandler(buffer *tracking.Buffer) *Handler {
	return &Handler{
		buffer:    buffer,
		startTime: time.Now(),
	}
}

type RuntimeStats struct {
	Goroutines  int     `json:"goroutines"`
	HeapAlloc   uint64  `json:"heap_alloc"`
	HeapSys     uint64  `json:"heap_sys"`
	GCPauseNs   uint64  `json:"gc_pause_ns"`
	NumGC       uint32  `json:"num_gc"`
	HeapObjects uint64  `json:"heap_objects"`
}

type SystemStats struct {
	Runtime   RuntimeStats            `json:"runtime"`
	Buffer    tracking.BufferMetrics  `json:"buffer"`
	Uptime    string                  `json:"uptime"`
	UptimeSec float64                 `json:"uptime_sec"`
}

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	var lastPause uint64
	if m.NumGC > 0 {
		lastPause = m.PauseNs[(m.NumGC+255)%256]
	}

	uptime := time.Since(h.startTime)

	stats := SystemStats{
		Runtime: RuntimeStats{
			Goroutines:  runtime.NumGoroutine(),
			HeapAlloc:   m.HeapAlloc,
			HeapSys:     m.HeapSys,
			GCPauseNs:   lastPause,
			NumGC:       m.NumGC,
			HeapObjects: m.HeapObjects,
		},
		Buffer:    h.buffer.Metrics(),
		Uptime:    formatDuration(uptime),
		UptimeSec: uptime.Seconds(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func formatDuration(d time.Duration) string {
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60
	seconds := int(d.Seconds()) % 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm %ds", days, hours, minutes, seconds)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm %ds", hours, minutes, seconds)
	}
	if minutes > 0 {
		return fmt.Sprintf("%dm %ds", minutes, seconds)
	}
	return fmt.Sprintf("%ds", seconds)
}
