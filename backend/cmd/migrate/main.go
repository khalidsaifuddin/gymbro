package main

import (
	"flag"
	"fmt"
	"github.com/khalidsaifuddin/gymbro/backend/config"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/migration"
	"os"
)

func main() {
	operation := flag.String("operation", "up", "up, status, or down-disposable")
	confirm := flag.Bool("allow-disposable", false, "allow rollback on isolated gymbro_test_ database only")
	flag.Parse()
	db, err := config.OpenDatabase()
	if err != nil {
		fmt.Fprintln(os.Stderr, "Database configuration/connection failed")
		os.Exit(1)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	switch *operation {
	case "up":
		err = migration.Up(db)
	case "down-disposable":
		if !*confirm {
			err = fmt.Errorf("explicit --allow-disposable required")
		} else {
			err = migration.DownDisposable(db)
		}
	case "status":
		var rows []struct {
			Version int
			Name    string
		}
		err = db.Raw(`SELECT version,name FROM public.schema_migrations ORDER BY version`).Scan(&rows).Error
		if err == nil {
			for _, row := range rows {
				fmt.Printf("%d %s\n", row.Version, row.Name)
			}
		}
	default:
		err = fmt.Errorf("unknown migration operation")
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "Migration failed:", err)
		os.Exit(1)
	}
	fmt.Println("Migration", *operation, "completed")
}
