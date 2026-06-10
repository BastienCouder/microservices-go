package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCanonicalProjectAnalysisRunRoute(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/analysis/projects/project-1/run", nil)
	if !isCanonicalProjectAnalysisRunRequest(req) {
		t.Fatal("expected canonical analysis run route to match")
	}

	legacyPath := httptest.NewRequest(http.MethodPost, "/projects/project-1/analysis/run", nil)
	if isCanonicalProjectAnalysisRunRequest(legacyPath) {
		t.Fatal("expected legacy analysis run route to be removed")
	}

	wrongMethod := httptest.NewRequest(http.MethodGet, "/analysis/projects/project-1/run", nil)
	if isCanonicalProjectAnalysisRunRequest(wrongMethod) {
		t.Fatal("expected canonical analysis run route to reject non-POST method")
	}

	wrongPath := httptest.NewRequest(http.MethodPost, "/analysis/projects/project-1/dashboard", nil)
	if isCanonicalProjectAnalysisRunRequest(wrongPath) {
		t.Fatal("expected canonical analysis run route to reject dashboard path")
	}
}
