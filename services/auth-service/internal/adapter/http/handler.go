package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/usecase"
)

type Handler struct {
	svc              *usecase.Service
	allowedOrigin    string
	kratosBrowserURL string
}

type modeRequest struct {
	Mode string `json:"mode"`
}

type passwordRequest struct {
	Mode     string `json:"mode"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

type otpStartRequest struct {
	Mode  string `json:"mode"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type otpVerifyRequest struct {
	Mode      string `json:"mode"`
	FlowID    string `json:"flowId"`
	CSRFToken string `json:"csrfToken"`
	Code      string `json:"code"`
}

func NewHandler(svc *usecase.Service, allowedOrigin, kratosBrowserURL string) *Handler {
	return &Handler{
		svc:              svc,
		allowedOrigin:    allowedOrigin,
		kratosBrowserURL: strings.TrimRight(kratosBrowserURL, "/"),
	}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("/auth/validate", h.validate)
	mux.HandleFunc("/auth/me", h.me)
	mux.HandleFunc("/auth/password", h.password)
	mux.HandleFunc("/auth/otp/start", h.otpStart)
	mux.HandleFunc("/auth/otp/verify", h.otpVerify)
	mux.HandleFunc("/auth/logout", h.logout)
	mux.HandleFunc("/auth/oidc/google", h.oidcGoogle)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "auth-service"})
}

func (h *Handler) validate(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	session, statusCode, err := h.svc.WhoAmI(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || session == nil || !session.Active {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"session_id":    session.ID,
		"identity_id":   session.Identity.ID,
	})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	session, statusCode, err := h.svc.WhoAmI(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || session == nil || !session.Active {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"identity_id": session.Identity.ID,
		"email":       session.Identity.Traits.Email,
		"name":        session.Identity.Traits.Name,
	})
}

func (h *Handler) password(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	var req passwordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if !validMode(req.Mode) || req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid mode/email/password"})
		return
	}

	flow, initSetCookies, statusCode, err := h.svc.InitFlow(r.Context(), req.Mode, r.Header.Get("Cookie"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || flow == nil {
		writeJSON(w, statusCode, map[string]string{"error": "unable to init flow"})
		return
	}
	csrfToken := flow.CSRFToken()
	if csrfToken == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "missing csrf token"})
		return
	}

	payload := map[string]any{
		"method":     "password",
		"csrf_token": csrfToken,
	}
	if req.Mode == "login" {
		payload["identifier"] = req.Email
		payload["password"] = req.Password
	} else {
		payload["traits"] = map[string]string{"email": req.Email, "name": req.Name}
		payload["password"] = req.Password
	}

	submitCookie := mergeCookieHeader(r.Header.Get("Cookie"), initSetCookies)
	raw, submitSetCookies, submitStatus, err := h.svc.SubmitFlow(r.Context(), req.Mode, flow.ID, payload, submitCookie)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}

	appendSetCookies(w, initSetCookies)
	appendSetCookies(w, submitSetCookies)
	if submitStatus >= 400 {
		writeRawJSON(w, submitStatus, raw)
		return
	}
	var body any
	if err := json.Unmarshal(raw, &body); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid kratos response"})
		return
	}
	message := "connexion réussie"
	if req.Mode == "registration" {
		message = "inscription réussie"
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": message, "data": body})
}

func (h *Handler) otpStart(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	var req otpStartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if !validMode(req.Mode) || req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid mode/email"})
		return
	}

	flow, initSetCookies, statusCode, err := h.svc.InitFlow(r.Context(), req.Mode, r.Header.Get("Cookie"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || flow == nil {
		writeJSON(w, statusCode, map[string]string{"error": "unable to init flow"})
		return
	}
	csrfToken := flow.CSRFToken()
	if csrfToken == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "missing csrf token"})
		return
	}

	payload := map[string]any{
		"method":     "code",
		"csrf_token": csrfToken,
	}
	if req.Mode == "login" {
		payload["identifier"] = req.Email
	} else {
		payload["traits"] = map[string]string{"email": req.Email, "name": req.Name}
	}

	submitCookie := mergeCookieHeader(r.Header.Get("Cookie"), initSetCookies)
	raw, submitSetCookies, submitStatus, err := h.svc.SubmitFlow(r.Context(), req.Mode, flow.ID, payload, submitCookie)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}

	appendSetCookies(w, initSetCookies)
	appendSetCookies(w, submitSetCookies)
	if submitStatus >= 400 {
		writeRawJSON(w, submitStatus, raw)
		return
	}
	var body domain.BrowserFlow
	if err := json.Unmarshal(raw, &body); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid kratos response"})
		return
	}
	otpCSRF := body.CSRFToken()
	if body.ID == "" || otpCSRF == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "missing flow/csrf"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"message":   "otp envoyé",
		"flowId":    body.ID,
		"csrfToken": otpCSRF,
	})
}

