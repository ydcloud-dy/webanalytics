package query

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type Repository struct {
	conn driver.Conn
	tz   string
}

func NewRepository(conn driver.Conn, timezone string) *Repository {
	if timezone == "" {
		timezone = "Asia/Shanghai"
	}
	return &Repository{conn: conn, tz: timezone}
}

type DateRange struct {
	From time.Time
	To   time.Time
}

type OverviewStats struct {
	Pageviews     uint64  `json:"pageviews"`
	Visitors      uint64  `json:"visitors"`
	Sessions      uint64  `json:"sessions"`
	AvgDuration   float64 `json:"avg_duration"`
	BounceRate    float64 `json:"bounce_rate"`
	ViewsPerVisit float64 `json:"views_per_visit"`
}

type TimeseriesPoint struct {
	Time      string `json:"time"`
	Pageviews uint64 `json:"pageviews"`
	Visitors  uint64 `json:"visitors"`
	Sessions  uint64 `json:"sessions"`
}

type ChannelStat struct {
	Channel   string `json:"channel"`
	Pageviews uint64 `json:"pageviews"`
	Visitors  uint64 `json:"visitors"`
	Pct       float64 `json:"pct"`
}

type BrowserStat struct {
	Browser   string `json:"browser"`
	Visitors  uint64 `json:"visitors"`
	Pct       float64 `json:"pct"`
}

type DeviceStat struct {
	DeviceType string `json:"device_type"`
	Visitors   uint64 `json:"visitors"`
	Pct        float64 `json:"pct"`
}

type GeoStat struct {
	Country   string `json:"country"`
	Visitors  uint64 `json:"visitors"`
	Pageviews uint64 `json:"pageviews"`
}

type RegionStat struct {
	Region    string `json:"region"`
	Visitors  uint64 `json:"visitors"`
	Pageviews uint64 `json:"pageviews"`
}

type PageStat struct {
	Pathname  string `json:"pathname"`
	Pageviews uint64 `json:"pageviews"`
	Visitors  uint64 `json:"visitors"`
}

type ReferrerStat struct {
	Referrer  string `json:"referrer"`
	Visitors  uint64 `json:"visitors"`
	Pageviews uint64 `json:"pageviews"`
}

func (r *Repository) Overview(ctx context.Context, siteID uint32, dr DateRange) (*OverviewStats, error) {
	var stats OverviewStats
	err := r.conn.QueryRow(ctx, `
		SELECT
			count() AS pageviews,
			uniqExact(visitor_id) AS visitors,
			uniqExact(session_id) AS sessions
		FROM events
		WHERE site_id = @siteID AND event_type = 'pageview'
		  AND timestamp >= @from AND timestamp < @to
	`,
		clickhouse.Named("siteID", siteID),
		clickhouse.Named("from", dr.From),
		clickhouse.Named("to", dr.To),
	).Scan(&stats.Pageviews, &stats.Visitors, &stats.Sessions)
	if err != nil {
		return nil, fmt.Errorf("overview query: %w", err)
	}

	if stats.Visitors > 0 {
		stats.ViewsPerVisit = float64(stats.Pageviews) / float64(stats.Visitors)
	}

	// Avg duration from 'leave' events (duration is only recorded on leave)
	_ = r.conn.QueryRow(ctx, `
		SELECT ifNull(avg(duration), 0)
		FROM events
		WHERE site_id = @siteID AND event_type = 'leave'
		  AND duration > 0
		  AND timestamp >= @from AND timestamp < @to
	`,
		clickhouse.Named("siteID", siteID),
		clickhouse.Named("from", dr.From),
		clickhouse.Named("to", dr.To),
	).Scan(&stats.AvgDuration)

	// Bounce rate: sessions with only 1 pageview / total sessions
	var bouncedSessions uint64
	err = r.conn.QueryRow(ctx, `
		SELECT count() FROM (
			SELECT session_id, count() AS cnt
			FROM events
			WHERE site_id = @siteID AND event_type = 'pageview'
			  AND timestamp >= @from AND timestamp < @to
			GROUP BY session_id
			HAVING cnt = 1
		)
	`,
		clickhouse.Named("siteID", siteID),
		clickhouse.Named("from", dr.From),
		clickhouse.Named("to", dr.To),
	).Scan(&bouncedSessions)
	if err == nil && stats.Sessions > 0 {
		stats.BounceRate = float64(bouncedSessions) / float64(stats.Sessions) * 100
	}

	return &stats, nil
}

func (r *Repository) Timeseries(ctx context.Context, siteID uint32, dr DateRange, interval string) ([]TimeseriesPoint, error) {
	var truncFunc string
	switch interval {
	case "hour":
		truncFunc = fmt.Sprintf("toStartOfHour(toTimezone(timestamp, '%s'))", r.tz)
	default:
		truncFunc = fmt.Sprintf("toDate(toTimezone(timestamp, '%s'))", r.tz)
	}

	query := fmt.Sprintf(`
		SELECT
			toString(%s) AS t,
			count() AS pageviews,
			uniqExact(visitor_id) AS visitors,
			uniqExact(session_id) AS sessions
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY t
		ORDER BY t
	`, truncFunc)

	rows, err := r.conn.Query(ctx, query, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("timeseries query: %w", err)
	}
	defer rows.Close()

	var result []TimeseriesPoint
	for rows.Next() {
		var p TimeseriesPoint
		if err := rows.Scan(&p.Time, &p.Pageviews, &p.Visitors, &p.Sessions); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}

func (r *Repository) Channels(ctx context.Context, siteID uint32, dr DateRange) ([]ChannelStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			referrer_source,
			count() AS pageviews,
			uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY referrer_source
		ORDER BY pageviews DESC
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("channels query: %w", err)
	}
	defer rows.Close()

	var result []ChannelStat
	var total uint64
	for rows.Next() {
		var s ChannelStat
		if err := rows.Scan(&s.Channel, &s.Pageviews, &s.Visitors); err != nil {
			return nil, err
		}
		total += s.Pageviews
		result = append(result, s)
	}
	for i := range result {
		if total > 0 {
			result[i].Pct = float64(result[i].Pageviews) / float64(total) * 100
		}
	}
	return result, nil
}

