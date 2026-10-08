package catalogrepo

import (
	"context"
	"github.com/khalidsaifuddin/gymbro/backend/core/repository"
	"gorm.io/gorm"
)

type Repository struct{ db *gorm.DB }

func New(db *gorm.DB) *Repository { return &Repository{db} }

type exerciseRow struct {
	ID, Slug, Name, Equipment, LoadConvention, RecognitionVersion string
	AutomaticCandidate                                            bool
}

func (r *Repository) List(ctx context.Context) ([]repository.Exercise, error) {
	rows := []exerciseRow{}
	if err := r.db.WithContext(ctx).Table("ref.exercises").Order("slug").Find(&rows).Error; err != nil {
		return nil, err
	}
	exercises := []repository.Exercise{}
	for _, row := range rows {
		assets := []repository.Asset{}
		if err := r.db.WithContext(ctx).Table("ref.exercise_assets").Where("exercise_id=?", row.ID).Order("path").Find(&assets).Error; err != nil {
			return nil, err
		}
		exercises = append(exercises, repository.Exercise{ID: row.ID, Slug: row.Slug, Name: row.Name, Equipment: row.Equipment, LoadConvention: row.LoadConvention, RecognitionVersion: row.RecognitionVersion, AutomaticCandidate: row.AutomaticCandidate, Assets: assets})
	}
	return exercises, nil
}
