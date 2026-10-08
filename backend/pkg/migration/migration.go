package migration

import (
	"crypto/sha256"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

//go:embed sql/*.sql
var scripts embed.FS

const lockID int64 = 72690111

func Up(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`SELECT pg_advisory_xact_lock(?)`, lockID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`CREATE TABLE IF NOT EXISTS public.schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`).Error; err != nil {
			return err
		}
		files, err := fs.Glob(scripts, "sql/*.up.sql")
		if err != nil {
			return err
		}
		sort.Strings(files)
		for _, file := range files {
			version, _ := strconv.Atoi(strings.Split(strings.TrimPrefix(file, "sql/"), "_")[0])
			body, err := scripts.ReadFile(file)
			if err != nil {
				return err
			}
			hash := fmt.Sprintf("%x", sha256.Sum256(body))
			var existing []struct{ SHA256 string }
			if err := tx.Raw(`SELECT sha256 FROM public.schema_migrations WHERE version=?`, version).Scan(&existing).Error; err != nil {
				return err
			}
			if len(existing) > 0 {
				if existing[0].SHA256 != hash {
					return fmt.Errorf("migration %d checksum changed", version)
				}
				continue
			}
			if err := tx.Exec(string(body)).Error; err != nil {
				return fmt.Errorf("migration %d: %w", version, err)
			}
			if err := tx.Exec(`INSERT INTO public.schema_migrations(version,name,sha256) VALUES(?,?,?)`, version, file, hash).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
func DownDisposable(db *gorm.DB) error {
	var name string
	if err := db.Raw(`SELECT current_database()`).Scan(&name).Error; err != nil {
		return err
	}
	if !strings.HasPrefix(name, "gymbro_test_") {
		return fmt.Errorf("rollback allowed only on isolated gymbro_test_ databases")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`SELECT pg_advisory_xact_lock(?)`, lockID).Error; err != nil {
			return err
		}
		var versions []int
		if err := tx.Raw(`SELECT version FROM public.schema_migrations ORDER BY version DESC`).Scan(&versions).Error; err != nil {
			return err
		}
		files, _ := fs.Glob(scripts, "sql/*.down.sql")
		for _, version := range versions {
			found := false
			for _, file := range files {
				n, _ := strconv.Atoi(strings.Split(strings.TrimPrefix(file, "sql/"), "_")[0])
				if n != version {
					continue
				}
				found = true
				body, err := scripts.ReadFile(file)
				if err != nil {
					return err
				}
				if err := tx.Exec(string(body)).Error; err != nil {
					return err
				}
			}
			if !found {
				return fmt.Errorf("missing rollback migration %d", version)
			}
			if err := tx.Exec(`DELETE FROM public.schema_migrations WHERE version=?`, version).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
