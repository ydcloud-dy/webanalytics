package tracking

import (
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/oschwald/geoip2-golang"
)

type GeoIP struct {
	reader *geoip2.Reader
	// cached public IP for local development
	publicIP     string
	publicIPOnce sync.Once
}

type GeoResult struct {
	Country string
	Region  string
	City    string
	Lat     float64
	Lon     float64
}

func NewGeoIP(path, defaultIP string) *GeoIP {
	if path == "" {
		log.Println("[geoip] no database path configured (set GEOIP_PATH), geo features disabled")
		return &GeoIP{}
	}
	reader, err := geoip2.Open(path)
	if err != nil {
		log.Printf("[geoip] failed to open database: %v", err)
		return &GeoIP{}
	}
	log.Printf("[geoip] loaded database: %s", path)
	g := &GeoIP{reader: reader}
	// Pre-set default IP from config if provided
	if defaultIP != "" && net.ParseIP(defaultIP) != nil {
		g.publicIP = defaultIP
		g.publicIPOnce.Do(func() {}) // mark as resolved
		log.Printf("[geoip] using configured default IP: %s", defaultIP)
	}
	return g
}

// detectPublicIP fetches the server's public IP for local dev fallback
func (g *GeoIP) detectPublicIP() string {
	g.publicIPOnce.Do(func() {
		// First check GEOIP_DEFAULT_IP env var
		if envIP := os.Getenv("GEOIP_DEFAULT_IP"); envIP != "" {
			if net.ParseIP(envIP) != nil {
				g.publicIP = envIP
				log.Printf("[geoip] using GEOIP_DEFAULT_IP: %s", envIP)
				return
			}
		}
		client := &http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get("https://api.ipify.org")
		if err != nil {
			log.Printf("[geoip] failed to detect public IP: %v", err)
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Printf("[geoip] failed to read public IP response: %v", err)
			return
		}
		ip := strings.TrimSpace(string(body))
		if net.ParseIP(ip) != nil {
			g.publicIP = ip
			log.Printf("[geoip] detected public IP for local fallback: %s", ip)
		}
	})
	return g.publicIP
}

func (g *GeoIP) Lookup(ipStr string) GeoResult {
	if g.reader == nil {
		return GeoResult{}
	}
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return GeoResult{}
	}
	// For private/loopback IPs, try using the server's public IP
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
		pubIP := g.detectPublicIP()
		if pubIP != "" {
			ip = net.ParseIP(pubIP)
		} else {
			log.Printf("[geoip] private IP %s and no public IP available, skipping geo", ipStr)
			return GeoResult{}
		}
	}
	record, err := g.reader.City(ip)
	if err != nil {
		log.Printf("[geoip] lookup error for %s: %v", ip.String(), err)
		return GeoResult{}
	}
	r := GeoResult{
		Lat: record.Location.Latitude,
		Lon: record.Location.Longitude,
	}
	// Prefer Chinese name, fall back to English
	if name, ok := record.Country.Names["zh-CN"]; ok {
		r.Country = name
	} else if name, ok := record.Country.Names["en"]; ok {
		r.Country = name
	}
	if len(record.Subdivisions) > 0 {
		if name, ok := record.Subdivisions[0].Names["zh-CN"]; ok {
			r.Region = name
		} else if name, ok := record.Subdivisions[0].Names["en"]; ok {
			r.Region = name
		}
	}
	if name, ok := record.City.Names["zh-CN"]; ok {
		r.City = name
	} else if name, ok := record.City.Names["en"]; ok {
		r.City = name
	}
	return r
}

func (g *GeoIP) Close() {
	if g.reader != nil {
		g.reader.Close()
	}
}
