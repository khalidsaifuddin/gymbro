package main

import (
	"flag"
	"fmt"
	"github.com/khalidsaifuddin/gymbro/backend/config"
	"github.com/khalidsaifuddin/gymbro/backend/pkg/activity"
	"os"
	"time"
)

func main() {
	month := flag.String("month", time.Now().UTC().Format("2006-01"), "first UTC month YYYY-MM")
	count := flag.Int("count", 2, "number of months to prepare, 1-24")
	flag.Parse()
	start, err := time.Parse("2006-01", *month)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Invalid month")
		os.Exit(1)
	}
	db, err := config.OpenDatabase()
	if err != nil {
		fmt.Fprintln(os.Stderr, "Database configuration/connection failed")
		os.Exit(1)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	if err := activity.EnsureMonths(db, start, *count); err != nil {
		fmt.Fprintln(os.Stderr, "Partition maintenance failed:", err)
		os.Exit(1)
	}
	fmt.Println("Prepared", *count, "UTC months from", *month, "; no retention deletion performed")
}
