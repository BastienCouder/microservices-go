package http

import (
	"encoding/json"
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/usecase"
)

type Handler struct {
	svc              *usecase.Service
	allowedOrigin    string
	kratosBrowserURL string
	cookieDomain     string
}

type modeRequest struct {
	Mode            string `json:"mode"`
	ReturnTo        string `json:"returnTo"`
	ConsentAccepted bool   `json:"consentAccepted"`
}

type passwordRequest struct {
	Mode            string `json:"mode"`
	Email           string `json:"email"`
	Name            string `json:"name"`
	Password        string `json:"password"`
	ConsentAccepted bool   `json:"consentAccepted"`
}

type otpStartRequest struct {
	Mode            string `json:"mode"`
	Email           string `json:"email"`
	Name            string `json:"name"`
	ConsentAccepted bool   `json:"consentAccepted"`
}

type otpVerifyRequest struct {
	Mode            string `json:"mode"`
	Email           string `json:"email"`
	Name            string `json:"name"`
	FlowID          string `json:"flowId"`
	CSRFToken       string `json:"csrfToken"`
	Code            string `json:"code"`
	ConsentAccepted bool   `json:"consentAccepted"`
}

func NewHandler(svc *usecase.Service, allowedOrigin, kratosBrowserURL string) *Handler {
	return &Handler{
		svc:              svc,
		allowedOrigin:    allowedOrigin,
		kratosBrowserURL: strings.TrimRight(kratosBrowserURL, "/"),
		cookieDomain:     sharedCookieDomain(kratosBrowserURL),
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
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "auth-service"})
}

