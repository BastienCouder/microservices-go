package seedcrawl

import (
	"context"
	"testing"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

func TestNikeCrawlerReturnsCompletedSeedRecords(t *testing.T) {
	crawler := NewNikeCrawler()

	job, err := crawler.StartCrawl(context.Background(), usecase.ContentOptimizerCrawlStartInput{
		URL:   "https://www.nike.com",
		Limit: 2,
	})
	if err != nil {
		t.Fatalf("start seed crawl: %v", err)
	}
	if job.ID == "" {
		t.Fatal("expected a seed job id")
	}
	if job.Status != "running" {
		t.Fatalf("expected running start status, got %q", job.Status)
	}

	result, err := crawler.GetCrawl(context.Background(), job.ID, usecase.ContentOptimizerCrawlResultInput{
		Status: "completed",
		Limit:  2,
	})
	if err != nil {
		t.Fatalf("get seed crawl: %v", err)
	}

	if result.ID != job.ID {
		t.Fatalf("expected result id %q, got %q", job.ID, result.ID)
	}
	if result.Status != "completed" {
		t.Fatalf("expected completed result, got %q", result.Status)
	}
	if result.Total != 6 || result.Finished != 6 {
		t.Fatalf("expected full seed totals 6/6, got %d/%d", result.Total, result.Finished)
	}
	if len(result.Records) != 2 {
		t.Fatalf("expected 2 limited records, got %d", len(result.Records))
	}
	if result.Records[0].Title == "" || result.Records[0].Markdown == "" {
		t.Fatalf("expected titled markdown seed record, got %#v", result.Records[0])
	}
}

func TestNikeCrawlerFiltersErroredSeedRecords(t *testing.T) {
	crawler := NewNikeCrawler()

	result, err := crawler.GetCrawl(context.Background(), "seed-crawl-nike", usecase.ContentOptimizerCrawlResultInput{
		Status: "errored",
	})
	if err != nil {
		t.Fatalf("get seed crawl: %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("expected completed job status, got %q", result.Status)
	}
	if len(result.Records) != 1 {
		t.Fatalf("expected one errored seed record, got %d", len(result.Records))
	}
	if result.Records[0].Status != "errored" || result.Records[0].HTTPStatus != 503 {
		t.Fatalf("expected errored 503 record, got %#v", result.Records[0])
	}
}

func TestNikeCrawlerLimitsSeedRecordsToSelectedIncludePatterns(t *testing.T) {
	crawler := NewNikeCrawler()

	job, err := crawler.StartCrawl(context.Background(), usecase.ContentOptimizerCrawlStartInput{
		URL: "https://www.nike.com",
		Options: usecase.ContentOptimizerCrawlOptions{
			IncludePatterns: []string{
				"https://www.nike.com/running",
				"https://www.nike.com/membership",
			},
		},
	})
	if err != nil {
		t.Fatalf("start seed crawl: %v", err)
	}

	result, err := crawler.GetCrawl(context.Background(), job.ID, usecase.ContentOptimizerCrawlResultInput{
		Status: "completed",
	})
	if err != nil {
		t.Fatalf("get seed crawl: %v", err)
	}

	if len(result.Records) != 2 {
		t.Fatalf("expected two selected seed records, got %d", len(result.Records))
	}
	if result.Records[0].URL != "https://www.nike.com/running" {
		t.Fatalf("expected running first, got %q", result.Records[0].URL)
	}
	if result.Records[1].URL != "https://www.nike.com/membership" {
		t.Fatalf("expected membership second, got %q", result.Records[1].URL)
	}
}
