package http

import (
	"context"
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
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
	mux.HandleFunc("PATCH /users/me", h.updateMe)
	mux.HandleFunc("DELETE /users/me", h.deleteMe)
	mux.HandleFunc("GET /users/", h.getUserByID)
	mux.HandleFunc("GET /users/by-auth/", h.getUserByAuthIdentityID)
	mux.HandleFunc("POST /admin/users/", h.adminUserAction)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "user-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "user-service"})
		return
	}
	httpjson.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "user-service"})
}

type createUserRequest struct {
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(r.Header.Get("X-Authenticated-Identity-ID"))
	if authIdentityID == "" {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated identity")
		return
	}

	var req createUserRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
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
			httpjson.WriteValidationError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(r.Header.Get("X-Authenticated-Identity-ID"))
	if authIdentityID == "" {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated identity")
		return
	}

	user, err := h.svc.GetUserByAuthIdentityID(r.Context(), authIdentityID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			httpjson.WriteNotFoundError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	writeJSON(w, http.StatusOK, user)
}

type updateMeRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(r.Header.Get("X-Authenticated-Identity-ID"))
	if authIdentityID == "" {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated identity")
		return
	}

	current, err := h.svc.GetUserByAuthIdentityID(r.Context(), authIdentityID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			httpjson.WriteNotFoundError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	var req updateMeRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	user, err := h.svc.UpdateUserProfile(r.Context(), current.ID, req.FirstName, req.LastName)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidUser) {
			httpjson.WriteValidationError(w)
			return
		}
		if errors.Is(err, domain.ErrUserNotFound) {
			httpjson.WriteNotFoundError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) deleteMe(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(r.Header.Get("X-Authenticated-Identity-ID"))
	if authIdentityID == "" {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated identity")
		return
	}

	current, err := h.svc.GetUserByAuthIdentityID(r.Context(), authIdentityID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			httpjson.WriteNotFoundError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	if err := h.svc.DeleteUser(r.Context(), current.ID); err != nil {
		if errors.Is(err, domain.ErrInvalidUser) {
			httpjson.WriteValidationError(w)
			return
		}
		if errors.Is(err, domain.ErrUserNotFound) {
			httpjson.WriteNotFoundError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getUserByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/users/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	user, err := h.svc.GetUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			httpjson.WriteNotFoundError(w)
			return
		}
		httpjson.WriteInternalError(w)
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) getUserByAuthIdentityID(w http.ResponseWriter, r *http.Request) {
	authIdentityID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/users/by-auth/"))
	if authIdentityID == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid auth identity id")
		return
	}

	user, err := h.svc.GetUserByAuthIdentityID(r.Context(), authIdentityID)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			httpjson.WriteNotFoundError(w)
			return
		}
		httpjson.WriteInternalError(w)
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
		httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
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
			httpjson.WriteValidationError(w)
		case errors.Is(err, domain.ErrUserNotFound):
			httpjson.WriteNotFoundError(w)
		default:
			httpjson.WriteInternalError(w)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpjson.WriteSuccess(w, status, value)
}