func (h *Handler) validate(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	h.setCORSHeaders(w)

	session, statusCode, err := h.svc.WhoAmI(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		return
	}
	if statusCode != http.StatusOK || session == nil || !session.Active {
		httpjson.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.svc.EnsureUserProfile(r.Context(), session, consentAcceptedFromRequest(r, false)); err != nil {
		auditSecurityEvent("auth_validate", map[string]any{
			"result":      "profile_unavailable",
			"identity_id": session.Identity.ID,
			"error":       err.Error(),
		})
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
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
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	h.setCORSHeaders(w)

	session, statusCode, err := h.svc.WhoAmI(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		return
	}
	if statusCode != http.StatusOK || session == nil || !session.Active {
		httpjson.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.svc.EnsureUserProfile(r.Context(), session, consentAcceptedFromRequest(r, false)); err != nil {
		auditSecurityEvent("auth_me", map[string]any{
			"result":      "profile_unavailable",
			"identity_id": session.Identity.ID,
			"error":       err.Error(),
		})
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
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
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	h.setCORSHeaders(w)

	var req passwordRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	if !validMode(req.Mode) || req.Email == "" || req.Password == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid mode/email/password")
		auditSecurityEvent("auth_password", map[string]any{"mode": req.Mode, "email": req.Email, "result": "invalid_input"})
		return
	}
	if req.Mode == "registration" && !req.ConsentAccepted {
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
		return
	}

	flow, initSetCookies, statusCode, err := h.svc.InitFlow(r.Context(), req.Mode, "", r.Header.Get("Cookie"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_password", map[string]any{"mode": req.Mode, "email": req.Email, "result": "dependency_error"})
		return
	}
	if statusCode != http.StatusOK || flow == nil {
		httpjson.WriteError(w, statusCode, "unable to init flow")
		auditSecurityEvent("auth_password", map[string]any{"mode": req.Mode, "email": req.Email, "result": "flow_init_failed", "status": statusCode})
		return
	}
	csrfToken := flow.CSRFToken()
	if csrfToken == "" {
		httpjson.WriteError(w, http.StatusBadGateway, "missing csrf token")
		auditSecurityEvent("auth_password", map[string]any{"mode": req.Mode, "email": req.Email, "result": "missing_csrf"})
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
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_password", map[string]any{"mode": req.Mode, "email": req.Email, "result": "dependency_error"})
		return
	}

	h.appendSetCookies(w, initSetCookies)
	h.appendSetCookies(w, submitSetCookies)
	if submitStatus >= 400 {
		writeRawJSON(w, submitStatus, raw)
		auditSecurityEvent("auth_password", map[string]any{"mode": req.Mode, "email": req.Email, "result": "denied", "status": submitStatus})
		return
	}
	var body any
	if err := json.Unmarshal(raw, &body); err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "invalid kratos response")
		return
	}
	if err := h.syncUserProfileFromSession(r, append([]string{}, initSetCookies...), append([]string{}, submitSetCookies...), "auth_password", req.Mode, req.ConsentAccepted); err != nil {
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
		return
	}
	message := "connexion réussie"
	if req.Mode == "registration" {
		message = "inscription réussie"
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": message, "data": body})
	auditSecurityEvent("auth_password", map[string]any{"mode": req.Mode, "email": req.Email, "result": "success"})
}

func (h *Handler) otpStart(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	h.setCORSHeaders(w)

	var req otpStartRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	if !validMode(req.Mode) || req.Email == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid mode/email")
		auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "invalid_input"})
		return
	}
	if req.Mode == "registration" && !req.ConsentAccepted {
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
		return
	}

	flow, initSetCookies, statusCode, err := h.svc.InitFlow(r.Context(), req.Mode, "", r.Header.Get("Cookie"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "dependency_error"})
		return
	}
	if statusCode != http.StatusOK || flow == nil {
		httpjson.WriteError(w, statusCode, "unable to init flow")
		auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "flow_init_failed", "status": statusCode})
		return
	}
	csrfToken := flow.CSRFToken()
	if csrfToken == "" {
		httpjson.WriteError(w, http.StatusBadGateway, "missing csrf token")
		auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "missing_csrf"})
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
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "dependency_error"})
		return
	}

	h.appendSetCookies(w, initSetCookies)
	h.appendSetCookies(w, submitSetCookies)
	var body domain.BrowserFlow
	if err := json.Unmarshal(raw, &body); err != nil {
		if submitStatus >= 400 {
			writeRawJSON(w, submitStatus, raw)
			auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "denied", "status": submitStatus})
			return
		}
		httpjson.WriteError(w, http.StatusBadGateway, "invalid kratos response")
		return
	}
	// Kratos' browser code flow returns HTTP 400 while waiting for the OTP.
	// The sent_email state is a successful start, not a rejected request.
	if submitStatus >= 400 && body.State != "sent_email" {
		writeRawJSON(w, submitStatus, raw)
		auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "denied", "status": submitStatus})
		return
	}
	otpCSRF := body.CSRFToken()
	if body.ID == "" || otpCSRF == "" {
		httpjson.WriteError(w, http.StatusBadGateway, "missing flow/csrf")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"message":   "otp envoyé",
		"flowId":    body.ID,
		"csrfToken": otpCSRF,
	})
	auditSecurityEvent("auth_otp_start", map[string]any{"mode": req.Mode, "email": req.Email, "result": "success"})
}

