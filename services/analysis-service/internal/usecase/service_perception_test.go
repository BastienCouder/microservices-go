package usecase

import "testing"

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
