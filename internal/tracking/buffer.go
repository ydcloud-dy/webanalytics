package tracking

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type Event struct {
	SiteID         uint32
	EventType      string
	Timestamp      time.Time
	SessionID      string
	VisitorID      string
	Pathname       string
	Hostname       string
	Referrer       string
	ReferrerSource string
	UTMSource      string
	UTMMedium      string
	UTMCampaign    string
	UTMTerm        string
	UTMContent     string
	Browser        string
	BrowserVersion string
	OS             string
	OSVersion      string
	DeviceType     string
	Country        string
	Region         string
	City           string
	Lat            float64
	Lon            float64
	EventName      string
	EventValue     float64
	Props          map[string]string
	ScreenWidth    uint16
	ScreenHeight   uint16
	Duration       uint32
	NetworkTime    uint32
	ServerTime     uint32
	TransferTime   uint32
	DOMProcessing  uint32
	DOMComplete    uint32
	OnLoadTime     uint32
	PageLoadTime   uint32
	ErrorMessage   string
	ErrorSource    string
	ErrorStack     string
	ErrorFilename  string
	ErrorLineno    uint32
	ErrorColno     uint32
	HTTPStatus     uint16
	HTTPURL        string
	ClientIP       string
}

type BufferMetrics struct {
	CurrentSize       int     `json:"current_size"`
	MaxSize           int     `json:"max_size"`
	TotalFlushed      uint64  `json:"total_flushed"`
	TotalErrors       uint64  `json:"total_errors"`
	LastFlushDurationMs float64 `json:"last_flush_duration_ms"`
}

type Buffer struct {
	conn     driver.Conn
	events   []Event
	mu       sync.Mutex
	maxSize  int
	interval time.Duration
	done     chan struct{}
	wg       sync.WaitGroup

	totalFlushed      uint64
	totalErrors       uint64
	lastFlushDuration int64 // nanoseconds, atomic
}

func NewBuffer(conn driver.Conn, maxSize int, interval time.Duration) *Buffer {
	b := &Buffer{
		conn:     conn,
		events:   make([]Event, 0, maxSize),
		maxSize:  maxSize,
		interval: interval,
		done:     make(chan struct{}),
	}
	b.wg.Add(1)
	go b.flushLoop()
	return b
}

func (b *Buffer) Add(e Event) {
	b.mu.Lock()
	b.events = append(b.events, e)
	shouldFlush := len(b.events) >= b.maxSize
	b.mu.Unlock()

	if shouldFlush {
		b.flush()
	}
}

func (b *Buffer) flushLoop() {
	defer b.wg.Done()
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			b.flush()
		case <-b.done:
			b.flush()
			return
		}
	}
}

func (b *Buffer) flush() {
	b.mu.Lock()
	if len(b.events) == 0 {
		b.mu.Unlock()
		return
	}
	events := b.events
	b.events = make([]Event, 0, b.maxSize)
	b.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	start := time.Now()
	if err := b.insertBatch(ctx, events); err != nil {
		log.Printf("[buffer] flush error (%d events): %v", len(events), err)
		atomic.AddUint64(&b.totalErrors, 1)
		b.mu.Lock()
		b.events = append(events, b.events...)
		b.mu.Unlock()
	} else {
		atomic.AddUint64(&b.totalFlushed, uint64(len(events)))
		log.Printf("[buffer] flushed %d events", len(events))
	}
	atomic.StoreInt64(&b.lastFlushDuration, int64(time.Since(start)))
}

func (b *Buffer) insertBatch(ctx context.Context, events []Event) error {
	batch, err := b.conn.PrepareBatch(ctx, `INSERT INTO events (
		site_id, event_type, timestamp, session_id, visitor_id,
		pathname, hostname, referrer, referrer_source,
		utm_source, utm_medium, utm_campaign, utm_term, utm_content,
		browser, browser_version, os, os_version, device_type,
		country, region, city, lat, lon,
		event_name, event_value, props, screen_width, screen_height, duration,
		network_time, server_time, transfer_time, dom_processing, dom_complete, on_load_time, page_load_time,
		error_message, error_source, error_stack, error_filename, error_lineno, error_colno, http_status, http_url,
		client_ip
	)`)
	if err != nil {
		return fmt.Errorf("prepare batch: %w", err)
	}

	for _, e := range events {
		if e.Props == nil {
			e.Props = map[string]string{}
		}
		if err := batch.Append(
			e.SiteID, e.EventType, e.Timestamp, e.SessionID, e.VisitorID,
			e.Pathname, e.Hostname, e.Referrer, e.ReferrerSource,
			e.UTMSource, e.UTMMedium, e.UTMCampaign, e.UTMTerm, e.UTMContent,
			e.Browser, e.BrowserVersion, e.OS, e.OSVersion, e.DeviceType,
			e.Country, e.Region, e.City, e.Lat, e.Lon,
			e.EventName, e.EventValue, e.Props, e.ScreenWidth, e.ScreenHeight, e.Duration,
			e.NetworkTime, e.ServerTime, e.TransferTime, e.DOMProcessing, e.DOMComplete, e.OnLoadTime, e.PageLoadTime,
			e.ErrorMessage, e.ErrorSource, e.ErrorStack, e.ErrorFilename, e.ErrorLineno, e.ErrorColno, e.HTTPStatus, e.HTTPURL,
			e.ClientIP,
		); err != nil {
			return fmt.Errorf("append batch: %w", err)
		}
	}
	return batch.Send()
}

func (b *Buffer) Close() {
	close(b.done)
	b.wg.Wait()
}

func (b *Buffer) Metrics() BufferMetrics {
	b.mu.Lock()
	currentSize := len(b.events)
	b.mu.Unlock()
	return BufferMetrics{
		CurrentSize:       currentSize,
		MaxSize:           b.maxSize,
		TotalFlushed:      atomic.LoadUint64(&b.totalFlushed),
		TotalErrors:       atomic.LoadUint64(&b.totalErrors),
		LastFlushDurationMs: float64(atomic.LoadInt64(&b.lastFlushDuration)) / float64(time.Millisecond),
	}
}