func (h *Handler) otpVerify(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	h.setCORSHeaders(w)

	var req otpVerifyRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	if !validMode(req.Mode) || req.Email == "" || req.FlowID == "" || req.CSRFToken == "" || req.Code == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid mode/email/flowId/csrfToken/code")
		auditSecurityEvent("auth_otp_verify", map[string]any{"mode": req.Mode, "result": "invalid_input"})
		return
	}
	if req.Mode == "registration" && !req.ConsentAccepted {
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
		return
	}

	payload := map[string]any{
		"method":     "code",
		"csrf_token": req.CSRFToken,
		"code":       req.Code,
	}
	if req.Mode == "login" {
		payload["identifier"] = req.Email
	} else {
		payload["traits"] = map[string]string{"email": req.Email, "name": req.Name}
	}
	raw, submitSetCookies, submitStatus, err := h.svc.SubmitFlow(r.Context(), req.Mode, req.FlowID, payload, r.Header.Get("Cookie"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_otp_verify", map[string]any{"mode": req.Mode, "result": "dependency_error"})
		return
	}

	h.appendSetCookies(w, submitSetCookies)
	if submitStatus >= 400 {
		writeRawJSON(w, submitStatus, raw)
		auditSecurityEvent("auth_otp_verify", map[string]any{"mode": req.Mode, "result": "denied", "status": submitStatus})
		return
	}
	var body any
	if err := json.Unmarshal(raw, &body); err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "invalid kratos response")
		return
	}
	if err := h.syncUserProfileFromSession(r, nil, append([]string{}, submitSetCookies...), "auth_otp_verify", req.Mode, req.ConsentAccepted); err != nil {
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
		return
	}
	message := "connexion OTP réussie"
	if req.Mode == "registration" {
		message = "inscription OTP réussie"
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": message, "data": body})
	auditSecurityEvent("auth_otp_verify", map[string]any{"mode": req.Mode, "result": "success"})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	h.setCORSHeaders(w)

	initResp, initSetCookies, statusCode, err := h.svc.InitLogout(r.Context(), r.Header.Get("Cookie"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_logout", map[string]any{"result": "dependency_error"})
		return
	}
	if statusCode != http.StatusOK || initResp == nil || initResp.LogoutURL == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "failed to initialize logout flow")
		auditSecurityEvent("auth_logout", map[string]any{"result": "init_failed", "status": statusCode})
		return
	}

	submitCookie := mergeCookieHeader(r.Header.Get("Cookie"), initSetCookies)
	completeSetCookies, completeStatus, err := h.svc.CompleteLogout(r.Context(), initResp.LogoutURL, submitCookie)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_logout", map[string]any{"result": "dependency_error"})
		return
	}
	if completeStatus != http.StatusOK {
		httpjson.WriteError(w, http.StatusBadRequest, "failed to complete logout flow")
		auditSecurityEvent("auth_logout", map[string]any{"result": "complete_failed", "status": completeStatus})
		return
	}

	h.appendSetCookies(w, initSetCookies)
	h.appendSetCookies(w, completeSetCookies)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "logout ok"})
	auditSecurityEvent("auth_logout", map[string]any{"result": "success"})
}

func (h *Handler) oidcGoogle(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	h.setCORSHeaders(w)

	var req modeRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	if !validMode(req.Mode) {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid mode")
		auditSecurityEvent("auth_oidc_google", map[string]any{"result": "invalid_input"})
		return
	}
	if req.Mode == "registration" && !req.ConsentAccepted {
		httpjson.WriteError(w, http.StatusForbidden, "privacy policy consent required")
		return
	}
	if req.ConsentAccepted {
		http.SetCookie(w, &http.Cookie{Name: consentCookieName, Value: "accepted", Path: "/", HttpOnly: true, Secure: strings.HasPrefix(h.kratosBrowserURL, "https://"), SameSite: http.SameSiteLaxMode, MaxAge: 1800})
	}

	flow, initSetCookies, statusCode, err := h.svc.InitFlow(r.Context(), req.Mode, strings.TrimSpace(req.ReturnTo), r.Header.Get("Cookie"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_oidc_google", map[string]any{"mode": req.Mode, "result": "dependency_error"})
		return
	}
	if statusCode != http.StatusOK || flow == nil || flow.ID == "" {
		httpjson.WriteError(w, statusCode, "unable to init flow")
		auditSecurityEvent("auth_oidc_google", map[string]any{"mode": req.Mode, "result": "flow_init_failed", "status": statusCode})
		return
	}

	csrfToken := flow.CSRFToken()
	if csrfToken == "" {
		httpjson.WriteError(w, http.StatusBadGateway, "missing csrf token in flow")
		auditSecurityEvent("auth_oidc_google", map[string]any{"mode": req.Mode, "result": "missing_csrf"})
		return
	}

	submitCookie := mergeCookieHeader(r.Header.Get("Cookie"), initSetCookies)
	submitPayload := map[string]any{
		"method":     "oidc",
		"provider":   "google",
		"csrf_token": csrfToken,
	}

	raw, submitSetCookies, submitStatus, err := h.svc.SubmitFlow(r.Context(), req.Mode, flow.ID, submitPayload, submitCookie)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadGateway, "kratos unavailable")
		auditSecurityEvent("auth_oidc_google", map[string]any{"mode": req.Mode, "result": "submit_failed"})
		return
	}

	redirectTo := oidcRedirectFromRaw(raw)
	if redirectTo == "" {
		httpjson.WriteError(w, submitStatus, "missing oidc redirect url")
		auditSecurityEvent("auth_oidc_google", map[string]any{"mode": req.Mode, "result": "missing_redirect", "status": submitStatus})
		return
	}

	h.appendSetCookies(w, initSetCookies)
	h.appendSetCookies(w, submitSetCookies)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "redirectTo": redirectTo})
	auditSecurityEvent("auth_oidc_google", map[string]any{"mode": req.Mode, "result": "success", "status": submitStatus})
}

