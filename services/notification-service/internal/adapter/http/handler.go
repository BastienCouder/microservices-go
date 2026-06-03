package http

import (
	"context"
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
	"strconv"

	"github.com/bastiencouder/microservices-go/services/notification-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/notification-service/internal/usecase"
)

type Handler struct {
	svc        *usecase.Service
	readyCheck func(context.Context) error
}

func NewHandler(svc *usecase.Service, readyCheck func(context.Context) error) *Handler {
	return &Handler{svc: svc, readyCheck: readyCheck}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /ready", h.ready)
	mux.HandleFunc("POST /notifications/send", h.send)
	mux.HandleFunc("GET /notifications", h.list)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "notification-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "notification-service"})
		return
	}
	httpjson.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "notification-service"})
}

type sendNotificationRequest struct {
	Channel   string `json:"channel"`
	Recipient string `json:"recipient"`
	Subject   string `json:"subject"`
	Message   string `json:"message"`
}

func (h *Handler) send(w http.ResponseWriter, r *http.Request) {
	var req sendNotificationRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	notification, err := h.svc.Send(r.Context(), req.Channel, req.Recipient, req.Subject, req.Message)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidNotification) {
			httpjson.WriteValidationError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	writeJSON(w, http.StatusAccepted, notification)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	const maxLimit = 100
	if limitStr != "" {
		parsed, err := strconv.Atoi(limitStr)
		if err != nil || parsed <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	notifications, err := h.svc.List(r.Context(), limit)
	if err != nil {
		httpjson.WriteInternalError(w)
		return
	}

	writeJSON(w, http.StatusOK, notifications)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpjson.WriteSuccess(w, status, value)
}
