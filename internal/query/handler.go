package query

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/ydcloud-dy/webanalytics/internal/auth"
	"github.com/ydcloud-dy/webanalytics/internal/site"
)

type Handler struct {
	repo    *Repository
	siteSvc *site.Service
	loc     *time.Location
}

func NewHandler(repo *Repository, siteSvc *site.Service, timezone string) *Handler {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		log.Printf("[query] invalid timezone %q, falling back to Local: %v", timezone, err)
		loc = time.Local
	}
	return &Handler{repo: repo, siteSvc: siteSvc, loc: loc}
}

func (h *Handler) parseDateRange(r *http.Request) DateRange {
	now := time.Now().In(h.loc)
	dr := DateRange{
		From: now.AddDate(0, 0, -7),
		To:   now,
	}
	if from := r.URL.Query().Get("from"); from != "" {
		if t, err := time.ParseInLocation("2006-01-02", from, h.loc); err == nil {
			dr.From = t
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if t, err := time.ParseInLocation("2006-01-02", to, h.loc); err == nil {
			dr.To = t.Add(24*time.Hour - time.Millisecond)
		}
	}
	return dr
}

func (h *Handler) getSiteID(r *http.Request) (uint32, error) {
	userID := r.Context().Value(auth.UserIDKey).(int64)
	siteIDStr := chi.URLParam(r, "siteId")
	return h.siteSvc.ValidateSiteAccess(userID, siteIDStr)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		log.Printf("[overview] getSiteID error: %v", err)
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	dr := h.parseDateRange(r)
	log.Printf("[overview] siteID=%d from=%v to=%v", siteID, dr.From, dr.To)
	stats, err := h.repo.Overview(r.Context(), siteID, dr)
	if err != nil {
		log.Printf("[overview] query error: %v", err)
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	log.Printf("[overview] stats: %+v", stats)
	writeJSON(w, stats)
}

func (h *Handler) Timeseries(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "day"
	}
	data, err := h.repo.Timeseries(r.Context(), siteID, h.parseDateRange(r), interval)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) Channels(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.Channels(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) Browsers(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.Browsers(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) Devices(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.Devices(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) Geo(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.Geo(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) Pages(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.TopPages(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) Referrers(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.TopReferrers(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) Realtime(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	count, err := h.repo.RealtimeVisitors(r.Context(), siteID)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]uint64{"visitors": count})
}

// OS stats endpoint
type OSStat struct {
	OS       string `json:"os"`
	Visitors uint64 `json:"visitors"`
	Pct      float64 `json:"pct"`
}

func (h *Handler) OSStats(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	dr := h.parseDateRange(r)

	rows, err := h.repo.conn.Query(r.Context(), `
		SELECT os, uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		  AND os != 'Unknown' AND os != ''
		GROUP BY os
		ORDER BY visitors DESC
		LIMIT 10
	`, siteID, dr.From, dr.To)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var result []OSStat
	var total uint64
	for rows.Next() {
		var s OSStat
		if err := rows.Scan(&s.OS, &s.Visitors); err != nil {
			continue
		}
		total += s.Visitors
		result = append(result, s)
	}
	for i := range result {
		if total > 0 {
			result[i].Pct = float64(result[i].Visitors) / float64(total) * 100
		}
	}
	writeJSON(w, result)
}

func (h *Handler) RealtimeStatsExt(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.RealtimeStatsExtended(r.Context(), siteID)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) QPSTrend(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.QPSTrend(r.Context(), siteID)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	if data == nil {
		data = []QPSTrendPoint{}
	}
	writeJSON(w, data)
}

func (h *Handler) RealtimeOverview(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.RealtimeOverview(r.Context(), siteID)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) RecentVisits(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.RecentVisits(r.Context(), siteID, 30)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	if data == nil {
		data = []RecentVisit{}
	}
	writeJSON(w, data)
}

// ScreenResolution stats endpoint
type ScreenResStat struct {
	Resolution string `json:"resolution"`
	Visitors   uint64 `json:"visitors"`
	Pct        float64 `json:"pct"`
}

func (h *Handler) ScreenResolutions(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	dr := h.parseDateRange(r)

	rows, err := h.repo.conn.Query(r.Context(), `
		SELECT
			concat(toString(screen_width), 'x', toString(screen_height)) AS resolution,
			uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		  AND screen_width > 0 AND screen_height > 0
		GROUP BY resolution
		ORDER BY visitors DESC
		LIMIT 20
	`, siteID, dr.From, dr.To)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var result []ScreenResStat
	var total uint64
	for rows.Next() {
		var s ScreenResStat
		if err := rows.Scan(&s.Resolution, &s.Visitors); err != nil {
			continue
		}
		total += s.Visitors
		result = append(result, s)
	}
	for i := range result {
		if total > 0 {
			result[i].Pct = float64(result[i].Visitors) / float64(total) * 100
		}
	}
	if result == nil {
		result = []ScreenResStat{}
	}
	writeJSON(w, result)
}

// HourlyVisitors returns visitor count per hour for a given date range
type HourlyVisitorPoint struct {
	Hour     int    `json:"hour"`
	Visitors uint64 `json:"visitors"`
}

func (h *Handler) HourlyVisitors(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	dr := h.parseDateRange(r)
	tz := h.repo.tz

	rows, err := h.repo.conn.Query(r.Context(), fmt.Sprintf(`
		SELECT
			toHour(toTimezone(timestamp, '%s')) AS h,
			uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY h
		ORDER BY h
	`, tz), siteID, dr.From, dr.To)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	hourMap := make(map[int]uint64)
	for rows.Next() {
		var hour uint8
		var v uint64
		if err := rows.Scan(&hour, &v); err != nil {
			log.Printf("[query] hourly-visitors scan error: %v", err)
			continue
		}
		hourMap[int(hour)] = v
	}

	// Fill all 24 hours
	result := make([]HourlyVisitorPoint, 24)
	for i := 0; i < 24; i++ {
		result[i] = HourlyVisitorPoint{Hour: i, Visitors: hourMap[i]}
	}
	writeJSON(w, result)
}

// Enhanced page stats with bounce rate and avg duration
type PageStatExt struct {
	Pathname    string  `json:"pathname"`
	Pageviews   uint64  `json:"pageviews"`
	Visitors    uint64  `json:"visitors"`
	BounceRate  float64 `json:"bounce_rate"`
	AvgDuration float64 `json:"avg_duration"`
}

func (h *Handler) PagesExt(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	dr := h.parseDateRange(r)

	rows, err := h.repo.conn.Query(r.Context(), `
		SELECT
			p.pathname,
			p.pageviews,
			p.visitors,
			if(p.sessions > 0, bounced.cnt / p.sessions * 100, 0) AS bounce_rate,
			d.avg_dur
		FROM (
			SELECT
				pathname,
				count() AS pageviews,
				uniqExact(visitor_id) AS visitors,
				uniqExact(session_id) AS sessions
			FROM events
			WHERE site_id = ? AND event_type = 'pageview'
			  AND timestamp >= ? AND timestamp < ?
			GROUP BY pathname
		) AS p
		LEFT JOIN (
			SELECT
				pathname,
				toFloat64(countIf(cnt = 1)) AS cnt
			FROM (
				SELECT session_id, pathname, count() AS cnt
				FROM events
				WHERE site_id = ? AND event_type = 'pageview'
				  AND timestamp >= ? AND timestamp < ?
				GROUP BY session_id, pathname
			)
			GROUP BY pathname
		) AS bounced ON p.pathname = bounced.pathname
		LEFT JOIN (
			SELECT
				pathname,
				avg(duration) AS avg_dur
			FROM events
			WHERE site_id = ? AND event_type = 'leave'
			  AND duration > 0
			  AND timestamp >= ? AND timestamp < ?
			GROUP BY pathname
		) AS d ON p.pathname = d.pathname
		ORDER BY p.pageviews DESC
		LIMIT 50
	`, siteID, dr.From, dr.To,
		siteID, dr.From, dr.To,
		siteID, dr.From, dr.To)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var result []PageStatExt
	for rows.Next() {
		var s PageStatExt
		if err := rows.Scan(&s.Pathname, &s.Pageviews, &s.Visitors, &s.BounceRate, &s.AvgDuration); err != nil {
			continue
		}
		result = append(result, s)
	}
	if result == nil {
		result = []PageStatExt{}
	}
	writeJSON(w, result)
}

func (h *Handler) PerformanceOverview(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.PerformanceOverview(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) PerformanceTimeseries(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "day"
	}
	data, err := h.repo.PerformanceTimeseries(r.Context(), siteID, h.parseDateRange(r), interval)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	if data == nil {
		data = []PerformanceTimeseriesPoint{}
	}
	writeJSON(w, data)
}

func (h *Handler) Loyalty(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.Loyalty(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, data)
}

func (h *Handler) PagePerformance(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	data, err := h.repo.PagePerformance(r.Context(), siteID, h.parseDateRange(r))
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	if data == nil {
		data = []PagePerformanceStat{}
	}
	writeJSON(w, data)
}