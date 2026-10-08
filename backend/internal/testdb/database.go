// Package testdb creates isolated disposable PostgreSQL databases for integration tests.
package testdb

import (
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func New(t *testing.T) *gorm.DB {
	t.Helper()
	raw := os.Getenv("GYMBRO_TEST_DATABASE_URL")
	u, err := url.Parse(raw)
	if err != nil || u == nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Path != "/gymbro_test" || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Fatal("GYMBRO_TEST_DATABASE_URL must target disposable gymbro_test on localhost")
	}
	open := func(dsn string) *gorm.DB {
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
		if err != nil {
			t.Fatal("test database connection failed:", err)
		}
		return db
	}
	admin := open(raw)
	name := "gymbro_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := admin.Exec(`CREATE DATABASE "` + name + `"`).Error; err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + name
	db := open(u.String())
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
		if err := admin.Exec(`DROP DATABASE "` + name + `" WITH (FORCE)`).Error; err != nil {
			t.Error(err)
		}
		sqlAdmin, _ := admin.DB()
		_ = sqlAdmin.Close()
	})
	return db
}
