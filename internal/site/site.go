package site

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/ydcloud-dy/webanalytics/internal/auth"
	"github.com/ydcloud-dy/webanalytics/internal/store"
)

type Service struct {
	db      *store.SQLiteStore
	authSvc interface {
		GetUserRole(userID int64) (string, error)
	}
}

func NewService(db *store.SQLiteStore) *Service {
	return &Service{db: db}
}

func (s *Service) SetAuthService(authSvc interface {
	GetUserRole(userID int64) (string, error)
}) {
	s.authSvc = authSvc
}

type Site struct {
	ID         int64  `json:"id"`
	Domain     string `json:"domain"`
	Name       string `json:"name"`
	TrackingID string `json:"tracking_id"`
	Timezone   string `json:"timezone"`
	CreatedAt  string `json:"created_at"`
}

type CreateSiteRequest struct {
	Domain   string `json:"domain"`
	Name     string `json:"name"`
	Timezone string `json:"timezone"`
}

func (s *Service) List(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(auth.UserIDKey).(int64)

	var rows *sql.Rows
	var err error

	// Admin sees all sites, user sees only assigned sites
	if s.authSvc != nil {
		role, roleErr := s.authSvc.GetUserRole(userID)
		if roleErr == nil && role == "admin" {
			rows, err = s.db.DB.Query(`
				SELECT id, domain, name, tracking_id, timezone, created_at
				FROM sites ORDER BY created_at DESC
			`)
		}
	}
	if rows == nil && err == nil {
		rows, err = s.db.DB.Query(`
			SELECT s.id, s.domain, s.name, s.tracking_id, s.timezone, s.created_at
			FROM sites s
			JOIN site_members sm ON s.id = sm.site_id
			WHERE sm.user_id = ?
			ORDER BY s.created_at DESC
		`, userID)
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	sites := []Site{}
	for rows.Next() {
		var site Site
		if err := rows.Scan(&site.ID, &site.Domain, &site.Name, &site.TrackingID, &site.Timezone, &site.CreatedAt); err != nil {
			continue
		}
		sites = append(sites, site)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sites)
}

func (s *Service) Create(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(auth.UserIDKey).(int64)

	// Only admin can create sites
	if s.authSvc != nil {
		role, err := s.authSvc.GetUserRole(userID)
		if err != nil || role != "admin" {
			http.Error(w, "forbidden: admin access required", http.StatusForbidden)
			return
		}
	}
	var req CreateSiteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Domain == "" || req.Name == "" {
		http.Error(w, "domain and name required", http.StatusBadRequest)
		return
	}
	if req.Timezone == "" {
		req.Timezone = "UTC"
	}

	trackingID := generateTrackingID()

	tx, err := s.db.DB.Begin()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	result, err := tx.Exec("INSERT INTO sites (domain, name, tracking_id, timezone) VALUES (?, ?, ?, ?)",
		req.Domain, req.Name, trackingID, req.Timezone)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	siteID, _ := result.LastInsertId()

	if _, err := tx.Exec("INSERT INTO site_members (user_id, site_id, role) VALUES (?, ?, 'owner')", userID, siteID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	site := Site{
		ID:         siteID,
		Domain:     req.Domain,
		Name:       req.Name,
		TrackingID: trackingID,
		Timezone:   req.Timezone,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(site)
}

func (s *Service) Get(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(auth.UserIDKey).(int64)
	siteID := chi.URLParam(r, "siteId")

	var site Site
	var err error

	// Admin can access any site
	if s.authSvc != nil {
		role, roleErr := s.authSvc.GetUserRole(userID)
		if roleErr == nil && role == "admin" {
			err = s.db.DB.QueryRow(`
				SELECT id, domain, name, tracking_id, timezone, created_at
				FROM sites WHERE id = ?
			`, siteID).Scan(&site.ID, &site.Domain, &site.Name, &site.TrackingID, &site.Timezone, &site.CreatedAt)
			if err != nil {
				http.Error(w, "site not found", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(site)
			return
		}
	}

	err = s.db.DB.QueryRow(`
		SELECT s.id, s.domain, s.name, s.tracking_id, s.timezone, s.created_at
		FROM sites s
		JOIN site_members sm ON s.id = sm.site_id
		WHERE s.id = ? AND sm.user_id = ?
	`, siteID, userID).Scan(&site.ID, &site.Domain, &site.Name, &site.TrackingID, &site.Timezone, &site.CreatedAt)
	if err != nil {
		http.Error(w, "site not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(site)
}

func (s *Service) Update(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(auth.UserIDKey).(int64)
	siteID := chi.URLParam(r, "siteId")

	// Admin or owner can update
	allowed := false
	if s.authSvc != nil {
		role, err := s.authSvc.GetUserRole(userID)
		if err == nil && role == "admin" {
			allowed = true
		}
	}
	if !allowed {
		var memberRole string
		err := s.db.DB.QueryRow("SELECT role FROM site_members WHERE user_id = ? AND site_id = ?", userID, siteID).Scan(&memberRole)
		if err != nil || memberRole != "owner" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	var req CreateSiteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if _, err := s.db.DB.Exec("UPDATE sites SET domain = ?, name = ?, timezone = ? WHERE id = ?",
		req.Domain, req.Name, req.Timezone, siteID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) Delete(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(auth.UserIDKey).(int64)
	siteID := chi.URLParam(r, "siteId")

	// Only admin can delete sites
	if s.authSvc != nil {
		role, err := s.authSvc.GetUserRole(userID)
		if err != nil || role != "admin" {
			http.Error(w, "forbidden: admin access required", http.StatusForbidden)
			return
		}
	}

	if _, err := s.db.DB.Exec("DELETE FROM sites WHERE id = ?", siteID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) GetSiteIDByTrackingID(trackingID string) (uint32, error) {
	var id int64
	err := s.db.DB.QueryRow("SELECT id FROM sites WHERE tracking_id = ?", trackingID).Scan(&id)
	return uint32(id), err
}

func (s *Service) ValidateSiteAccess(userID int64, siteIDStr string) (uint32, error) {
	siteID, err := strconv.ParseUint(siteIDStr, 10, 32)
	if err != nil {
		return 0, err
	}

	// Admin can access any site
	if s.authSvc != nil {
		role, roleErr := s.authSvc.GetUserRole(userID)
		if roleErr == nil && role == "admin" {
			// Verify site exists
			var exists int
			err = s.db.DB.QueryRow("SELECT 1 FROM sites WHERE id = ?", siteID).Scan(&exists)
			if err != nil {
				return 0, err
			}
			return uint32(siteID), nil
		}
	}

	var role string
	err = s.db.DB.QueryRow("SELECT role FROM site_members WHERE user_id = ? AND site_id = ?", userID, siteID).Scan(&role)
	if err != nil {
		return 0, err
	}
	return uint32(siteID), nil
}

func generateTrackingID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return "wa_" + hex.EncodeToString(b)
}

type SiteMember struct {
	UserID    int64  `json:"user_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
}

// ListMembers returns all members of a site (admin only, called via admin routes).
func (s *Service) ListMembers(w http.ResponseWriter, r *http.Request) {
	siteID := chi.URLParam(r, "siteId")

	rows, err := s.db.DB.Query(`
		SELECT sm.user_id, u.email, sm.role
		FROM site_members sm
		JOIN users u ON u.id = sm.user_id
		WHERE sm.site_id = ?
		ORDER BY sm.user_id
	`, siteID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	members := []SiteMember{}
	for rows.Next() {
		var m SiteMember
		if err := rows.Scan(&m.UserID, &m.Email, &m.Role); err != nil {
			continue
		}
		members = append(members, m)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

type AddMemberRequest struct {
	UserID int64  `json:"user_id"`
	Role   string `json:"role"`
}

// AddMember adds a user to a site (admin only).
func (s *Service) AddMember(w http.ResponseWriter, r *http.Request) {
	siteID := chi.URLParam(r, "siteId")

	var req AddMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.UserID == 0 {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "viewer"
	}
	if req.Role != "owner" && req.Role != "viewer" {
		http.Error(w, "role must be owner or viewer", http.StatusBadRequest)
		return
	}

	_, err := s.db.DB.Exec("INSERT INTO site_members (user_id, site_id, role) VALUES (?, ?, ?)", req.UserID, siteID, req.Role)
	if err != nil {
		http.Error(w, "failed to add member (may already exist)", http.StatusConflict)
		return
	}
	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// RemoveMember removes a user from a site (admin only).
func (s *Service) RemoveMember(w http.ResponseWriter, r *http.Request) {
	siteID := chi.URLParam(r, "siteId")
	userID := chi.URLParam(r, "userId")

	result, err := s.db.DB.Exec("DELETE FROM site_members WHERE user_id = ? AND site_id = ?", userID, siteID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		http.Error(w, "member not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type BatchMemberRequest struct {
	SiteIDs []int64 `json:"site_ids"`
	UserIDs []int64 `json:"user_ids"`
	Role    string  `json:"role"`
}

// BatchAddMembers adds multiple users to multiple sites (admin only).
func (s *Service) BatchAddMembers(w http.ResponseWriter, r *http.Request) {
	var req BatchMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if len(req.SiteIDs) == 0 || len(req.UserIDs) == 0 {
		http.Error(w, "site_ids and user_ids required", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "viewer"
	}
	if req.Role != "owner" && req.Role != "viewer" {
		http.Error(w, "role must be owner or viewer", http.StatusBadRequest)
		return
	}

	tx, err := s.db.DB.Begin()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	added := 0
	skipped := 0
	for _, siteID := range req.SiteIDs {
		for _, userID := range req.UserIDs {
			result, err := tx.Exec("INSERT OR IGNORE INTO site_members (user_id, site_id, role) VALUES (?, ?, ?)", userID, siteID, req.Role)
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			n, _ := result.RowsAffected()
			if n > 0 {
				added++
			} else {
				skipped++
			}
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"added": added, "skipped": skipped})
}

type BatchRemoveRequest struct {
	SiteIDs []int64 `json:"site_ids"`
	UserIDs []int64 `json:"user_ids"`
}

// BatchRemoveMembers removes multiple users from multiple sites (admin only).
func (s *Service) BatchRemoveMembers(w http.ResponseWriter, r *http.Request) {
	var req BatchRemoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if len(req.SiteIDs) == 0 || len(req.UserIDs) == 0 {
		http.Error(w, "site_ids and user_ids required", http.StatusBadRequest)
		return
	}

	tx, err := s.db.DB.Begin()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	removed := 0
	for _, siteID := range req.SiteIDs {
		for _, userID := range req.UserIDs {
			result, err := tx.Exec("DELETE FROM site_members WHERE user_id = ? AND site_id = ?", userID, siteID)
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			n, _ := result.RowsAffected()
			removed += int(n)
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"removed": removed})
}