func oidcRedirectFromRaw(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	var payload struct {
		RedirectBrowserTo string `json:"redirect_browser_to"`
		RedirectTo        string `json:"redirect_to"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}
	if payload.RedirectBrowserTo != "" {
		return payload.RedirectBrowserTo
	}
	return payload.RedirectTo
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpjson.WriteSuccess(w, status, value)
}

func writeRawJSON(w http.ResponseWriter, status int, raw []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(raw)
}

func (h *Handler) appendSetCookies(w http.ResponseWriter, values []string) {
	for _, value := range values {
		if value == "" {
			continue
		}
		w.Header().Add("Set-Cookie", addCookieDomain(value, h.cookieDomain))
	}
}

func addCookieDomain(value, domain string) string {
	if strings.TrimSpace(domain) == "" || strings.Contains(strings.ToLower(value), "domain=") {
		return value
	}
	return value + "; Domain=" + domain
}

func sharedCookieDomain(rawURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return ""
	}
	host := parsed.Hostname()
	if host == "" || host == "localhost" || host == "127.0.0.1" || !strings.Contains(host, ".") {
		return ""
	}
	parts := strings.Split(host, ".")
	if len(parts) < 3 {
		return host
	}
	return "." + strings.Join(parts[1:], ".")
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
	indexes := make(map[string]int, len(setCookies)+1)
	add := func(pair string) {
		pair = strings.TrimSpace(pair)
		name, _, ok := strings.Cut(pair, "=")
		name = strings.TrimSpace(name)
		if !ok || name == "" {
			return
		}
		if index, exists := indexes[name]; exists {
			parts[index] = pair
			return
		}
		indexes[name] = len(parts)
		parts = append(parts, pair)
	}
	for _, pair := range strings.Split(base, ";") {
		add(pair)
	}
	for _, cookie := range setCookies {
		add(cookiePair(cookie))
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

func auditSecurityEvent(event string, fields map[string]any) {
	payload := map[string]any{
		"event":     event,
		"component": "auth-service",
		"ts":        time.Now().UTC().Format(time.RFC3339Nano),
	}
	for k, v := range fields {
		payload[k] = v
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		log.Printf("audit event=%s marshal_error=%v", event, err)
		return
	}
	log.Printf("audit %s", string(raw))
}

func (h *Handler) syncUserProfileFromSession(r *http.Request, initSetCookies, submitSetCookies []string, event, mode string, consentAccepted bool) error {
	submitCookie := mergeCookieHeader(mergeCookieHeader(r.Header.Get("Cookie"), initSetCookies), submitSetCookies)
	session, statusCode, err := h.svc.WhoAmI(r.Context(), submitCookie, "")
	if err != nil || statusCode != http.StatusOK || session == nil || !session.Active {
		auditSecurityEvent(event, map[string]any{"mode": mode, "result": "profile_sync_skipped"})
		return errors.New("profile session unavailable")
	}
	if err := h.svc.EnsureUserProfile(r.Context(), session, consentAccepted); err != nil {
		auditSecurityEvent(event, map[string]any{
			"mode":        mode,
			"result":      "profile_sync_failed",
			"identity_id": session.Identity.ID,
			"error":       err.Error(),
		})
		return err
	}
	auditSecurityEvent(event, map[string]any{
		"mode":        mode,
		"result":      "profile_sync_ok",
		"identity_id": session.Identity.ID,
	})
	return nil
}

const consentCookieName = "visia_privacy_policy_v1"

func consentAcceptedFromRequest(r *http.Request, explicit bool) bool {
	if explicit {
		return true
	}
	cookie, err := r.Cookie(consentCookieName)
	return err == nil && cookie.Value == "accepted"
}
