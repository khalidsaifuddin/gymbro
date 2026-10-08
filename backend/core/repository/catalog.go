package repository

import "context"

type Exercise struct {
	ID                 string  `json:"id"`
	Slug               string  `json:"slug"`
	Name               string  `json:"name"`
	Equipment          string  `json:"equipment"`
	LoadConvention     string  `json:"load_convention"`
	RecognitionVersion string  `json:"recognition_version"`
	AutomaticCandidate bool    `json:"automatic_candidate"`
	Assets             []Asset `json:"assets"`
}
type Asset struct {
	Path        string `json:"path"`
	License     string `json:"license"`
	Attribution string `json:"attribution"`
	SourceURL   string `json:"source_url"`
	SHA256      string `json:"sha256"`
}
type Catalog interface {
	List(context.Context) ([]Exercise, error)
}
