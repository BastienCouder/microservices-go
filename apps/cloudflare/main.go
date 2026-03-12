package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	AccountID = "65336c41fb62f927e4b11e712cce02f3"
	OutputDir = "crawled_pages"
)

type CrawlRequest struct {
	URL     string   `json:"url"`
	Depth   int      `json:"depth"`
	Formats []string `json:"formats"`
	Render  bool     `json:"render"`
}

type CrawlRecord struct {
	URL     string `json:"url"`
	Content string `json:"content"`
	Status  string `json:"status"`
}

type CrawlResponse struct {
	Success bool `json:"success"`
	Result  struct {
		ID      string        `json:"id"`
		Status  string        `json:"status"`
		Records []CrawlRecord `json:"records"`
	} `json:"result"`
	Errors []struct {
		Code    int      `json:"code"`
		Message string   `json:"message"`
		Keys    []string `json:"keys"`
	} `json:"errors"`
}

func main() {
	apiToken := os.Getenv("CLOUDFLARE_API_TOKEN")
	if apiToken == "" {
		fmt.Println("❌ variable d'environnement CLOUDFLARE_API_TOKEN manquante")
		return
	}

	targetURL := "https://promptwatch.com"

	if err := os.MkdirAll(OutputDir, os.ModePerm); err != nil {
		fmt.Printf("❌ erreur création dossier: %v\n", err)
		return
	}

	jobID, err := startCrawl(apiToken, targetURL)
	if err != nil {
		fmt.Printf("❌ %v\n", err)
		return
	}
	fmt.Printf("✅ Crawl lancé ! Job ID: %s\n", jobID)

	fmt.Println("⏳ attente avant le premier check...")
	time.Sleep(12 * time.Second)

	for {
		data, finished, err := checkCrawl(apiToken, jobID)
		if err != nil {
			fmt.Printf("❌ %v\n", err)
			break
		}

		fmt.Printf("⏳ Statut actuel : %s\n", data.Result.Status)

		if finished {
			fmt.Printf("✨ Terminé ! Sauvegarde de %d pages...\n", len(data.Result.Records))
			saveToFiles(data.Result.Records)
			break
		}

		time.Sleep(12 * time.Second)
	}
}

func startCrawl(apiToken, url string) (string, error) {
	apiURL := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/accounts/%s/browser-rendering/crawl",
		AccountID,
	)

	payload := CrawlRequest{
		URL:     url,
		Depth:   1,
		Formats: []string{"markdown"},
		Render:  true,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		retryAfter := resp.Header.Get("Retry-After")
		if retryAfter == "" {
			retryAfter = "10"
		}
		return "", fmt.Errorf("rate limit exceeded, réessaie dans %s secondes", retryAfter)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result CrawlResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	if !result.Success {
		if len(result.Errors) > 0 {
			return "", fmt.Errorf("erreur API: %s", result.Errors[0].Message)
		}
		return "", fmt.Errorf("erreur API inconnue")
	}

	return result.Result.ID, nil
}

func checkCrawl(apiToken, jobID string) (CrawlResponse, bool, error) {
	apiURL := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/accounts/%s/browser-rendering/crawl/%s?limit=1",
		AccountID, jobID,
	)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return CrawlResponse{}, false, err
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return CrawlResponse{}, false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		retryAfter := resp.Header.Get("Retry-After")
		if retryAfter == "" {
			retryAfter = "10"
		}
		return CrawlResponse{}, false, fmt.Errorf("rate limit exceeded, réessaie dans %s secondes", retryAfter)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return CrawlResponse{}, false, err
	}

	var result CrawlResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return CrawlResponse{}, false, err
	}

	if !result.Success {
		if len(result.Errors) > 0 {
			return result, false, fmt.Errorf("erreur API: %s", result.Errors[0].Message)
		}
		return result, false, fmt.Errorf("erreur API inconnue")
	}

	switch result.Result.Status {
	case "completed":
		return fetchAllResults(apiToken, jobID)
	case "errored", "cancelled_due_to_timeout", "cancelled_due_to_limits", "cancelled_by_user":
		return result, false, fmt.Errorf("le crawl a échoué avec le statut: %s", result.Result.Status)
	default:
		return result, false, nil
	}
}

func fetchAllResults(apiToken, jobID string) (CrawlResponse, bool, error) {
	apiURL := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/accounts/%s/browser-rendering/crawl/%s",
		AccountID, jobID,
	)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return CrawlResponse{}, false, err
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return CrawlResponse{}, false, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return CrawlResponse{}, false, err
	}

	var result CrawlResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return CrawlResponse{}, false, err
	}

	if !result.Success {
		if len(result.Errors) > 0 {
			return result, false, fmt.Errorf("erreur API: %s", result.Errors[0].Message)
		}
		return result, false, fmt.Errorf("erreur API inconnue")
	}

	return result, true, nil
}

func saveToFiles(records []CrawlRecord) {
	for _, page := range records {
		if page.Status != "completed" || page.Content == "" {
			continue
		}

		cleanURL := strings.TrimPrefix(page.URL, "https://")
		cleanURL = strings.TrimPrefix(cleanURL, "http://")

		filename := strings.Map(func(r rune) rune {
			if strings.ContainsRune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", r) {
				return r
			}
			return '_'
		}, cleanURL)

		path := filepath.Join(OutputDir, filename+".md")

		if err := os.WriteFile(path, []byte(page.Content), 0644); err != nil {
			fmt.Printf("❌ erreur écriture %s: %v\n", path, err)
			continue
		}

		fmt.Printf("💾 Sauvegardé : %s\n", path)
	}
}
