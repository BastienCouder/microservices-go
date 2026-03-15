package http

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

type generateProjectReportRequest struct {
	Template   string   `json:"template"`
	Recipients []string `json:"recipients"`
	SendEmail  bool     `json:"sendEmail"`
}

type sendProjectReportRequest struct {
	Recipients []string `json:"recipients"`
}

func (h *Handler) generateProjectReport(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	userID, ok := authenticatedUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing user identity"})
		return
	}

	var req generateProjectReportRequest
	if err := decodeJSON(w, r, &req); err != nil && err.Error() != "EOF" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	report, shareLink, err := h.svc.GenerateProjectReport(r.Context(), projectID, organizationID, userID, usecase.GenerateProjectReportInput{
		Template:   req.Template,
		Recipients: req.Recipients,
		SendEmail:  req.SendEmail,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, map[string]any{
		"report":    report,
		"shareLink": shareLink,
	})
}

func (h *Handler) listProjectReports(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	limit := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err == nil && parsed > 0 {
			limit = parsed
		}
	}

	reports, err := h.svc.ListProjectReports(r.Context(), projectID, organizationID, limit)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, reports)
}

func (h *Handler) getProjectReport(w http.ResponseWriter, r *http.Request, projectID, reportID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	report, auditTrail, shareLink, err := h.svc.GetProjectReport(r.Context(), projectID, organizationID, reportID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]any{
		"report":     report,
		"auditTrail": auditTrail,
		"shareLink":  shareLink,
	})
}

func (h *Handler) downloadProjectReportPDF(w http.ResponseWriter, r *http.Request, projectID, reportID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	payload, report, err := h.svc.GetProjectReportPDF(r.Context(), projectID, organizationID, reportID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}

	filename := sanitizeFilename(report.Title)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="`+filename+`.pdf"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func (h *Handler) sendProjectReport(w http.ResponseWriter, r *http.Request, projectID, reportID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	var req sendProjectReportRequest
	if err := decodeJSON(w, r, &req); err != nil && err.Error() != "EOF" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	report, err := h.svc.SendProjectReport(r.Context(), projectID, organizationID, reportID, req.Recipients)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, report)
}

func (h *Handler) createProjectReportShareLink(w http.ResponseWriter, r *http.Request, projectID, reportID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	shareLink, err := h.svc.CreateProjectReportShareLink(r.Context(), projectID, organizationID, reportID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, shareLink)
}

func (h *Handler) sharedReportRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/reports/share/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	token := parts[0]

	switch {
	case len(parts) == 1 && r.Method == http.MethodGet:
		h.renderSharedProjectReport(w, r, token)
	case len(parts) == 2 && parts[1] == "pdf" && r.Method == http.MethodGet:
		h.downloadSharedProjectReportPDF(w, r, token)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) renderSharedProjectReport(w http.ResponseWriter, r *http.Request, token string) {
	report, auditTrail, shareLink, err := h.svc.ResolveSharedProjectReport(r.Context(), token)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	if err := renderSharedProjectReportHTML(w, report, auditTrail, shareLink); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to render shared report"})
	}
}

func (h *Handler) downloadSharedProjectReportPDF(w http.ResponseWriter, r *http.Request, token string) {
	payload, report, err := h.svc.GetSharedProjectReportPDF(r.Context(), token)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}

	filename := sanitizeFilename(report.Title)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="`+filename+`.pdf"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func sanitizeFilename(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	replacer := strings.NewReplacer(
		" ", "-",
		"/", "-",
		"\\", "-",
		":", "-",
		";", "-",
		"\"", "",
		"'", "",
		"|", "-",
	)
	value = replacer.Replace(value)
	value = strings.Trim(value, "-.")
	if value == "" {
		return "report"
	}
	return value
}
