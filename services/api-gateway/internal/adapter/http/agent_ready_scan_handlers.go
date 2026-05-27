package http

import (
	"encoding/json"
	"errors"
	stdhttp "net/http"
	"strings"
	"time"
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
	case r.Method == stdhttp.MethodGet && isAgentReadyScanItemRequest(r):
		h.getAgentReadyScan(w, r)
	default:
		writeJSONError(w, stdhttp.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) createAgentReadyScan(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	var input agentReadyScanRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSONError(w, stdhttp.StatusBadRequest, "invalid json body")
		return
	}
	input = normalizeAgentReadyScanRequest(input)
	if err := validateAgentReadyScanRequest(input); err != nil {
		writeJSONError(w, stdhttp.StatusBadRequest, err.Error())
		return
	}

	scanID := h.scanStore.create(input)
	go h.runAgentReadyScan(scanID, input)

	writeJSON(w, stdhttp.StatusAccepted, agentReadyQueuedResponse{
		ScanID: scanID,
		Status: "queued",
	})
}

func (h *Handler) getAgentReadyScan(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	scanID := agentReadyScanIDFromPath(r.URL.Path)
	if scanID == "" || strings.Contains(scanID, "/") {
		writeJSONError(w, stdhttp.StatusBadRequest, "invalid scan id")
		return
	}
	result, ok := h.scanStore.get(scanID)
	if !ok {
		writeJSONError(w, stdhttp.StatusNotFound, "scan not found")
		return
	}
	writeJSON(w, stdhttp.StatusOK, result)
}

func (h *Handler) runAgentReadyScan(scanID string, input agentReadyScanRequest) {
	h.scanStore.markRunning(scanID)
	analyzer := newAgentReadyAnalyzer(h.httpClient, 5*time.Second)
	result := analyzer.analyze(input)
	if result.Status == "failed" && result.Error == "" {
		result.Error = errors.New("scan failed").Error()
	}
	h.scanStore.update(scanID, result)
}