func (h *Handler) otpVerify(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	var req otpVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if !validMode(req.Mode) || req.FlowID == "" || req.CSRFToken == "" || req.Code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid mode/flowId/csrfToken/code"})
		return
	}

	payload := map[string]any{
		"method":     "code",
		"csrf_token": req.CSRFToken,
		"code":       req.Code,
	}
	raw, submitSetCookies, submitStatus, err := h.svc.SubmitFlow(r.Context(), req.Mode, req.FlowID, payload, r.Header.Get("Cookie"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}

	appendSetCookies(w, submitSetCookies)
	if submitStatus >= 400 {
		writeRawJSON(w, submitStatus, raw)
		return
	}
	var body any
	if err := json.Unmarshal(raw, &body); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid kratos response"})
		return
	}
	message := "connexion OTP réussie"
	if req.Mode == "registration" {
		message = "inscription OTP réussie"
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": message, "data": body})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	initResp, initSetCookies, statusCode, err := h.svc.InitLogout(r.Context(), r.Header.Get("Cookie"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || initResp == nil || initResp.LogoutURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to initialize logout flow"})
		return
	}

	submitCookie := mergeCookieHeader(r.Header.Get("Cookie"), initSetCookies)
	completeSetCookies, completeStatus, err := h.svc.CompleteLogout(r.Context(), initResp.LogoutURL, submitCookie)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if completeStatus != http.StatusOK {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to complete logout flow"})
		return
	}

	appendSetCookies(w, initSetCookies)
	appendSetCookies(w, completeSetCookies)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "logout ok"})
}

func (h *Handler) oidcGoogle(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	var req modeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if !validMode(req.Mode) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid mode"})
		return
	}

	flow, initSetCookies, statusCode, err := h.svc.InitFlow(r.Context(), req.Mode, r.Header.Get("Cookie"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || flow == nil || flow.ID == "" {
		writeJSON(w, statusCode, map[string]string{"error": "unable to init flow"})
		return
	}

	appendSetCookies(w, initSetCookies)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"redirectTo": h.kratosBrowserURL + "/self-service/methods/oidc/auth/google?flow=" + flow.ID,
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeRawJSON(w http.ResponseWriter, status int, raw []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(raw)
}

func appendSetCookies(w http.ResponseWriter, values []string) {
	for _, value := range values {
		if value == "" {
			continue
		}
		w.Header().Add("Set-Cookie", value)
	}
}

func (h *Handler) setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", h.allowedOrigin)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Session-Token, Cookie")
}

func (h *Handler) handlePreflight(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodOptions {
		return false
	}
	h.setCORSHeaders(w)
	w.WriteHeader(http.StatusNoContent)
	return true
}

func validMode(mode string) bool {
	return mode == "login" || mode == "registration"
}

func mergeCookieHeader(base string, setCookies []string) string {
	parts := make([]string, 0, len(setCookies)+1)
	if strings.TrimSpace(base) != "" {
		parts = append(parts, strings.TrimSpace(base))
	}
	for _, cookie := range setCookies {
		pair := cookiePair(cookie)
		if pair != "" {
			parts = append(parts, pair)
		}
	}
	return strings.Join(parts, "; ")
}

func cookiePair(setCookie string) string {
	first := strings.SplitN(strings.TrimSpace(setCookie), ";", 2)[0]
	if !strings.Contains(first, "=") {
		return ""
	}
	return first
}