func (r *Repository) Browsers(ctx context.Context, siteID uint32, dr DateRange) ([]BrowserStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT browser, uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		  AND browser != 'Unknown' AND browser != ''
		GROUP BY browser
		ORDER BY visitors DESC
		LIMIT 10
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("browsers query: %w", err)
	}
	defer rows.Close()

	var result []BrowserStat
	var total uint64
	for rows.Next() {
		var s BrowserStat
		if err := rows.Scan(&s.Browser, &s.Visitors); err != nil {
			return nil, err
		}
		total += s.Visitors
		result = append(result, s)
	}
	for i := range result {
		if total > 0 {
			result[i].Pct = float64(result[i].Visitors) / float64(total) * 100
		}
	}
	return result, nil
}

func (r *Repository) Devices(ctx context.Context, siteID uint32, dr DateRange) ([]DeviceStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT device_type, uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY device_type
		ORDER BY visitors DESC
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("devices query: %w", err)
	}
	defer rows.Close()

	var result []DeviceStat
	var total uint64
	for rows.Next() {
		var s DeviceStat
		if err := rows.Scan(&s.DeviceType, &s.Visitors); err != nil {
			return nil, err
		}
		total += s.Visitors
		result = append(result, s)
	}
	for i := range result {
		if total > 0 {
			result[i].Pct = float64(result[i].Visitors) / float64(total) * 100
		}
	}
	return result, nil
}

