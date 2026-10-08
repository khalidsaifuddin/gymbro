package activity

import (
	"fmt"
	"gorm.io/gorm"
	"time"
)

var tables = map[string]string{"workout": "workout_events", "auth": "auth_events", "sync": "sync_events"}

func EnsureMonths(db *gorm.DB, start time.Time, count int) error {
	if count < 1 || count > 24 || start.Year() < 2000 || start.Year() > 9998 {
		return fmt.Errorf("invalid partition window")
	}
	utc := start.UTC()
	first := time.Date(utc.Year(), utc.Month(), 1, 0, 0, 0, 0, time.UTC)
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`SELECT pg_advisory_xact_lock(72690112)`).Error; err != nil {
			return err
		}
		for _, parent := range []string{"workout_events", "auth_events", "sync_events"} {
			if err := tx.Exec(`LOCK TABLE log.` + parent + ` IN ACCESS EXCLUSIVE MODE`).Error; err != nil {
				return err
			}
			for i := 0; i < count; i++ {
				from := first.AddDate(0, i, 0)
				until := from.AddDate(0, 1, 0)
				child := parent + "_" + from.Format("2006_01")
				var exists bool
				if err := tx.Raw(`SELECT to_regclass(?) IS NOT NULL`, "log."+child).Scan(&exists).Error; err != nil {
					return err
				}
				if exists {
					var attached bool
					if err := tx.Raw(`SELECT EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass(?) AND inhparent=to_regclass(?))`, "log."+child, "log."+parent).Scan(&attached).Error; err != nil {
						return err
					}
					if !attached {
						return fmt.Errorf("partition name occupied by an unrelated table")
					}
					continue
				}
				temporary := "gymbro_move_" + parent
				if err := tx.Exec(`CREATE TEMP TABLE IF NOT EXISTS ` + temporary + ` (LIKE log.` + parent + ` INCLUDING DEFAULTS) ON COMMIT DROP`).Error; err != nil {
					return err
				}
				if err := tx.Exec(`WITH moved AS (DELETE FROM log.`+parent+`_default WHERE recorded_at>=? AND recorded_at<? RETURNING *) INSERT INTO pg_temp.`+temporary+` SELECT * FROM moved`, from, until).Error; err != nil {
					return err
				}
				statement := fmt.Sprintf(`CREATE TABLE log.%s PARTITION OF log.%s FOR VALUES FROM ('%s') TO ('%s')`, child, parent, from.Format(time.RFC3339), until.Format(time.RFC3339))
				if err := tx.Exec(statement).Error; err != nil {
					return err
				}
				if err := tx.Exec(`INSERT INTO log.` + parent + ` SELECT * FROM pg_temp.` + temporary).Error; err != nil {
					return err
				}
				if err := tx.Exec(`TRUNCATE pg_temp.` + temporary).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}
