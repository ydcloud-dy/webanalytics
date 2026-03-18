package tracking

import (
	"net/url"
	"strings"
)

type ParsedUA struct {
	Browser        string
	BrowserVersion string
	OS             string
	OSVersion      string
	DeviceType     string
}

func ParseUserAgent(ua string) ParsedUA {
	p := ParsedUA{
		Browser:    "Unknown",
		OS:         "Unknown",
		DeviceType: "desktop",
	}
	if ua == "" {
		return p
	}
	lower := strings.ToLower(ua)

	// Device type
	switch {
	case strings.Contains(lower, "bot") || strings.Contains(lower, "crawl") || strings.Contains(lower, "spider") || strings.Contains(lower, "headless"):
		p.DeviceType = "bot"
	case strings.Contains(lower, "tablet") || strings.Contains(lower, "ipad"):
		p.DeviceType = "tablet"
	case strings.Contains(lower, "mobile") || (strings.Contains(lower, "android") && !strings.Contains(lower, "tablet")):
		p.DeviceType = "mobile"
	}

	// Browser detection (order matters: more specific first)
	switch {
	case strings.Contains(ua, "Edg/"):
		p.Browser = "Edge"
		p.BrowserVersion = extractVersion(ua, "Edg/")
	case strings.Contains(ua, "OPR/") || strings.Contains(ua, "Opera"):
		p.Browser = "Opera"
		p.BrowserVersion = extractVersion(ua, "OPR/")
	case strings.Contains(ua, "Vivaldi/"):
		p.Browser = "Vivaldi"
		p.BrowserVersion = extractVersion(ua, "Vivaldi/")
	case strings.Contains(ua, "Brave"):
		p.Browser = "Brave"
	case strings.Contains(ua, "YaBrowser/"):
		p.Browser = "Yandex"
		p.BrowserVersion = extractVersion(ua, "YaBrowser/")
	case strings.Contains(ua, "Chrome/") && !strings.Contains(ua, "Chromium"):
		p.Browser = "Chrome"
		p.BrowserVersion = extractVersion(ua, "Chrome/")
	case strings.Contains(ua, "Chromium/"):
		p.Browser = "Chromium"
		p.BrowserVersion = extractVersion(ua, "Chromium/")
	case strings.Contains(ua, "Safari/") && !strings.Contains(ua, "Chrome"):
		p.Browser = "Safari"
		p.BrowserVersion = extractVersion(ua, "Version/")
	case strings.Contains(ua, "Firefox/"):
		p.Browser = "Firefox"
		p.BrowserVersion = extractVersion(ua, "Firefox/")
	case strings.Contains(lower, "msie") || strings.Contains(ua, "Trident/"):
		p.Browser = "IE"
	case strings.Contains(ua, "curl/"):
		p.Browser = "curl"
	case strings.Contains(ua, "Wget/"):
		p.Browser = "Wget"
	}

	// OS detection
	switch {
	case strings.Contains(ua, "Windows"):
		p.OS = "Windows"
		p.OSVersion = extractWindowsVersion(ua)
	case strings.Contains(ua, "Mac OS X") || strings.Contains(ua, "macOS"):
		p.OS = "macOS"
		if strings.Contains(ua, "Mac OS X ") {
			p.OSVersion = extractVersion(ua, "Mac OS X ")
		}
	case strings.Contains(ua, "Android"):
		p.OS = "Android"
		p.OSVersion = extractVersion(ua, "Android ")
	case strings.Contains(ua, "iPhone OS") || strings.Contains(ua, "iPad"):
		p.OS = "iOS"
		p.OSVersion = extractVersion(ua, "OS ")
	case strings.Contains(ua, "CrOS"):
		p.OS = "ChromeOS"
	case strings.Contains(lower, "linux"):
		p.OS = "Linux"
	case strings.Contains(lower, "freebsd"):
		p.OS = "FreeBSD"
	}

	// OS version: convert underscores to dots (e.g., "10_15_7" -> "10.15.7")
	p.OSVersion = strings.ReplaceAll(p.OSVersion, "_", ".")

	return p
}

func extractVersion(ua, prefix string) string {
	idx := strings.Index(ua, prefix)
	if idx == -1 {
		return ""
	}
	rest := ua[idx+len(prefix):]
	end := strings.IndexAny(rest, " ;)")
	if end == -1 {
		end = len(rest)
	}
	v := rest[:end]
	if dot := strings.Index(v, "."); dot > 0 {
		if dot2 := strings.Index(v[dot+1:], "."); dot2 > 0 {
			return v[:dot+1+dot2]
		}
	}
	return v
}

func extractWindowsVersion(ua string) string {
	if strings.Contains(ua, "Windows NT 10.0") {
		return "10"
	} else if strings.Contains(ua, "Windows NT 6.3") {
		return "8.1"
	} else if strings.Contains(ua, "Windows NT 6.1") {
		return "7"
	}
	return ""
}

// ClassifyReferrer categorizes referrer into channel types
func ClassifyReferrer(referrer, currentHost string) (source string) {
	if referrer == "" {
		return "direct"
	}
	u, err := url.Parse(referrer)
	if err != nil {
		return "direct"
	}
	host := strings.ToLower(u.Hostname())
	if host == "" {
		return "direct"
	}
	if host == currentHost || strings.HasSuffix(host, "."+currentHost) {
		return "internal"
	}

	searchEngines := map[string]bool{
		"google.com": true, "google.co": true, "bing.com": true,
		"yahoo.com": true, "duckduckgo.com": true, "baidu.com": true,
		"yandex.ru": true, "yandex.com": true, "sogou.com": true,
		"so.com": true, "ecosia.org": true,
	}

	socialNetworks := map[string]bool{
		"facebook.com": true, "twitter.com": true, "x.com": true,
		"linkedin.com": true, "instagram.com": true, "reddit.com": true,
		"youtube.com": true, "tiktok.com": true, "pinterest.com": true,
		"weibo.com": true, "zhihu.com": true, "douyin.com": true,
		"t.co": true, "fb.com": true,
	}

	for domain := range searchEngines {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return "search"
		}
	}
	for domain := range socialNetworks {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return "social"
		}
	}
	return "referral"
}
