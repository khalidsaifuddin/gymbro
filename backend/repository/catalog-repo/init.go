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
type assetRow struct {
	ExerciseID, Path, License, Attribution, SourceURL, SHA256 string
}

func (r *Repository) List(ctx context.Context) ([]repository.Exercise, error) {
	rows := []exerciseRow{}
	if err := r.db.WithContext(ctx).Table("ref.exercises").Order("slug").Find(&rows).Error; err != nil {
		return nil, err
	}
	assetRows := []assetRow{}
	if err := r.db.WithContext(ctx).Table("ref.exercise_assets").Order("exercise_id,path").Find(&assetRows).Error; err != nil {
		return nil, err
	}
	assetsByExercise := make(map[string][]repository.Asset, len(assetRows))
	for _, asset := range assetRows {
		assetsByExercise[asset.ExerciseID] = append(assetsByExercise[asset.ExerciseID], repository.Asset{
			Path: asset.Path, License: asset.License, Attribution: asset.Attribution,
			SourceURL: asset.SourceURL, SHA256: asset.SHA256,
		})
	}
	exercises := make([]repository.Exercise, 0, len(rows))
	for _, row := range rows {
		assets := assetsByExercise[row.ID]
		if assets == nil {
			assets = []repository.Asset{}
		}
		exercises = append(exercises, repository.Exercise{ID: row.ID, Slug: row.Slug, Name: row.Name, Equipment: row.Equipment, LoadConvention: row.LoadConvention, RecognitionVersion: row.RecognitionVersion, AutomaticCandidate: row.AutomaticCandidate, Assets: assets})
	}
	return exercises, nil
}
