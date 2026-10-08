package config

import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"os"
)

func OpenDatabase() (*gorm.DB, error) {
	dsn := os.Getenv("GYMBRO_DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("GYMBRO_DATABASE_URL is required")
	}
	// Never emit SQL with bound session/idempotency values into console logs.
	return gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
}
