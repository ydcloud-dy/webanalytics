package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

// yamlConfig mirrors the YAML structure
type yamlConfig struct {
	Server struct {
		Port         string `yaml:"port"`
		CORSAllowAll bool   `yaml:"cors_allow_all"`
	} `yaml:"server"`

	Database struct {
		ClickHouseDSN string `yaml:"clickhouse_dsn"`
		SQLitePath    string `yaml:"sqlite_path"`
	} `yaml:"database"`

	Redis struct {
		Addr     string `yaml:"addr"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	} `yaml:"redis"`

	Auth struct {
		JWTSecret string `yaml:"jwt_secret"`
	} `yaml:"auth"`

	Tracking struct {
		BufferSize      int    `yaml:"buffer_size"`
		FlushIntervalSec int   `yaml:"flush_interval_sec"`
		GeoIPPath       string `yaml:"geoip_path"`
		GeoIPDefaultIP  string `yaml:"geoip_default_ip"`
	} `yaml:"tracking"`

	Timezone string `yaml:"timezone"`
}

type Config struct {
	Port           string
	ClickHouseDSN  string
	SQLitePath     string
	JWTSecret      string
	GeoIPPath      string
	GeoIPDefaultIP string
	BufferSize     int
	FlushInterval  time.Duration
	CORSAllowAll   bool
	Timezone       string

	// Redis
	RedisAddr     string
	RedisPassword string
	RedisDB       int
}

// configSearchPaths defines where to look for config.yaml
var configSearchPaths = []string{
	"config/config.yaml",
	"config.yaml",
	"/etc/webanalytics/config.yaml",
}

func Load() *Config {
	yc := loadYAML()

	return &Config{
		Port:           envOr("PORT", yc.Server.Port, "7777"),
		ClickHouseDSN:  envOr("CLICKHOUSE_DSN", yc.Database.ClickHouseDSN, "clickhouse://default:@localhost:9000/webanalytics"),
		SQLitePath:     envOr("SQLITE_PATH", yc.Database.SQLitePath, "data/webanalytics.db"),
		JWTSecret:      envOr("JWT_SECRET", yc.Auth.JWTSecret, "change-me-in-production"),
		GeoIPPath:      envOr("GEOIP_PATH", yc.Tracking.GeoIPPath, ""),
		GeoIPDefaultIP: envOr("GEOIP_DEFAULT_IP", yc.Tracking.GeoIPDefaultIP, ""),
		BufferSize:     envOrInt("BUFFER_SIZE", yc.Tracking.BufferSize, 5000),
		FlushInterval:  time.Duration(envOrInt("FLUSH_INTERVAL_SEC", yc.Tracking.FlushIntervalSec, 5)) * time.Second,
		CORSAllowAll:   envOrBool("CORS_ALLOW_ALL", yc.Server.CORSAllowAll, true),
		Timezone:       envOr("TZ", yc.Timezone, "Asia/Shanghai"),

		RedisAddr:     envOr("REDIS_ADDR", yc.Redis.Addr, "localhost:6379"),
		RedisPassword: envOr("REDIS_PASSWORD", yc.Redis.Password, ""),
		RedisDB:       envOrInt("REDIS_DB", yc.Redis.DB, 0),
	}
}

// loadYAML tries to read config.yaml from known paths
func loadYAML() yamlConfig {
	var yc yamlConfig

	// Allow explicit path via env var
	if p := os.Getenv("CONFIG_PATH"); p != "" {
		if data, err := os.ReadFile(p); err == nil {
			if err := yaml.Unmarshal(data, &yc); err != nil {
				log.Printf("[config] failed to parse %s: %v", p, err)
			} else {
				log.Printf("[config] loaded config from %s", p)
				return yc
			}
		}
	}

	// Search default paths
	for _, p := range configSearchPaths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		if err := yaml.Unmarshal(data, &yc); err != nil {
			log.Printf("[config] failed to parse %s: %v", p, err)
			continue
		}
		log.Printf("[config] loaded config from %s", p)
		return yc
	}

	log.Println("[config] no config.yaml found, using env vars and defaults")
	return yc
}

// envOr returns: env var > yaml value > fallback
func envOr(envKey, yamlVal, fallback string) string {
	if v := os.Getenv(envKey); v != "" {
		return v
	}
	if yamlVal != "" {
		return yamlVal
	}
	return fallback
}

// envOrInt returns: env var > yaml value (if non-zero) > fallback
func envOrInt(envKey string, yamlVal, fallback int) int {
	if v := os.Getenv(envKey); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	if yamlVal != 0 {
		return yamlVal
	}
	return fallback
}

// envOrBool returns: env var > yaml value > fallback
func envOrBool(envKey string, yamlVal, fallback bool) bool {
	if v := os.Getenv(envKey); v != "" {
		return v == "true" || v == "1" || v == "yes"
	}
	// If yaml was explicitly parsed, use its value
	// (we can't distinguish "false" from "not set" for bool, so yaml always wins if file was loaded)
	return yamlVal || fallback
}
