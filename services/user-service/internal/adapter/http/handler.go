package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/usecase"
)

type Handler struct {
	svc *usecase.Service
}

func NewHandler(svc *usecase.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("POST /users", h.createUser)
	mux.HandleFunc("GET /users/", h.getUserByID)
	mux.HandleFunc("GET /users/by-auth/", h.getUserByAuthIdentityID)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "user-service"})
}

type createUserRequest struct {
	Email          string `json:"email"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(r.Header.Get("X-Authenticated-Identity-ID"))
	if authIdentityID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated identity"})
		return
	}

	var req createUserRequest
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

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
