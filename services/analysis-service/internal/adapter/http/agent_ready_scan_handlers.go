package http

import (
	"context"
	"errors"
	"fmt"
	"log"
	stdhttp "net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

func isAgentReadyScanCollectionRequest(r *stdhttp.Request) bool {
	return r.URL.Path == "/analysis/agent-ready/scans"
}

func isAgentReadyScanItemRequest(r *stdhttp.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/analysis/agent-ready/scans/")
}

func agentReadyScanIDFromPath(path string) string {
	return strings.TrimSpace(strings.TrimPrefix(path, "/analysis/agent-ready/scans/"))
}

func (h *Handler) handleAgentReadyScan(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	switch {
	case r.Method == stdhttp.MethodPost && isAgentReadyScanCollectionRequest(r):
		h.createAgentReadyScan(w, r)
	case r.Method == stdhttp.MethodGet && isAgentReadyScanCollectionRequest(r):
		h.listAgentReadyScans(w, r)
	case r.Method == stdhttp.MethodGet && isAgentReadyScanItemRequest(r):
		h.getAgentReadyScan(w, r)
	default:
		httpjson.WriteMethodNotAllowed(w)
	}
}

func (h *Handler) createAgentReadyScan(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	var input agentReadyScanRequest
	if err := decodeJSON(w, r, &input); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	input = normalizeAgentReadyScanRequest(input)
	if err := validateAgentReadyScanRequest(input); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	scanID := newAgentReadyScanID()
	creditRunID := ""
	if organizationID, ok := authenticatedOrganizationID(r); ok {
		if h.svc == nil {
			httpjson.WriteDependencyUnavailable(w)
			return
		}
		reservation, err := h.svc.ReserveCreditUsage(r.Context(), usecase.CreditUsageInput{
			RequestID:      scanID,
			OrganizationID: organizationID,
			ProjectID:      agentReadyUsageProjectID(input.URL),
			RunType:        usecase.RunTypeAgentReadyScan,
			Credits:        agentReadyScanCreditCost(input),
		})
		if err != nil {
			h.writeUsecaseError(w, err)
			return
		}
		creditRunID = reservation.ID
	}

	h.scanStore.createWithID(scanID, input)
	go h.runAgentReadyScan(scanID, input, creditRunID)

	writeJSON(w, stdhttp.StatusAccepted, agentReadyQueuedResponse{
		ScanID: scanID,
		Status: "queued",
		URL:    "/v1/agent-ready/scans/" + scanID,
	})
}

func (h *Handler) listAgentReadyScans(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	results := h.scanStore.list()
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	urlFilter := strings.TrimSpace(r.URL.Query().Get("url"))
	filtered := make([]agentReadyScanResult, 0, len(results))
	for _, result := range results {
		if status != "" && result.Status != status {
			continue
		}
		if urlFilter != "" && result.URL != urlFilter {
			continue
		}
		filtered = append(filtered, result)
	}
	writeJSON(w, stdhttp.StatusOK, map[string]any{
		"items":       filtered,
		"next_cursor": nil,
		"has_more":    false,
	})
}

func (h *Handler) getAgentReadyScan(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	scanID := agentReadyScanIDFromPath(r.URL.Path)
	if scanID == "" || strings.Contains(scanID, "/") {
		httpjson.WriteError(w, stdhttp.StatusBadRequest, "invalid scan id")
		return
	}
	result, ok := h.scanStore.get(scanID)
	if !ok {
		httpjson.WriteError(w, stdhttp.StatusNotFound, "scan not found")
		return
	}
	writeJSON(w, stdhttp.StatusOK, result)
}

func (h *Handler) runAgentReadyScan(scanID string, input agentReadyScanRequest, creditRunID string) {
	h.scanStore.markRunning(scanID)
	analyzer := newAgentReadyAnalyzer(h.httpClient, 5*time.Second)
	result := analyzer.analyze(input)
	if result.Status == "failed" && result.Error == "" {
		result.Error = errors.New("scan failed").Error()
	}
	h.scanStore.update(scanID, result)
	if h.svc != nil && strings.TrimSpace(creditRunID) != "" {
		var err error
		if result.Status == "failed" {
			_, err = h.svc.ReleaseCreditUsage(context.Background(), creditRunID)
		} else {
			_, err = h.svc.CompleteCreditUsage(context.Background(), creditRunID)
		}
		if err != nil {
			log.Printf("agent_ready_scan.credit_finalize_failed scan_id=%s run_id=%s status=%s error=%v", scanID, creditRunID, result.Status, err)
		}
	}
}

func agentReadyScanCreditCost(input agentReadyScanRequest) int {
	if len(input.Checks) > 0 && len(input.Checks) <= 2 {
		return 5
	}
	return 20
}

func agentReadyUsageProjectID(rawURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Host == "" {
		return "agent-ready:unknown"
	}
	return fmt.Sprintf("agent-ready:%s", strings.ToLower(parsed.Host))
}
