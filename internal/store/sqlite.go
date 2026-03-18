package store

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	DB *sql.DB
}

func NewSQLite(path string) (*SQLiteStore, error) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create sqlite dir: %w", err)
	}

	db, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := db.PingContext(context.Background()); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)

	s := &SQLiteStore{DB: db}
	if err := s.runMigrations(); err != nil {
		return nil, err
	}
	s.ensureAdmin()
	return s, nil
}

func (s *SQLiteStore) Close() error {
	return s.DB.Close()
}

func (s *SQLiteStore) runMigrations() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS sites (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			domain TEXT NOT NULL,
			name TEXT NOT NULL,
			tracking_id TEXT UNIQUE NOT NULL,
			timezone TEXT DEFAULT 'UTC',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS site_members (
			user_id INTEGER NOT NULL,
			site_id INTEGER NOT NULL,
			role TEXT NOT NULL DEFAULT 'viewer',
			PRIMARY KEY (user_id, site_id),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
		)`,
	}
	for _, m := range migrations {
		if _, err := s.DB.Exec(m); err != nil {
			return fmt.Errorf("sqlite migration: %w", err)
		}
	}
	return nil
}

func (s *SQLiteStore) ensureAdmin() {
	const email = "admin@webanalytics.local"
	const password = "admin123"

	var id int64
	err := s.DB.QueryRow("SELECT id FROM users WHERE email = ?", email).Scan(&id)
	if err == sql.ErrNoRows {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("failed to hash admin password: %v", err)
			return
		}
		_, err = s.DB.Exec("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')", email, string(hash))
		if err != nil {
			log.Printf("failed to create admin user: %v", err)
			return
		}
		log.Println("Admin user created: admin@webanalytics.local")
	} else if err == nil {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("failed to hash admin password: %v", err)
			return
		}
		_, err = s.DB.Exec("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?", string(hash), id)
		if err != nil {
			log.Printf("failed to update admin: %v", err)
			return
		}
		log.Println("Admin user password and role ensured: admin@webanalytics.local")
	}
}
