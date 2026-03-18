package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
	"github.com/golang-jwt/jwt/v5"
	"github.com/ydcloud-dy/webanalytics/internal/store"
)

type contextKey string

const UserIDKey contextKey = "userID"

type Service struct {
	db        *store.SQLiteStore
	jwtSecret []byte
}

func NewService(db *store.SQLiteStore, secret string) *Service {
	return &Service{db: db, jwtSecret: []byte(secret)}
}

type Credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type TokenResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expires_at"`
}

func (s *Service) Register(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "public registration is disabled", http.StatusForbidden)
}

func (s *Service) Login(w http.ResponseWriter, r *http.Request) {
	var cred Credentials
	if err := json.NewDecoder(r.Body).Decode(&cred); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var userID int64
	var passwordHash string
	err := s.db.DB.QueryRow("SELECT id, password_hash FROM users WHERE email = ?", cred.Email).Scan(&userID, &passwordHash)
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(cred.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, expiresAt, err := s.generateToken(userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TokenResponse{Token: token, ExpiresAt: expiresAt})
}

func (s *Service) Refresh(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int64)
	token, expiresAt, err := s.generateToken(userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TokenResponse{Token: token, ExpiresAt: expiresAt})
}

func (s *Service) generateToken(userID int64) (string, int64, error) {
	expiresAt := time.Now().Add(72 * time.Hour)
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": expiresAt.Unix(),
		"iat": time.Now().Unix(),
		"jti": generateJTI(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	return signed, expiresAt.Unix(), err
}

func (s *Service) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			// Support token via query param for file downloads (e.g. CSV export)
			if qToken := r.URL.Query().Get("token"); qToken != "" {
				authHeader = "Bearer " + qToken
			}
		}
		if authHeader == "" {
			http.Error(w, "authorization required", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader {
			http.Error(w, "invalid authorization format", http.StatusUnauthorized)
			return
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return s.jwtSecret, nil
		})
		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "invalid token claims", http.StatusUnauthorized)
			return
		}

		sub, ok := claims["sub"].(float64)
		if !ok {
			http.Error(w, "invalid token subject", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, int64(sub))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func generateJTI() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// GetUserRole returns the role for a given user ID.
func (s *Service) GetUserRole(userID int64) (string, error) {
	var role string
	err := s.db.DB.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&role)
	return role, err
}

// AdminMiddleware checks that the current user has admin role.
func (s *Service) AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Context().Value(UserIDKey).(int64)
		role, err := s.GetUserRole(userID)
		if err != nil || role != "admin" {
			http.Error(w, "forbidden: admin access required", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type UserInfo struct {
	ID        int64  `json:"id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
}

// Me returns the current user's info.
func (s *Service) Me(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int64)
	var u UserInfo
	err := s.db.DB.QueryRow("SELECT id, email, role, created_at FROM users WHERE id = ?", userID).Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

// ListUsers returns all users (admin only).
func (s *Service) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.DB.Query("SELECT id, email, role, created_at FROM users ORDER BY id")
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []UserInfo{}
	for rows.Next() {
		var u UserInfo
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt); err != nil {
			continue
		}
		users = append(users, u)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

type CreateUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// CreateUser creates a new user (admin only).
func (s *Service) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password required", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		http.Error(w, "password must be at least 8 characters", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}
	if req.Role != "admin" && req.Role != "user" {
		http.Error(w, "role must be admin or user", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	result, err := s.db.DB.Exec("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)", req.Email, string(hash), req.Role)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, "email already registered", http.StatusConflict)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	userID, _ := result.LastInsertId()
	u := UserInfo{ID: userID, Email: req.Email, Role: req.Role}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

// DeleteUser deletes a user (admin only).
func (s *Service) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	currentUserID := r.Context().Value(UserIDKey).(int64)

	if fmt.Sprintf("%d", currentUserID) == userID {
		http.Error(w, "cannot delete yourself", http.StatusBadRequest)
		return
	}

	result, err := s.db.DB.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type UpdateUserRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

// UpdateUser updates a user's email and/or role (admin only).
func (s *Service) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Email == "" {
		http.Error(w, "email required", http.StatusBadRequest)
		return
	}
	if req.Role != "" && req.Role != "admin" && req.Role != "user" {
		http.Error(w, "role must be admin or user", http.StatusBadRequest)
		return
	}

	if req.Role != "" {
		result, err := s.db.DB.Exec("UPDATE users SET email = ?, role = ? WHERE id = ?", req.Email, req.Role, userID)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				http.Error(w, "email already in use", http.StatusConflict)
				return
			}
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
	} else {
		result, err := s.db.DB.Exec("UPDATE users SET email = ? WHERE id = ?", req.Email, userID)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				http.Error(w, "email already in use", http.StatusConflict)
				return
			}
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

type ResetPasswordRequest struct {
	Password string `json:"password"`
}

// ResetPassword resets a user's password (admin only).
func (s *Service) ResetPassword(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")

	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Password == "" {
		http.Error(w, "password required", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		http.Error(w, "password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	result, err := s.db.DB.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hash), userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
