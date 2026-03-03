package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/usecase"
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
	mux.HandleFunc("POST /users", h.createUser)
	mux.HandleFunc("GET /users/me", h.me)
	mux.HandleFunc("GET /users/", h.getUserByID)
	mux.HandleFunc("GET /users/by-auth/", h.getUserByAuthIdentityID)
	mux.HandleFunc("POST /admin/users/", h.adminUserAction)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "user-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "user-service"})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "user-service"})
}

type createUserRequest struct {
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(r.Header.Get("X-Authenticated-Identity-ID"))
	if authIdentityID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated identity"})
		return
	}

	var req createUserRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}

	user, err := h.svc.CreateUser(
		r.Context(),
		authIdentityID,
		req.Email,
		req.FirstName,
		req.LastName,
	)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidUser) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(r.Header.Get("X-Authenticated-Identity-ID"))
	if authIdentityID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated identity"})
		return
	}

	user, err := h.svc.GetUserByAuthIdentityID(r.Context(), authIdentityID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) getUserByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/users/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	user, err := h.svc.GetUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) getUserByAuthIdentityID(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/users/by-auth/"))
	if authIdentityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid auth identity id"})
		return
	}

	user, err := h.svc.GetUserByAuthIdentityID(r.Context(), authIdentityID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) adminUserAction(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/admin/users/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}

	userID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || userID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	switch parts[1] {
	case "ban":
		err = h.svc.BanUser(r.Context(), userID)
	case "unban":
		err = h.svc.UnbanUser(r.Context(), userID)
	case "delete":
		err = h.svc.DeleteUser(r.Context(), userID)
	case "restore":
		err = h.svc.RestoreUser(r.Context(), userID)
	default:
		http.NotFound(w, r)
		return
	}
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidUser):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		case errors.Is(err, domain.ErrUserNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
