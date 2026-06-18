package usecase

import "testing"

func TestPerceptionMetricsRequireBrandCanonContext(t *testing.T) {
	metrics := buildPerceptionResponseMetrics(AIResponse{
		RawResponse:    "Fury est cite comme une option interessante avec une perception positive. Source: https://fury.example",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://fury.example"},
		Sentiment:      "positive",
	}, BrandCanon{BrandName: "Fury"}, nil)

	if metrics.positioning > 35 {
		t.Fatalf("expected positioning to be capped without category/positioning context, got %d", metrics.positioning)
	}
	if metrics.useCases != 0 {
		t.Fatalf("expected missing use cases to score 0, got %d", metrics.useCases)
	}
	if metrics.features != 0 {
		t.Fatalf("expected missing features to score 0, got %d", metrics.features)
	}
	if metrics.competitors != 0 {
		t.Fatalf("expected missing competitors to score 0, got %d", metrics.competitors)
	}
}

func TestPerceptionBrandReadinessCapturesMissingContext(t *testing.T) {
	readiness := buildPerceptionBrandReadiness(BrandCanon{BrandName: "Fury"}, nil)

	if readiness.score >= 40 {
		t.Fatalf("expected low readiness for brand-name-only canon, got %d", readiness.score)
	}
	if readiness.cap != 35 {
		t.Fatalf("expected low-readiness cap of 35, got %d", readiness.cap)
	}
	if readiness.axisStatus["competitors"] != "not_configured" {
		t.Fatalf("expected competitors to be not_configured, got %q", readiness.axisStatus["competitors"])
	}
	if readiness.axisStatus["use_cases"] != "missing_context" {
		t.Fatalf("expected use_cases to be missing_context, got %q", readiness.axisStatus["use_cases"])
	}
}

func TestPerceptionCompetitorsScoreDifferentiatesMentionFromCompetitiveLoss(t *testing.T) {
	canon := BrandCanon{
		BrandName:   "Nike",
		Category:    "Chaussures de running",
		Positioning: "Marque performance et lifestyle",
		UseCases:    []string{"running quotidien"},
		Features:    []string{"amorti"},
	}
	competitors := []string{"Adidas", "ASICS"}

	mentionedCompetitor := buildPerceptionResponseMetrics(AIResponse{
		RawResponse:    "Nike est une reference pour le running quotidien avec amorti et une execution solide. Adidas est aussi citee sur certains segments. Source: https://www.nike.com/running",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://www.nike.com/running"},
		Sentiment:      "positive",
	}, canon, competitors)

	leadingCompetitor := buildPerceptionResponseMetrics(AIResponse{
		RawResponse:    "Adidas reste devant Nike sur le running quotidien et devient la meilleure option pour la plupart des acheteurs. Source: https://www.nike.com/running",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://www.nike.com/running"},
		Sentiment:      "neutral",
	}, canon, competitors)

	if mentionedCompetitor.competitors < 90 {
		t.Fatalf("expected a lightly-cited competitor to keep a strong competitors score, got %d", mentionedCompetitor.competitors)
	}
	if leadingCompetitor.competitors >= 60 {
		t.Fatalf("expected a leading competitor to significantly reduce the competitors score, got %d", leadingCompetitor.competitors)
	}
	if mentionedCompetitor.competitors-leadingCompetitor.competitors < 25 {
		t.Fatalf(
			"expected a clear gap between mention-only and competitive-loss responses, got mention=%d lead=%d",
			mentionedCompetitor.competitors,
			leadingCompetitor.competitors,
		)
	}
}
