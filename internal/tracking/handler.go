package tracking

import (
	"encoding/json"
	"image"
	"image/color"
	"image/gif"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// SiteResolver resolves a tracking_id string to a numeric site_id.
type SiteResolver interface {
	GetSiteIDByTrackingID(trackingID string) (uint32, error)
}

type Handler struct {
	buffer   *Buffer
	geoip    *GeoIP
	resolver SiteResolver
	loc      *time.Location
}

func NewHandler(buffer *Buffer, geoip *GeoIP, resolver SiteResolver, timezone string) *Handler {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		log.Printf("[tracking] invalid timezone %q, falling back to Local: %v", timezone, err)
		loc = time.Local
	}
	return &Handler{buffer: buffer, geoip: geoip, resolver: resolver, loc: loc}
}

type CollectPayload struct {
	SiteID       string            `json:"sid"`
	EventType    string            `json:"t"`    // pageview, event, leave
	Pathname     string            `json:"p"`
	Hostname     string            `json:"h"`
	Referrer     string            `json:"r"`
	VisitorID    string            `json:"vid"`
	SessionID    string            `json:"ssid"`
	ScreenWidth  int               `json:"sw"`
	ScreenHeight int               `json:"sh"`
	UTMSource    string            `json:"us"`
	UTMMedium    string            `json:"um"`
	UTMCampaign  string            `json:"uc"`
	UTMTerm      string            `json:"ut"`
	UTMContent   string            `json:"ux"`
	EventName    string            `json:"en"`
	EventValue   float64           `json:"ev"`
	Props        map[string]string `json:"props"`
	Duration     int               `json:"d"`
	NetworkTime    int             `json:"nt"`
	ServerTime     int             `json:"st"`
	TransferTime   int             `json:"tt"`
	DOMProcessing  int             `json:"dp"`
	DOMComplete    int             `json:"dc"`
	OnLoadTime     int             `json:"ol"`
	PageLoadTime   int               `json:"plt"`
	ErrorMessage   string            `json:"em"`
	ErrorSource    string            `json:"es"`
	ErrorStack     string            `json:"est"`
	ErrorFilename  string            `json:"ef"`
	ErrorLineno    int               `json:"el"`
	ErrorColno     int               `json:"ec"`
	HTTPStatus     int               `json:"ehs"`
	HTTPURL        string            `json:"ehu"`
}

