package query

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// ExportCSV exports various data types as CSV
func (h *Handler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	siteID, err := h.getSiteID(r)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	dr := h.parseDateRange(r)
	dataType := chi.URLParam(r, "type")

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s_%s_%s.csv", dataType, dr.From.Format("20060102"), dr.To.Format("20060102")))
	// Write UTF-8 BOM for Excel compatibility
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(w)
	defer writer.Flush()

	ctx := r.Context()

	switch dataType {
	case "pages":
		data, err := h.repo.TopPages(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"页面路径", "浏览量", "访客数"})
		for _, d := range data {
			writer.Write([]string{d.Pathname, strconv.FormatUint(d.Pageviews, 10), strconv.FormatUint(d.Visitors, 10)})
		}

	case "referrers":
		data, err := h.repo.TopReferrers(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"来源", "访客数", "浏览量"})
		for _, d := range data {
			writer.Write([]string{d.Referrer, strconv.FormatUint(d.Visitors, 10), strconv.FormatUint(d.Pageviews, 10)})
		}

	case "browsers":
		data, err := h.repo.Browsers(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"浏览器", "访客数", "占比%"})
		for _, d := range data {
			writer.Write([]string{d.Browser, strconv.FormatUint(d.Visitors, 10), fmt.Sprintf("%.2f", d.Pct)})
		}

	case "devices":
		data, err := h.repo.Devices(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"设备类型", "访客数", "占比%"})
		for _, d := range data {
			writer.Write([]string{d.DeviceType, strconv.FormatUint(d.Visitors, 10), fmt.Sprintf("%.2f", d.Pct)})
		}

	case "geo":
		data, err := h.repo.Geo(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"国家", "访客数", "浏览量"})
		for _, d := range data {
			writer.Write([]string{d.Country, strconv.FormatUint(d.Visitors, 10), strconv.FormatUint(d.Pageviews, 10)})
		}

	case "ip-ranking":
		data, err := h.repo.IPRanking(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"IP地址", "浏览量", "访客数", "会话数", "国家", "地区", "城市", "最近访问"})
		for _, d := range data {
			writer.Write([]string{d.IP, strconv.FormatUint(d.Pageviews, 10), strconv.FormatUint(d.Visitors, 10), strconv.FormatUint(d.Sessions, 10), d.Country, d.Region, d.City, d.LastSeen})
		}

	case "errors":
		data, err := h.repo.ErrorGroups(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"错误信息", "类型", "文件", "次数", "影响访客", "最近发生"})
		for _, d := range data {
			writer.Write([]string{d.Message, d.Source, d.Filename, strconv.FormatUint(d.Count, 10), strconv.FormatUint(d.Visitors, 10), d.LastSeen})
		}

	case "channels":
		data, err := h.repo.Channels(ctx, siteID, dr)
		if err != nil {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
		writer.Write([]string{"渠道", "浏览量", "访客数", "占比%"})
		for _, d := range data {
			writer.Write([]string{d.Channel, strconv.FormatUint(d.Pageviews, 10), strconv.FormatUint(d.Visitors, 10), fmt.Sprintf("%.2f", d.Pct)})
		}

	default:
		http.Error(w, "unknown export type", http.StatusBadRequest)
		return
	}
}
