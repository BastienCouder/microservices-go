package http

import (
	"errors"
	"log"
	"net/http"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	onboardingapp "github.com/bastiencouder/microservices-go/services/api-gateway/internal/app/onboarding"
)

func (h *Handler) handleOnboardingBootstrap(w http.ResponseWriter, r *http.Request) {
	identityID, err := h.validateAuth(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		if err == errUnauthorized {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		writeJSONError(w, http.StatusServiceUnavailable, "auth dependency unavailable")
		return
	}
	userID, err := h.resolveUserID(r.Context(), identityID)
	if err != nil {
		if isDependencyUnavailableError(err) {
			writeJSONError(w, http.StatusServiceUnavailable, "user dependency unavailable")
			return
		}
		writeJSONError(w, http.StatusUnauthorized, "user profile required")
		return
	}

	var req onboardingapp.Request
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		writeJSONError(w, http.StatusBadRequest, httpjson.InvalidJSONMessage)
		return
	}

	result, err := h.onboardingService.Bootstrap(r.Context(), onboardingapp.Identity{
		IdentityID: identityID,
		UserID:     userID,
	}, req)
	if err != nil {
		if errors.Is(err, onboardingapp.ErrValidation) {
			httpjson.WriteValidationError(w)
			return
		}
		log.Printf("onboarding bootstrap failed: %v", err)
		writeJSONError(w, http.StatusBadGateway, httpjson.DependencyUnavailableMessage)
		return
	}

	httpjson.WriteSuccess(w, http.StatusCreated, result)
}
