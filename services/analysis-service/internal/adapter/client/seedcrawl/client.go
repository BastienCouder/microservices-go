package seedcrawl

import (
	"context"
	"strings"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

const NikeSeedJobID = "seed-crawl-nike"

type NikeCrawler struct {
	records       []usecase.ContentOptimizerCrawlRecord
	activeRecords []usecase.ContentOptimizerCrawlRecord
}

func NewNikeCrawler() *NikeCrawler {
	records := nikeSeedRecords()
	return &NikeCrawler{
		records:       records,
		activeRecords: append([]usecase.ContentOptimizerCrawlRecord(nil), records...),
	}
}

func (c *NikeCrawler) StartCrawl(_ context.Context, input usecase.ContentOptimizerCrawlStartInput) (usecase.ContentOptimizerCrawlJob, error) {
	c.activeRecords = c.recordsForInput(input)
	return usecase.ContentOptimizerCrawlJob{
		ID:     NikeSeedJobID,
		Status: "running",
	}, nil
}

func (c *NikeCrawler) GetCrawl(_ context.Context, jobID string, input usecase.ContentOptimizerCrawlResultInput) (usecase.ContentOptimizerCrawlResult, error) {
	records := c.filteredRecords(input.Status)
	if input.Limit > 0 && input.Limit < len(records) {
		records = records[:input.Limit]
	}

	id := strings.TrimSpace(jobID)
	if id == "" {
		id = NikeSeedJobID
	}

	return usecase.ContentOptimizerCrawlResult{
		ID:                 id,
		Status:             "completed",
		BrowserSecondsUsed: 0,
		Total:              len(c.activeRecords),
		Finished:           len(c.activeRecords),
		Records:            append([]usecase.ContentOptimizerCrawlRecord(nil), records...),
	}, nil
}

func (c *NikeCrawler) recordsForInput(input usecase.ContentOptimizerCrawlStartInput) []usecase.ContentOptimizerCrawlRecord {
	includePatterns := make(map[string]struct{}, len(input.Options.IncludePatterns))
	for _, pattern := range input.Options.IncludePatterns {
		pattern = strings.TrimSpace(pattern)
		if pattern != "" {
			includePatterns[pattern] = struct{}{}
		}
	}
	if len(includePatterns) == 0 {
		return append([]usecase.ContentOptimizerCrawlRecord(nil), c.records...)
	}

	records := make([]usecase.ContentOptimizerCrawlRecord, 0, len(includePatterns))
	for _, record := range c.records {
		if _, ok := includePatterns[record.URL]; ok {
			records = append(records, record)
		}
	}
	return records
}

func (c *NikeCrawler) filteredRecords(status string) []usecase.ContentOptimizerCrawlRecord {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" {
		return append([]usecase.ContentOptimizerCrawlRecord(nil), c.activeRecords...)
	}

	records := make([]usecase.ContentOptimizerCrawlRecord, 0, len(c.activeRecords))
	for _, record := range c.activeRecords {
		if strings.ToLower(record.Status) == status {
			records = append(records, record)
		}
	}
	return records
}

func nikeSeedRecords() []usecase.ContentOptimizerCrawlRecord {
	return []usecase.ContentOptimizerCrawlRecord{
		{
			URL:        "https://www.nike.com",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Nike. Just Do It.",
			Markdown: strings.TrimSpace(`
# Nike. Just Do It.

Nike presents performance footwear, apparel, and equipment for running, basketball, training, lifestyle, and sport culture.

## Content optimizer notes

- Strong global brand signal on the homepage.
- Product discovery paths are visible, but AI answers need clearer category summaries.
- Add concise internal links to running, basketball, membership, and sustainability pages.
`),
		},
		{
			URL:        "https://www.nike.com/running",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Nike Running Shoes and Gear",
			Markdown: strings.TrimSpace(`
# Nike Running

Daily trainers, race shoes, trail running, and running apparel are grouped around comfort, speed, durability, and coaching.

## Optimization opportunities

- Add an above-the-fold answer for "best Nike shoes for daily running".
- Compare Pegasus, Vomero, Structure, and Vaporfly by runner profile.
- Include FAQ content about fit, distance, pronation, and training use cases.
`),
		},
		{
			URL:        "https://www.nike.com/basketball",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Nike Basketball",
			Markdown: strings.TrimSpace(`
# Nike Basketball

Basketball content highlights signature athletes, performance cushioning, court traction, and lifestyle crossover.

## Optimization opportunities

- Explain which models fit guards, wings, and centers.
- Clarify differences between LeBron, KD, Giannis, Sabrina, and Ja signature lines.
- Add structured product guidance for indoor and outdoor courts.
`),
		},
		{
			URL:        "https://www.nike.com/membership",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Nike Membership",
			Markdown: strings.TrimSpace(`
# Nike Membership

Membership combines product access, experiences, apps, rewards, and personalized services.

## Optimization opportunities

- Make membership benefits explicit in one scannable section.
- Connect app experiences to shopping, training, and community outcomes.
- Add schema-friendly language for loyalty and rewards queries.
`),
		},
		{
			URL:        "https://www.nike.com/sustainability",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Nike Sustainability",
			Markdown: strings.TrimSpace(`
# Nike Sustainability

Sustainability messaging focuses on Move to Zero, circular design, lower-impact materials, and product innovation.

## Optimization opportunities

- Surface concrete claims with dates, metrics, and methodology.
- Link product pages to material explanations.
- Add plain-language summaries for AI answers about responsible sportswear.
`),
		},
		{
			URL:        "https://www.nike.com/archive/spring-collection",
			Status:     "errored",
			HTTPStatus: 503,
			Title:      "Archived campaign unavailable",
			HTML:       "<html><body><h1>503 Service Unavailable</h1><p>Seed crawl error example.</p></body></html>",
		},
	}
}