// Collect handles POST /api/collect
func (h *Handler) Collect(w http.ResponseWriter, r *http.Request) {
	var payload CollectPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Support both numeric site_id and tracking_id (wa_xxx)
	var siteID uint64
	numID, err := strconv.ParseUint(payload.SiteID, 10, 32)
	if err == nil && numID > 0 {
		siteID = numID
	} else if payload.SiteID != "" {
		// Try to resolve tracking_id
		resolved, err := h.resolver.GetSiteIDByTrackingID(payload.SiteID)
		if err != nil || resolved == 0 {
			http.Error(w, "invalid site id", http.StatusBadRequest)
			return
		}
		siteID = uint64(resolved)
	} else {
		http.Error(w, "invalid site id", http.StatusBadRequest)
		return
	}

	if payload.EventType == "" {
		payload.EventType = "pageview"
	}

	ua := ParseUserAgent(r.UserAgent())
	if ua.DeviceType == "bot" {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	clientIP := extractIP(r)
	geo := h.geoip.Lookup(clientIP)
	refSource := ClassifyReferrer(payload.Referrer, payload.Hostname)

	// Truncate error stack to 2000 chars
	errorStack := payload.ErrorStack
	if len(errorStack) > 2000 {
		errorStack = errorStack[:2000]
	}

	event := Event{
		SiteID:         uint32(siteID),
		EventType:      payload.EventType,
		Timestamp:      time.Now().UTC(),
		SessionID:      payload.SessionID,
		VisitorID:      payload.VisitorID,
		Pathname:       payload.Pathname,
		Hostname:       payload.Hostname,
		Referrer:       payload.Referrer,
		ReferrerSource: refSource,
		UTMSource:      payload.UTMSource,
		UTMMedium:      payload.UTMMedium,
		UTMCampaign:    payload.UTMCampaign,
		UTMTerm:        payload.UTMTerm,
		UTMContent:     payload.UTMContent,
		Browser:        ua.Browser,
		BrowserVersion: ua.BrowserVersion,
		OS:             ua.OS,
		OSVersion:      ua.OSVersion,
		DeviceType:     ua.DeviceType,
		Country:        geo.Country,
		Region:         geo.Region,
		City:           geo.City,
		Lat:            geo.Lat,
		Lon:            geo.Lon,
		EventName:      payload.EventName,
		EventValue:     payload.EventValue,
		Props:          payload.Props,
		ScreenWidth:    uint16(payload.ScreenWidth),
		ScreenHeight:   uint16(payload.ScreenHeight),
		Duration:       uint32(payload.Duration),
		NetworkTime:    uint32(payload.NetworkTime),
		ServerTime:     uint32(payload.ServerTime),
		TransferTime:   uint32(payload.TransferTime),
		DOMProcessing:  uint32(payload.DOMProcessing),
		DOMComplete:    uint32(payload.DOMComplete),
		OnLoadTime:     uint32(payload.OnLoadTime),
		PageLoadTime:   uint32(payload.PageLoadTime),
		ErrorMessage:   payload.ErrorMessage,
		ErrorSource:    payload.ErrorSource,
		ErrorStack:     errorStack,
		ErrorFilename:  payload.ErrorFilename,
		ErrorLineno:    uint32(payload.ErrorLineno),
		ErrorColno:     uint32(payload.ErrorColno),
		HTTPStatus:     uint16(payload.HTTPStatus),
		HTTPURL:        payload.HTTPURL,
	}

	h.buffer.Add(event)
	w.WriteHeader(http.StatusAccepted)
}

// Pixel handles GET /api/collect (1x1 transparent gif fallback)
func (h *Handler) Pixel(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	sid := q.Get("sid")
	var siteID uint64
	if numID, err := strconv.ParseUint(sid, 10, 32); err == nil && numID > 0 {
		siteID = numID
	} else if sid != "" {
		if resolved, err := h.resolver.GetSiteIDByTrackingID(sid); err == nil && resolved > 0 {
			siteID = uint64(resolved)
		}
	}
	if siteID == 0 {
		h.sendPixel(w)
		return
	}

	ua := ParseUserAgent(r.UserAgent())
	clientIP := extractIP(r)
	geo := h.geoip.Lookup(clientIP)

	hostname := q.Get("h")
	event := Event{
		SiteID:         uint32(siteID),
		EventType:      "pageview",
		Timestamp:      time.Now().UTC(),
		SessionID:      q.Get("ssid"),
		VisitorID:      q.Get("vid"),
		Pathname:       q.Get("p"),
		Hostname:       hostname,
		Referrer:       q.Get("r"),
		ReferrerSource: ClassifyReferrer(q.Get("r"), hostname),
		Browser:        ua.Browser,
		BrowserVersion: ua.BrowserVersion,
		OS:             ua.OS,
		OSVersion:      ua.OSVersion,
		DeviceType:     ua.DeviceType,
		Country:        geo.Country,
		Region:         geo.Region,
		City:           geo.City,
		Lat:            geo.Lat,
		Lon:            geo.Lon,
	}

	h.buffer.Add(event)
	h.sendPixel(w)
}

func (h *Handler) sendPixel(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	img := image.NewPaletted(image.Rect(0, 0, 1, 1), []color.Color{color.Transparent})
	if err := gif.Encode(w, img, nil); err != nil {
		log.Printf("[tracking] pixel encode error: %v", err)
	}
}

func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.SplitN(xff, ",", 2)
		ip := strings.TrimSpace(parts[0])
		if net.ParseIP(ip) != nil {
			return ip
		}
	}
	if xri := r.Header.Get("X-Real-Ip"); xri != "" {
		if net.ParseIP(xri) != nil {
			return xri
		}
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	// For local/private IPs, use a fallback public IP for GeoIP testing
	if isPrivateIP(host) {
		if fallback := os.Getenv("GEOIP_DEFAULT_IP"); fallback != "" {
			return fallback
		}
	}
	return host
}

func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
		return true
	}
	return false
}