func (r *Repository) Geo(ctx context.Context, siteID uint32, dr DateRange) ([]GeoStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT country, uniqExact(visitor_id) AS visitors, count() AS pageviews
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		  AND country != ''
		GROUP BY country
		ORDER BY visitors DESC
		LIMIT 50
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("geo query: %w", err)
	}
	defer rows.Close()

	var result []GeoStat
	for rows.Next() {
		var s GeoStat
		if err := rows.Scan(&s.Country, &s.Visitors, &s.Pageviews); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

func (r *Repository) GeoRegions(ctx context.Context, siteID uint32, dr DateRange) ([]RegionStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT region, uniqExact(visitor_id) AS visitors, count() AS pageviews
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		  AND region != ''
		GROUP BY region
		ORDER BY visitors DESC
		LIMIT 50
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("geo regions query: %w", err)
	}
	defer rows.Close()

	var result []RegionStat
	for rows.Next() {
		var s RegionStat
		if err := rows.Scan(&s.Region, &s.Visitors, &s.Pageviews); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

func (r *Repository) TopPages(ctx context.Context, siteID uint32, dr DateRange) ([]PageStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT pathname, count() AS pageviews, uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY pathname
		ORDER BY pageviews DESC
		LIMIT 20
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("top pages query: %w", err)
	}
	defer rows.Close()

	var result []PageStat
	for rows.Next() {
		var s PageStat
		if err := rows.Scan(&s.Pathname, &s.Pageviews, &s.Visitors); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

func (r *Repository) TopReferrers(ctx context.Context, siteID uint32, dr DateRange) ([]ReferrerStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT referrer, uniqExact(visitor_id) AS visitors, count() AS pageviews
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		  AND referrer != ''
		  AND referrer_source NOT IN ('internal', 'direct')
		GROUP BY referrer
		ORDER BY visitors DESC
		LIMIT 20
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("top referrers query: %w", err)
	}
	defer rows.Close()

	var result []ReferrerStat
	for rows.Next() {
		var s ReferrerStat
		if err := rows.Scan(&s.Referrer, &s.Visitors, &s.Pageviews); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

func (r *Repository) RealtimeVisitors(ctx context.Context, siteID uint32) (uint64, error) {
	var count uint64
	err := r.conn.QueryRow(ctx, fmt.Sprintf(`
		SELECT uniqExact(visitor_id)
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= now('%s') - INTERVAL 5 MINUTE
	`, r.tz), siteID).Scan(&count)
	return count, err
}

type RealtimeStats struct {
	Visits24h    uint64 `json:"visits_24h"`
	Pageviews24h uint64 `json:"pageviews_24h"`
	Visits30m    uint64 `json:"visits_30m"`
	Pageviews30m uint64 `json:"pageviews_30m"`
}

func (r *Repository) RealtimeOverview(ctx context.Context, siteID uint32) (*RealtimeStats, error) {
	var s RealtimeStats
	err := r.conn.QueryRow(ctx, fmt.Sprintf(`
		SELECT
			uniqExact(session_id),
			count()
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= now('%s') - INTERVAL 24 HOUR
	`, r.tz), siteID).Scan(&s.Visits24h, &s.Pageviews24h)
	if err != nil {
		return nil, err
	}
	err = r.conn.QueryRow(ctx, fmt.Sprintf(`
		SELECT
			uniqExact(session_id),
			count()
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= now('%s') - INTERVAL 30 MINUTE
	`, r.tz), siteID).Scan(&s.Visits30m, &s.Pageviews30m)
	return &s, err
}

type RecentVisit struct {
	Time       string `json:"time"`
	VisitorID  string `json:"visitor_id"`
	Pathname   string `json:"pathname"`
	Referrer   string `json:"referrer"`
	Browser    string `json:"browser"`
	OS         string `json:"os"`
	DeviceType string `json:"device_type"`
	Country    string `json:"country"`
}

type RealtimeStatsExt struct {
	TodayPV      uint64  `json:"today_pv"`
	TodayUV      uint64  `json:"today_uv"`
	YesterdayPV  uint64  `json:"yesterday_pv"`
	YesterdayUV  uint64  `json:"yesterday_uv"`
	TotalPV      uint64  `json:"total_pv"`
	TotalUV      uint64  `json:"total_uv"`
	QPS1m        float64 `json:"qps_1m"`
	PeakQPS      float64 `json:"peak_qps"`
	PeakQPSTime  string  `json:"peak_qps_time"`
}

func (r *Repository) RealtimeStatsExtended(ctx context.Context, siteID uint32) (*RealtimeStatsExt, error) {
	var s RealtimeStatsExt
	tz := r.tz

	// Today PV/UV
	err := r.conn.QueryRow(ctx, fmt.Sprintf(`
		SELECT count() AS pv, uniqExact(visitor_id) AS uv
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= toStartOfDay(now('%s'), '%s')
	`, tz, tz), siteID).Scan(&s.TodayPV, &s.TodayUV)
	if err != nil {
		return nil, fmt.Errorf("today pv/uv query: %w", err)
	}

	// Yesterday PV/UV
	err = r.conn.QueryRow(ctx, fmt.Sprintf(`
		SELECT count() AS pv, uniqExact(visitor_id) AS uv
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= toStartOfDay(now('%s') - INTERVAL 1 DAY, '%s')
		  AND timestamp < toStartOfDay(now('%s'), '%s')
	`, tz, tz, tz, tz), siteID).Scan(&s.YesterdayPV, &s.YesterdayUV)
	if err != nil {
		return nil, fmt.Errorf("yesterday pv/uv query: %w", err)
	}

	// Total PV/UV
	err = r.conn.QueryRow(ctx, `
		SELECT count() AS pv, uniqExact(visitor_id) AS uv
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
	`, siteID).Scan(&s.TotalPV, &s.TotalUV)
	if err != nil {
		return nil, fmt.Errorf("total pv/uv query: %w", err)
	}

	// QPS last 1 minute (all event types)
	err = r.conn.QueryRow(ctx, fmt.Sprintf(`
		SELECT count() / 60.0 AS qps
		FROM events
		WHERE site_id = ?
		  AND timestamp >= now('%s') - INTERVAL 1 MINUTE
	`, tz), siteID).Scan(&s.QPS1m)
	if err != nil {
		return nil, fmt.Errorf("qps 1m query: %w", err)
	}

	// Peak QPS today (by second, all event types)
	var peakTime time.Time
	err = r.conn.QueryRow(ctx, fmt.Sprintf(`
		SELECT max(cnt) AS peak_qps, argMax(sec, cnt) AS peak_time
		FROM (
			SELECT toStartOfSecond(timestamp) AS sec, toFloat64(count()) AS cnt
			FROM events
			WHERE site_id = ?
			  AND timestamp >= toStartOfDay(now('%s'), '%s')
			GROUP BY sec
		)
	`, tz, tz), siteID).Scan(&s.PeakQPS, &peakTime)
	if err != nil {
		return nil, fmt.Errorf("peak qps query: %w", err)
	}
	if s.PeakQPS > 0 {
		s.PeakQPSTime = peakTime.Format("2006-01-02 15:04:05")
	}

	return &s, nil
}

type QPSTrendPoint struct {
	Time string  `json:"time"`
	QPS  float64 `json:"qps"`
}

func (r *Repository) QPSTrend(ctx context.Context, siteID uint32) ([]QPSTrendPoint, error) {
	rows, err := r.conn.Query(ctx, fmt.Sprintf(`
		SELECT
			formatDateTime(toStartOfMinute(timestamp), '%%H:%%i') AS t,
			count() / 60.0 AS qps
		FROM events
		WHERE site_id = ?
		  AND timestamp >= toStartOfDay(now('%s'), '%s')
		GROUP BY t
		ORDER BY t
	`, r.tz, r.tz), siteID)
	if err != nil {
		return nil, fmt.Errorf("qps trend query: %w", err)
	}
	defer rows.Close()

	var result []QPSTrendPoint
	for rows.Next() {
		var p QPSTrendPoint
		if err := rows.Scan(&p.Time, &p.QPS); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}

func (r *Repository) RecentVisits(ctx context.Context, siteID uint32, limit int) ([]RecentVisit, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.conn.Query(ctx, `
		SELECT
			toString(timestamp) AS t,
			visitor_id,
			pathname,
			referrer,
			browser,
			os,
			device_type,
			country
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		ORDER BY timestamp DESC
		LIMIT ?
	`, siteID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []RecentVisit
	for rows.Next() {
		var v RecentVisit
		if err := rows.Scan(&v.Time, &v.VisitorID, &v.Pathname, &v.Referrer, &v.Browser, &v.OS, &v.DeviceType, &v.Country); err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, nil
}

// Performance analytics

type PerformanceOverviewStats struct {
	AvgNetworkTime    float64 `json:"avg_network_time"`
	AvgServerTime     float64 `json:"avg_server_time"`
	AvgTransferTime   float64 `json:"avg_transfer_time"`
	AvgDOMProcessing  float64 `json:"avg_dom_processing"`
	AvgDOMComplete    float64 `json:"avg_dom_complete"`
	AvgOnLoadTime     float64 `json:"avg_on_load_time"`
	AvgPageLoadTime   float64 `json:"avg_page_load_time"`
	SampleCount       uint64  `json:"sample_count"`
}

func (r *Repository) PerformanceOverview(ctx context.Context, siteID uint32, dr DateRange) (*PerformanceOverviewStats, error) {
	var s PerformanceOverviewStats
	err := r.conn.QueryRow(ctx, `
		SELECT
			avg(network_time),
			avg(server_time),
			avg(transfer_time),
			avg(dom_processing),
			avg(dom_complete),
			avg(on_load_time),
			avg(page_load_time),
			count()
		FROM events
		WHERE site_id = ? AND event_type = 'performance'
		  AND page_load_time > 0 AND page_load_time < 60000
		  AND network_time >= 0 AND network_time < 60000
		  AND timestamp >= ? AND timestamp < ?
	`, siteID, dr.From, dr.To).Scan(
		&s.AvgNetworkTime, &s.AvgServerTime, &s.AvgTransferTime,
		&s.AvgDOMProcessing, &s.AvgDOMComplete, &s.AvgOnLoadTime,
		&s.AvgPageLoadTime, &s.SampleCount,
	)
	if err != nil {
		return nil, fmt.Errorf("performance overview query: %w", err)
	}
	return &s, nil
}

type PerformanceTimeseriesPoint struct {
	Time            string  `json:"time"`
	AvgNetworkTime  float64 `json:"avg_network_time"`
	AvgServerTime   float64 `json:"avg_server_time"`
	AvgTransferTime float64 `json:"avg_transfer_time"`
	AvgDOMProcessing float64 `json:"avg_dom_processing"`
	AvgDOMComplete  float64 `json:"avg_dom_complete"`
	AvgOnLoadTime   float64 `json:"avg_on_load_time"`
	SampleCount     uint64  `json:"sample_count"`
}

func (r *Repository) PerformanceTimeseries(ctx context.Context, siteID uint32, dr DateRange, interval string) ([]PerformanceTimeseriesPoint, error) {
	var truncFunc string
	switch interval {
	case "week":
		truncFunc = fmt.Sprintf("toStartOfWeek(toTimezone(timestamp, '%s'))", r.tz)
	case "month":
		truncFunc = fmt.Sprintf("toStartOfMonth(toTimezone(timestamp, '%s'))", r.tz)
	case "year":
		truncFunc = fmt.Sprintf("toStartOfYear(toTimezone(timestamp, '%s'))", r.tz)
	default:
		truncFunc = fmt.Sprintf("toDate(toTimezone(timestamp, '%s'))", r.tz)
	}

	query := fmt.Sprintf(`
		SELECT
			toString(%s) AS t,
			avg(network_time),
			avg(server_time),
			avg(transfer_time),
			avg(dom_processing),
			avg(dom_complete),
			avg(on_load_time),
			count()
		FROM events
		WHERE site_id = ? AND event_type = 'performance'
		  AND page_load_time > 0 AND page_load_time < 60000
		  AND network_time >= 0 AND network_time < 60000
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY t
		ORDER BY t
	`, truncFunc)

	rows, err := r.conn.Query(ctx, query, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("performance timeseries query: %w", err)
	}
	defer rows.Close()

	var result []PerformanceTimeseriesPoint
	for rows.Next() {
		var p PerformanceTimeseriesPoint
		if err := rows.Scan(&p.Time, &p.AvgNetworkTime, &p.AvgServerTime, &p.AvgTransferTime,
			&p.AvgDOMProcessing, &p.AvgDOMComplete, &p.AvgOnLoadTime, &p.SampleCount); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}

// Loyalty analytics

type LoyaltyResponse struct {
	ReturningTrend     []LoyaltyTrendPoint `json:"returning_trend"`
	FrequencyOverview  LoyaltyFreqOverview `json:"frequency_overview"`
	DurationBuckets    []LoyaltyBucket     `json:"duration_buckets"`
	PagesBuckets       []LoyaltyBucket     `json:"pages_buckets"`
	VisitFrequency     []LoyaltyBucket     `json:"visit_frequency"`
	DaysSinceLastVisit []LoyaltyBucket     `json:"days_since_last_visit"`
}

type LoyaltyTrendPoint struct {
	Date              string `json:"date"`
	ReturningVisitors uint64 `json:"returning_visitors"`
}

type LoyaltyFreqOverview struct {
	Returning VisitorGroupStats `json:"returning"`
	New       VisitorGroupStats `json:"new"`
}

type VisitorGroupStats struct {
	Visitors      uint64  `json:"visitors"`
	AvgDuration   float64 `json:"avg_duration"`
	PagesPerVisit float64 `json:"pages_per_visit"`
	BounceRate    float64 `json:"bounce_rate"`
	Actions       uint64  `json:"actions"`
}

type LoyaltyBucket struct {
	Label  string  `json:"label"`
	Visits uint64  `json:"visits"`
	Pct    float64 `json:"pct"`
}

func (r *Repository) Loyalty(ctx context.Context, siteID uint32, dr DateRange) (*LoyaltyResponse, error) {
	resp := &LoyaltyResponse{}

	// Q1 - Returning visitor trend
	q1 := fmt.Sprintf(`
		SELECT toString(toDate(toTimezone(timestamp, '%s'))) AS d,
		       uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		  AND visitor_id IN (
		    SELECT DISTINCT visitor_id FROM events
		    WHERE site_id = ? AND event_type = 'pageview' AND timestamp < ?
		  )
		GROUP BY d ORDER BY d
	`, r.tz)
	rows, err := r.conn.Query(ctx, q1, siteID, dr.From, dr.To, siteID, dr.From)
	if err != nil {
		return nil, fmt.Errorf("loyalty q1: %w", err)
	}
	for rows.Next() {
		var p LoyaltyTrendPoint
		if err := rows.Scan(&p.Date, &p.ReturningVisitors); err != nil {
			rows.Close()
			return nil, err
		}
		resp.ReturningTrend = append(resp.ReturningTrend, p)
	}
	rows.Close()
	if resp.ReturningTrend == nil {
		resp.ReturningTrend = []LoyaltyTrendPoint{}
	}

	// Q2 - New vs returning visitors overview
	rows2, err := r.conn.Query(ctx, `
		WITH first_seen AS (
		  SELECT visitor_id, min(timestamp) AS first_ts
		  FROM events WHERE site_id = ? AND event_type = 'pageview' GROUP BY visitor_id
		)
		SELECT if(fs.first_ts >= ?, 'new', 'returning') AS vtype,
		       uniqExact(e.visitor_id) AS visitors,
		       uniqExact(e.session_id) AS sessions,
		       count() AS actions
		FROM events e JOIN first_seen fs ON e.visitor_id = fs.visitor_id
		WHERE e.site_id = ? AND e.event_type = 'pageview'
		  AND e.timestamp >= ? AND e.timestamp < ?
		GROUP BY vtype
	`, siteID, dr.From, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("loyalty q2: %w", err)
	}
	newStats := VisitorGroupStats{}
	retStats := VisitorGroupStats{}
	var newSessions, retSessions uint64
	for rows2.Next() {
		var vtype string
		var visitors, sessions, actions uint64
		if err := rows2.Scan(&vtype, &visitors, &sessions, &actions); err != nil {
			rows2.Close()
			return nil, err
		}
		if vtype == "new" {
			newStats.Visitors = visitors
			newStats.Actions = actions
			newSessions = sessions
		} else {
			retStats.Visitors = visitors
			retStats.Actions = actions
			retSessions = sessions
		}
	}
	rows2.Close()

	// Avg duration per group (from leave events)
	rows2d, err := r.conn.Query(ctx, `
		WITH first_seen AS (
		  SELECT visitor_id, min(timestamp) AS first_ts
		  FROM events WHERE site_id = ? AND event_type = 'pageview' GROUP BY visitor_id
		)
		SELECT if(fs.first_ts >= ?, 'new', 'returning') AS vtype,
		       avg(e.duration) AS avg_dur
		FROM events e JOIN first_seen fs ON e.visitor_id = fs.visitor_id
		WHERE e.site_id = ? AND e.event_type = 'leave' AND e.duration > 0
		  AND e.timestamp >= ? AND e.timestamp < ?
		GROUP BY vtype
	`, siteID, dr.From, siteID, dr.From, dr.To)
	if err == nil {
		for rows2d.Next() {
			var vtype string
			var avgDur float64
			if err := rows2d.Scan(&vtype, &avgDur); err == nil {
				if vtype == "new" {
					newStats.AvgDuration = avgDur
				} else {
					retStats.AvgDuration = avgDur
				}
			}
		}
		rows2d.Close()
	}

	// Pages per visit and bounce rate per group
	if newSessions > 0 {
		newStats.PagesPerVisit = float64(newStats.Actions) / float64(newSessions)
	}
	if retSessions > 0 {
		retStats.PagesPerVisit = float64(retStats.Actions) / float64(retSessions)
	}

	// Bounce rate per group
	rows2b, err := r.conn.Query(ctx, `
		WITH first_seen AS (
		  SELECT visitor_id, min(timestamp) AS first_ts
		  FROM events WHERE site_id = ? AND event_type = 'pageview' GROUP BY visitor_id
		),
		session_pages AS (
		  SELECT e.session_id, e.visitor_id, count() AS pages
		  FROM events e
		  WHERE e.site_id = ? AND e.event_type = 'pageview'
		    AND e.timestamp >= ? AND e.timestamp < ?
		  GROUP BY e.session_id, e.visitor_id
		)
		SELECT if(fs.first_ts >= ?, 'new', 'returning') AS vtype,
		       countIf(sp.pages = 1) AS bounced,
		       count() AS total
		FROM session_pages sp JOIN first_seen fs ON sp.visitor_id = fs.visitor_id
		GROUP BY vtype
	`, siteID, siteID, dr.From, dr.To, dr.From)
	if err == nil {
		for rows2b.Next() {
			var vtype string
			var bounced, total uint64
			if err := rows2b.Scan(&vtype, &bounced, &total); err == nil {
				if total > 0 {
					rate := float64(bounced) / float64(total) * 100
					if vtype == "new" {
						newStats.BounceRate = rate
					} else {
						retStats.BounceRate = rate
					}
				}
			}
		}
		rows2b.Close()
	}

	resp.FrequencyOverview = LoyaltyFreqOverview{Returning: retStats, New: newStats}

	// Q3 - Duration buckets
	rows3, err := r.conn.Query(ctx, `
		SELECT session_id, max(duration) AS dur FROM events
		WHERE site_id = ? AND event_type = 'leave' AND duration > 0
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY session_id
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("loyalty q3: %w", err)
	}
	durLabels := []string{"0-10s", "11-30s", "31-60s", "1-2min", "2-4min", "4-7min", "7-10min", "10-15min", "15-30min", "30+min"}
	durCounts := make([]uint64, len(durLabels))
	for rows3.Next() {
		var sessionID string
		var dur uint32
		if err := rows3.Scan(&sessionID, &dur); err != nil {
			rows3.Close()
			return nil, err
		}
		idx := 0
		switch {
		case dur <= 10:
			idx = 0
		case dur <= 30:
			idx = 1
		case dur <= 60:
			idx = 2
		case dur <= 120:
			idx = 3
		case dur <= 240:
			idx = 4
		case dur <= 420:
			idx = 5
		case dur <= 600:
			idx = 6
		case dur <= 900:
			idx = 7
		case dur <= 1800:
			idx = 8
		default:
			idx = 9
		}
		durCounts[idx]++
	}
	rows3.Close()
	resp.DurationBuckets = buildBuckets(durLabels, durCounts)

	// Q4 - Pages per session buckets
	rows4, err := r.conn.Query(ctx, `
		SELECT session_id, count() AS pages FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY session_id
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("loyalty q4: %w", err)
	}
	pageLabels := []string{"1页", "2页", "3页", "4页", "5页", "6-7页", "8-10页", "11-14页", "15-20页", "21+页"}
	pageCounts := make([]uint64, len(pageLabels))
	for rows4.Next() {
		var sessionID string
		var pages uint64
		if err := rows4.Scan(&sessionID, &pages); err != nil {
			rows4.Close()
			return nil, err
		}
		idx := 0
		switch {
		case pages <= 1:
			idx = 0
		case pages == 2:
			idx = 1
		case pages == 3:
			idx = 2
		case pages == 4:
			idx = 3
		case pages == 5:
			idx = 4
		case pages <= 7:
			idx = 5
		case pages <= 10:
			idx = 6
		case pages <= 14:
			idx = 7
		case pages <= 20:
			idx = 8
		default:
			idx = 9
		}
		pageCounts[idx]++
	}
	rows4.Close()
	resp.PagesBuckets = buildBuckets(pageLabels, pageCounts)

	// Q5 - Visit frequency per visitor
	rows5, err := r.conn.Query(ctx, `
		SELECT visitor_id, uniqExact(session_id) AS cnt FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY visitor_id
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("loyalty q5: %w", err)
	}
	freqLabels := []string{"1次", "2次", "3次", "4次", "5次", "6次", "7次", "8次", "9-14次", "15-25次", "26-50次", "51-100次", "101-200次", "201+次"}
	freqCounts := make([]uint64, len(freqLabels))
	for rows5.Next() {
		var visitorID string
		var cnt uint64
		if err := rows5.Scan(&visitorID, &cnt); err != nil {
			rows5.Close()
			return nil, err
		}
		idx := 0
		switch {
		case cnt <= 1:
			idx = 0
		case cnt == 2:
			idx = 1
		case cnt == 3:
			idx = 2
		case cnt == 4:
			idx = 3
		case cnt == 5:
			idx = 4
		case cnt == 6:
			idx = 5
		case cnt == 7:
			idx = 6
		case cnt == 8:
			idx = 7
		case cnt <= 14:
			idx = 8
		case cnt <= 25:
			idx = 9
		case cnt <= 50:
			idx = 10
		case cnt <= 100:
			idx = 11
		case cnt <= 200:
			idx = 12
		default:
			idx = 13
		}
		freqCounts[idx]++
	}
	rows5.Close()
	resp.VisitFrequency = buildBuckets(freqLabels, freqCounts)

	// Q6 - Days since last visit
	// Step 1: first visit in range per visitor
	type visitorFirstInRange struct {
		VisitorID string
		FirstDay  string
	}
	rows6a, err := r.conn.Query(ctx, fmt.Sprintf(`
		SELECT visitor_id, toString(min(toDate(toTimezone(timestamp, '%s')))) AS first_in_range
		FROM events WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY visitor_id
	`, r.tz), siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("loyalty q6a: %w", err)
	}
	var visitorsInRange []visitorFirstInRange
	for rows6a.Next() {
		var v visitorFirstInRange
		if err := rows6a.Scan(&v.VisitorID, &v.FirstDay); err != nil {
			rows6a.Close()
			return nil, err
		}
		visitorsInRange = append(visitorsInRange, v)
	}
	rows6a.Close()

	// Step 2: for returning visitors, find their last visit before range
	// Build a map of visitor_id -> first_in_range
	visitorMap := make(map[string]string, len(visitorsInRange))
	for _, v := range visitorsInRange {
		visitorMap[v.VisitorID] = v.FirstDay
	}

	// Get last visit date before range for all visitors
	rows6b, err := r.conn.Query(ctx, fmt.Sprintf(`
		SELECT visitor_id, toString(max(toDate(toTimezone(timestamp, '%s')))) AS last_before
		FROM events
		WHERE site_id = ? AND event_type = 'pageview' AND timestamp < ?
		GROUP BY visitor_id
	`, r.tz), siteID, dr.From)
	if err != nil {
		return nil, fmt.Errorf("loyalty q6b: %w", err)
	}
	daysLabels := []string{"新访问", "0-1天", "2-7天", "8-14天", "15-30天", "31-60天", "61-120天", "121-365天", "365+天"}
	daysCounts := make([]uint64, len(daysLabels))
	returningSet := make(map[string]bool)
	for rows6b.Next() {
		var visitorID string
		var lastBefore string
		if err := rows6b.Scan(&visitorID, &lastBefore); err != nil {
			rows6b.Close()
			return nil, err
		}
		firstInRange, ok := visitorMap[visitorID]
		if !ok {
			continue
		}
		returningSet[visitorID] = true
		firstDate, _ := time.ParseInLocation("2006-01-02", firstInRange, time.UTC)
		lastDate, _ := time.ParseInLocation("2006-01-02", lastBefore, time.UTC)
		daysDiff := int(firstDate.Sub(lastDate).Hours() / 24)
		idx := 0
		switch {
		case daysDiff <= 1:
			idx = 1
		case daysDiff <= 7:
			idx = 2
		case daysDiff <= 14:
			idx = 3
		case daysDiff <= 30:
			idx = 4
		case daysDiff <= 60:
			idx = 5
		case daysDiff <= 120:
			idx = 6
		case daysDiff <= 365:
			idx = 7
		default:
			idx = 8
		}
		daysCounts[idx]++
	}
	rows6b.Close()
	// Count new visitors (those not in returningSet)
	for _, v := range visitorsInRange {
		if !returningSet[v.VisitorID] {
			daysCounts[0]++
		}
	}
	resp.DaysSinceLastVisit = buildBuckets(daysLabels, daysCounts)

	return resp, nil
}

func buildBuckets(labels []string, counts []uint64) []LoyaltyBucket {
	var total uint64
	for _, c := range counts {
		total += c
	}
	buckets := make([]LoyaltyBucket, len(labels))
	for i, label := range labels {
		pct := 0.0
		if total > 0 {
			pct = float64(counts[i]) / float64(total) * 100
		}
		buckets[i] = LoyaltyBucket{Label: label, Visits: counts[i], Pct: pct}
	}
	return buckets
}

type PagePerformanceStat struct {
	Pathname         string  `json:"pathname"`
	UniquePageviews  uint64  `json:"unique_pageviews"`
	AvgNetworkTime   float64 `json:"avg_network_time"`
	AvgServerTime    float64 `json:"avg_server_time"`
	AvgTransferTime  float64 `json:"avg_transfer_time"`
	AvgDOMProcessing float64 `json:"avg_dom_processing"`
	AvgDOMComplete   float64 `json:"avg_dom_complete"`
	AvgOnLoadTime    float64 `json:"avg_on_load_time"`
	AvgPageLoadTime  float64 `json:"avg_page_load_time"`
}

func (r *Repository) PagePerformance(ctx context.Context, siteID uint32, dr DateRange) ([]PagePerformanceStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			perf.pathname,
			pv.unique_pageviews,
			perf.avg_nt,
			perf.avg_st,
			perf.avg_tt,
			perf.avg_dp,
			perf.avg_dc,
			perf.avg_ol,
			perf.avg_plt
		FROM (
			SELECT
				pathname,
				avg(network_time) AS avg_nt,
				avg(server_time) AS avg_st,
				avg(transfer_time) AS avg_tt,
				avg(dom_processing) AS avg_dp,
				avg(dom_complete) AS avg_dc,
				avg(on_load_time) AS avg_ol,
				avg(page_load_time) AS avg_plt
			FROM events
			WHERE site_id = ? AND event_type = 'performance'
			  AND page_load_time > 0 AND page_load_time < 60000
			  AND network_time >= 0 AND network_time < 60000
			  AND timestamp >= ? AND timestamp < ?
			GROUP BY pathname
		) AS perf
		LEFT JOIN (
			SELECT pathname, uniqExact(visitor_id) AS unique_pageviews
			FROM events
			WHERE site_id = ? AND event_type = 'pageview'
			  AND timestamp >= ? AND timestamp < ?
			GROUP BY pathname
		) AS pv ON perf.pathname = pv.pathname
		ORDER BY pv.unique_pageviews DESC
		LIMIT 100
	`, siteID, dr.From, dr.To, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("page performance query: %w", err)
	}
	defer rows.Close()

	var result []PagePerformanceStat
	for rows.Next() {
		var s PagePerformanceStat
		if err := rows.Scan(&s.Pathname, &s.UniquePageviews,
			&s.AvgNetworkTime, &s.AvgServerTime, &s.AvgTransferTime,
			&s.AvgDOMProcessing, &s.AvgDOMComplete, &s.AvgOnLoadTime, &s.AvgPageLoadTime); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

// Error analytics

type ErrorOverviewStats struct {
	TotalErrors    uint64  `json:"total_errors"`
	JSErrors       uint64  `json:"js_errors"`
	PromiseErrors  uint64  `json:"promise_errors"`
	ResourceErrors uint64  `json:"resource_errors"`
	HTTPErrors     uint64  `json:"http_errors"`
	ErrorRate      float64 `json:"error_rate"`
	AffectedPages  uint64  `json:"affected_pages"`
}

func (r *Repository) ErrorOverview(ctx context.Context, siteID uint32, dr DateRange) (*ErrorOverviewStats, error) {
	var s ErrorOverviewStats
	err := r.conn.QueryRow(ctx, `
		SELECT
			count() AS total,
			countIf(error_source = 'js') AS js,
			countIf(error_source = 'promise') AS promise,
			countIf(error_source = 'resource') AS resource,
			countIf(error_source = 'http') AS http,
			uniqExact(pathname) AS affected_pages
		FROM events
		WHERE site_id = ? AND event_type = 'error'
		  AND timestamp >= ? AND timestamp < ?
	`, siteID, dr.From, dr.To).Scan(&s.TotalErrors, &s.JSErrors, &s.PromiseErrors, &s.ResourceErrors, &s.HTTPErrors, &s.AffectedPages)
	if err != nil {
		return nil, fmt.Errorf("error overview query: %w", err)
	}

	var pageviews uint64
	_ = r.conn.QueryRow(ctx, `
		SELECT count() FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND timestamp >= ? AND timestamp < ?
	`, siteID, dr.From, dr.To).Scan(&pageviews)
	if pageviews > 0 {
		s.ErrorRate = float64(s.TotalErrors) / float64(pageviews) * 100
	}

	return &s, nil
}

type ErrorTimeseriesPoint struct {
	Time     string `json:"time"`
	JS       uint64 `json:"js"`
	Promise  uint64 `json:"promise"`
	Resource uint64 `json:"resource"`
	HTTP     uint64 `json:"http"`
}

func (r *Repository) ErrorTimeseries(ctx context.Context, siteID uint32, dr DateRange) ([]ErrorTimeseriesPoint, error) {
	query := fmt.Sprintf(`
		SELECT
			toString(toDate(toTimezone(timestamp, '%s'))) AS t,
			countIf(error_source = 'js') AS js,
			countIf(error_source = 'promise') AS promise,
			countIf(error_source = 'resource') AS resource,
			countIf(error_source = 'http') AS http
		FROM events
		WHERE site_id = ? AND event_type = 'error'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY t
		ORDER BY t
	`, r.tz)

	rows, err := r.conn.Query(ctx, query, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("error timeseries query: %w", err)
	}
	defer rows.Close()

	var result []ErrorTimeseriesPoint
	for rows.Next() {
		var p ErrorTimeseriesPoint
		if err := rows.Scan(&p.Time, &p.JS, &p.Promise, &p.Resource, &p.HTTP); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}

type ErrorGroupStat struct {
	Message  string `json:"message"`
	Source   string `json:"source"`
	Filename string `json:"filename"`
	Count    uint64 `json:"count"`
	Visitors uint64 `json:"visitors"`
	LastSeen string `json:"last_seen"`
}

func (r *Repository) ErrorGroups(ctx context.Context, siteID uint32, dr DateRange) ([]ErrorGroupStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			error_message,
			error_source,
			error_filename,
			count() AS cnt,
			uniqExact(visitor_id) AS visitors,
			toString(max(timestamp)) AS last_seen
		FROM events
		WHERE site_id = ? AND event_type = 'error'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY error_message, error_source, error_filename
		ORDER BY cnt DESC
		LIMIT 50
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("error groups query: %w", err)
	}
	defer rows.Close()

	var result []ErrorGroupStat
	for rows.Next() {
		var s ErrorGroupStat
		if err := rows.Scan(&s.Message, &s.Source, &s.Filename, &s.Count, &s.Visitors, &s.LastSeen); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

type ErrorPageStat struct {
	Pathname string `json:"pathname"`
	Total    uint64 `json:"total"`
	JS       uint64 `json:"js"`
	HTTP     uint64 `json:"http"`
}

func (r *Repository) ErrorPages(ctx context.Context, siteID uint32, dr DateRange) ([]ErrorPageStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			pathname,
			count() AS total,
			countIf(error_source = 'js') AS js,
			countIf(error_source = 'http') AS http
		FROM events
		WHERE site_id = ? AND event_type = 'error'
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY pathname
		ORDER BY total DESC
		LIMIT 30
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("error pages query: %w", err)
	}
	defer rows.Close()

	var result []ErrorPageStat
	for rows.Next() {
		var s ErrorPageStat
		if err := rows.Scan(&s.Pathname, &s.Total, &s.JS, &s.HTTP); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

// IP ranking

type IPStat struct {
	IP        string `json:"ip"`
	Pageviews uint64 `json:"pageviews"`
	Visitors  uint64 `json:"visitors"`
	Sessions  uint64 `json:"sessions"`
	Country   string `json:"country"`
	Region    string `json:"region"`
	City      string `json:"city"`
	LastSeen  string `json:"last_seen"`
}

func (r *Repository) IPRanking(ctx context.Context, siteID uint32, dr DateRange) ([]IPStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			client_ip,
			count() AS pageviews,
			uniqExact(visitor_id) AS visitors,
			uniqExact(session_id) AS sessions,
			argMax(country, timestamp) AS country,
			argMax(region, timestamp) AS region,
			argMax(city, timestamp) AS city,
			toString(max(timestamp)) AS last_seen
		FROM events
		WHERE site_id = ? AND event_type = 'pageview'
		  AND client_ip != ''
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY client_ip
		ORDER BY pageviews DESC
		LIMIT 100
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("ip ranking query: %w", err)
	}
	defer rows.Close()

	var result []IPStat
	for rows.Next() {
		var s IPStat
		if err := rows.Scan(&s.IP, &s.Pageviews, &s.Visitors, &s.Sessions, &s.Country, &s.Region, &s.City, &s.LastSeen); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

// User behavior path analytics

type EntryPageStat struct {
	Pathname string `json:"pathname"`
	Sessions uint64 `json:"sessions"`
	Visitors uint64 `json:"visitors"`
}

func (r *Repository) EntryPages(ctx context.Context, siteID uint32, dr DateRange) ([]EntryPageStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT pathname, count() AS sessions, uniqExact(visitor_id) AS visitors
		FROM (
			SELECT session_id, visitor_id, argMin(pathname, timestamp) AS pathname
			FROM events
			WHERE site_id = ? AND event_type = 'pageview'
			  AND timestamp >= ? AND timestamp < ?
			GROUP BY session_id, visitor_id
		)
		GROUP BY pathname
		ORDER BY sessions DESC
		LIMIT 30
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("entry pages query: %w", err)
	}
	defer rows.Close()

	var result []EntryPageStat
	for rows.Next() {
		var s EntryPageStat
		if err := rows.Scan(&s.Pathname, &s.Sessions, &s.Visitors); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

type ExitPageStat struct {
	Pathname string `json:"pathname"`
	Sessions uint64 `json:"sessions"`
	Visitors uint64 `json:"visitors"`
}

func (r *Repository) ExitPages(ctx context.Context, siteID uint32, dr DateRange) ([]ExitPageStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT pathname, count() AS sessions, uniqExact(visitor_id) AS visitors
		FROM (
			SELECT session_id, visitor_id, argMax(pathname, timestamp) AS pathname
			FROM events
			WHERE site_id = ? AND event_type = 'pageview'
			  AND timestamp >= ? AND timestamp < ?
			GROUP BY session_id, visitor_id
		)
		GROUP BY pathname
		ORDER BY sessions DESC
		LIMIT 30
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("exit pages query: %w", err)
	}
	defer rows.Close()

	var result []ExitPageStat
	for rows.Next() {
		var s ExitPageStat
		if err := rows.Scan(&s.Pathname, &s.Sessions, &s.Visitors); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

type PageFlowStat struct {
	FromPage string `json:"from_page"`
	ToPage   string `json:"to_page"`
	Count    uint64 `json:"count"`
}

func (r *Repository) PageFlow(ctx context.Context, siteID uint32, dr DateRange) ([]PageFlowStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT from_page, to_page, count() AS cnt
		FROM (
			SELECT
				pathname AS to_page,
				lagInFrame(pathname) OVER (PARTITION BY session_id ORDER BY timestamp) AS from_page
			FROM events
			WHERE site_id = ? AND event_type = 'pageview'
			  AND timestamp >= ? AND timestamp < ?
		)
		WHERE from_page != '' AND from_page != to_page
		GROUP BY from_page, to_page
		ORDER BY cnt DESC
		LIMIT 50
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("page flow query: %w", err)
	}
	defer rows.Close()

	var result []PageFlowStat
	for rows.Next() {
		var s PageFlowStat
		if err := rows.Scan(&s.FromPage, &s.ToPage, &s.Count); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

type PathOverviewStats struct {
	TotalSessions      uint64  `json:"total_sessions"`
	AvgPagesPerSession float64 `json:"avg_pages_per_session"`
	SinglePageSessions uint64  `json:"single_page_sessions"`
	SinglePageRate     float64 `json:"single_page_rate"`
}

func (r *Repository) PathOverview(ctx context.Context, siteID uint32, dr DateRange) (*PathOverviewStats, error) {
	var s PathOverviewStats
	err := r.conn.QueryRow(ctx, `
		SELECT
			count() AS total,
			avg(pages) AS avg_pages,
			countIf(pages = 1) AS single
		FROM (
			SELECT session_id, count() AS pages
			FROM events
			WHERE site_id = ? AND event_type = 'pageview'
			  AND timestamp >= ? AND timestamp < ?
			GROUP BY session_id
		)
	`, siteID, dr.From, dr.To).Scan(&s.TotalSessions, &s.AvgPagesPerSession, &s.SinglePageSessions)
	if err != nil {
		return nil, fmt.Errorf("path overview query: %w", err)
	}
	if s.TotalSessions > 0 {
		s.SinglePageRate = float64(s.SinglePageSessions) / float64(s.TotalSessions) * 100
	}
	return &s, nil
}

// Custom event analytics

type EventRankingStat struct {
	EventName  string  `json:"event_name"`
	Count      uint64  `json:"count"`
	Visitors   uint64  `json:"visitors"`
	AvgValue   float64 `json:"avg_value"`
	TotalValue float64 `json:"total_value"`
	LastSeen   string  `json:"last_seen"`
}

func (r *Repository) EventRanking(ctx context.Context, siteID uint32, dr DateRange) ([]EventRankingStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			event_name,
			count() AS cnt,
			uniqExact(visitor_id) AS visitors,
			avg(event_value) AS avg_value,
			sum(event_value) AS total_value,
			toString(max(timestamp)) AS last_seen
		FROM events
		WHERE site_id = ? AND event_type = 'event'
		  AND event_name != ''
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY event_name
		ORDER BY cnt DESC
		LIMIT 50
	`, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("event ranking query: %w", err)
	}
	defer rows.Close()

	var result []EventRankingStat
	for rows.Next() {
		var s EventRankingStat
		if err := rows.Scan(&s.EventName, &s.Count, &s.Visitors, &s.AvgValue, &s.TotalValue, &s.LastSeen); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

type EventTimeseriesPoint struct {
	Time  string `json:"time"`
	Name  string `json:"name"`
	Count uint64 `json:"count"`
}

func (r *Repository) EventTimeseries(ctx context.Context, siteID uint32, dr DateRange) ([]EventTimeseriesPoint, error) {
	query := fmt.Sprintf(`
		SELECT
			toString(toDate(toTimezone(timestamp, '%s'))) AS t,
			event_name,
			count() AS cnt
		FROM events
		WHERE site_id = ? AND event_type = 'event'
		  AND event_name != ''
		  AND timestamp >= ? AND timestamp < ?
		GROUP BY t, event_name
		ORDER BY t, cnt DESC
	`, r.tz)

	rows, err := r.conn.Query(ctx, query, siteID, dr.From, dr.To)
	if err != nil {
		return nil, fmt.Errorf("event timeseries query: %w", err)
	}
	defer rows.Close()

	var result []EventTimeseriesPoint
	for rows.Next() {
		var p EventTimeseriesPoint
		if err := rows.Scan(&p.Time, &p.Name, &p.Count); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}

type EventOverviewStats struct {
	TotalEvents  uint64  `json:"total_events"`
	UniqueEvents uint64  `json:"unique_events"`
	TotalValue   float64 `json:"total_value"`
	Visitors     uint64  `json:"visitors"`
}

func (r *Repository) EventOverview(ctx context.Context, siteID uint32, dr DateRange) (*EventOverviewStats, error) {
	var s EventOverviewStats
	err := r.conn.QueryRow(ctx, `
		SELECT
			count() AS total_events,
			uniqExact(event_name) AS unique_events,
			sum(event_value) AS total_value,
			uniqExact(visitor_id) AS visitors
		FROM events
		WHERE site_id = ? AND event_type = 'event'
		  AND event_name != ''
		  AND timestamp >= ? AND timestamp < ?
	`, siteID, dr.From, dr.To).Scan(&s.TotalEvents, &s.UniqueEvents, &s.TotalValue, &s.Visitors)
	if err != nil {
		return nil, fmt.Errorf("event overview query: %w", err)
	}
	return &s, nil
}
