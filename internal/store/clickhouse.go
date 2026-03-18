package store

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type ClickHouseStore struct {
	Conn driver.Conn
}

func NewClickHouse(dsn string) (*ClickHouseStore, error) {
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse clickhouse dsn: %w", err)
	}
	opts.MaxOpenConns = 10
	opts.MaxIdleConns = 5
	opts.ConnMaxLifetime = 10 * time.Minute

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return nil, fmt.Errorf("open clickhouse: %w", err)
	}
	if err := conn.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("ping clickhouse: %w", err)
	}
	return &ClickHouseStore{Conn: conn}, nil
}

func (s *ClickHouseStore) Close() error {
	return s.Conn.Close()
}

func (s *ClickHouseStore) RunMigrations(ctx context.Context) error {
	queries := []string{
		createEventsTable,
		createDailyStatsMV,
		createHourlyStatsMV,
		createChannelStatsMV,
		createGeoStatsMV,
	}
	for _, q := range queries {
		if err := s.Conn.Exec(ctx, q); err != nil {
			return fmt.Errorf("migration: %w", err)
		}
	}
	// Alter existing column timezone from UTC to Asia/Shanghai
	// This reinterprets stored epoch values in the correct timezone
	// Safe to run multiple times - idempotent
	s.Conn.Exec(ctx, `ALTER TABLE events MODIFY COLUMN timestamp DateTime64(3, 'Asia/Shanghai')`)

	// Add performance timing columns (idempotent)
	perfCols := []string{
		"network_time UInt32 DEFAULT 0",
		"server_time UInt32 DEFAULT 0",
		"transfer_time UInt32 DEFAULT 0",
		"dom_processing UInt32 DEFAULT 0",
		"dom_complete UInt32 DEFAULT 0",
		"on_load_time UInt32 DEFAULT 0",
		"page_load_time UInt32 DEFAULT 0",
	}
	for _, col := range perfCols {
		s.Conn.Exec(ctx, "ALTER TABLE events ADD COLUMN IF NOT EXISTS "+col)
	}

	// Add error tracking columns (idempotent)
	errorCols := []string{
		"error_message String DEFAULT ''",
		"error_source LowCardinality(String) DEFAULT ''",
		"error_stack String DEFAULT ''",
		"error_filename String DEFAULT ''",
		"error_lineno UInt32 DEFAULT 0",
		"error_colno UInt32 DEFAULT 0",
		"http_status UInt16 DEFAULT 0",
		"http_url String DEFAULT ''",
		"client_ip String DEFAULT ''",
	}
	for _, col := range errorCols {
		s.Conn.Exec(ctx, "ALTER TABLE events ADD COLUMN IF NOT EXISTS "+col)
	}
	return nil
}

const createEventsTable = `
CREATE TABLE IF NOT EXISTS events (
    site_id       UInt32,
    event_type    LowCardinality(String),
    timestamp     DateTime64(3, 'Asia/Shanghai'),
    session_id    String,
    visitor_id    String,
    pathname      String,
    hostname      String,
    referrer      String,
    referrer_source LowCardinality(String),
    utm_source    String DEFAULT '',
    utm_medium    String DEFAULT '',
    utm_campaign  String DEFAULT '',
    utm_term      String DEFAULT '',
    utm_content   String DEFAULT '',
    browser       LowCardinality(String),
    browser_version String DEFAULT '',
    os            LowCardinality(String),
    os_version    String DEFAULT '',
    device_type   LowCardinality(String),
    country       LowCardinality(String) DEFAULT '',
    region        String DEFAULT '',
    city          String DEFAULT '',
    lat           Float64 DEFAULT 0,
    lon           Float64 DEFAULT 0,
    event_name    String DEFAULT '',
    event_value   Float64 DEFAULT 0,
    props         Map(String, String),
    screen_width  UInt16 DEFAULT 0,
    screen_height UInt16 DEFAULT 0,
    duration      UInt32 DEFAULT 0,
    network_time   UInt32 DEFAULT 0,
    server_time    UInt32 DEFAULT 0,
    transfer_time  UInt32 DEFAULT 0,
    dom_processing UInt32 DEFAULT 0,
    dom_complete   UInt32 DEFAULT 0,
    on_load_time   UInt32 DEFAULT 0,
    page_load_time UInt32 DEFAULT 0,
    error_message  String DEFAULT '',
    error_source   LowCardinality(String) DEFAULT '',
    error_stack    String DEFAULT '',
    error_filename String DEFAULT '',
    error_lineno   UInt32 DEFAULT 0,
    error_colno    UInt32 DEFAULT 0,
    http_status    UInt16 DEFAULT 0,
    http_url       String DEFAULT '',
    client_ip      String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (site_id, event_type, timestamp, visitor_id)
TTL toDateTime(timestamp) + INTERVAL 2 YEAR
`

const createDailyStatsMV = `
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (site_id, day)
AS SELECT
    site_id,
    toDate(timestamp) AS day,
    count() AS pageviews,
    uniqExact(visitor_id) AS visitors,
    uniqExact(session_id) AS sessions,
    sum(duration) AS total_duration
FROM events
WHERE event_type = 'pageview'
GROUP BY site_id, day
`

const createHourlyStatsMV = `
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (site_id, hour)
AS SELECT
    site_id,
    toStartOfHour(timestamp) AS hour,
    count() AS pageviews,
    uniqExact(visitor_id) AS visitors,
    uniqExact(session_id) AS sessions
FROM events
WHERE event_type = 'pageview'
GROUP BY site_id, hour
`

const createChannelStatsMV = `
CREATE MATERIALIZED VIEW IF NOT EXISTS channel_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (site_id, day, referrer_source)
AS SELECT
    site_id,
    toDate(timestamp) AS day,
    referrer_source,
    count() AS pageviews,
    uniqExact(visitor_id) AS visitors,
    uniqExact(session_id) AS sessions
FROM events
WHERE event_type = 'pageview'
GROUP BY site_id, day, referrer_source
`

const createGeoStatsMV = `
CREATE MATERIALIZED VIEW IF NOT EXISTS geo_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (site_id, day, country)
AS SELECT
    site_id,
    toDate(timestamp) AS day,
    country,
    count() AS pageviews,
    uniqExact(visitor_id) AS visitors
FROM events
WHERE event_type = 'pageview'
GROUP BY site_id, day, country
`
