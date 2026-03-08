package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

func (h *Handler) validateAuth(ctx context.Context, cookieHeader, sessionToken string) (string, error) {
	var payload struct {
		IdentityID string `json:"identity_id"`
	}

	internalToken, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, "auth-service", internalTokenClaims{})
	if err != nil {
		return "", fmt.Errorf("sign internal jwt: %w", err)
	}

	err = h.executeDependencyCall(ctx, h.authBreaker, h.authBulkhead, 3, 50*time.Millisecond, 800*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		req, err := http.NewRequestWithContext(attemptCtx, http.MethodGet, h.authURL+"/auth/validate", nil)
		if err != nil {
			return false, true, err
		}
		req.Header.Set("Authorization", "Bearer "+internalToken)
		if cookieHeader != "" {
			req.Header.Set("Cookie", cookieHeader)
		}
		if sessionToken != "" {
			req.Header.Set("X-Session-Token", sessionToken)
		}

		resp, err := h.httpClient.Do(req)
		if err != nil {
			return isTransientNetError(err), true, err
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusUnauthorized {
			return false, false, errUnauthorized
		}
		if resp.StatusCode != http.StatusOK {
			return isTransientHTTPStatus(resp.StatusCode), true, fmt.Errorf("auth status=%d", resp.StatusCode)
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			return false, true, err
		}
		if payload.IdentityID == "" {
			return false, true, errors.New("missing identity id")
		}
		return false, true, nil
	})
	if err != nil {
		return "", err
	}
	return payload.IdentityID, nil
}

func (h *Handler) resolveUserID(ctx context.Context, identityID string) (int64, error) {
	var payload struct {
		ID int64 `json:"id"`
	}
	token, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, "user-service", internalTokenClaims{
		IdentityID: identityID,
	})
	if err != nil {
		return 0, fmt.Errorf("sign internal jwt: %w", err)
	}

	err = h.executeDependencyCall(ctx, h.userBreaker, h.userBulkhead, 3, 50*time.Millisecond, 800*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		req, err := http.NewRequestWithContext(attemptCtx, http.MethodGet, h.userURL+"/users/by-auth/"+url.PathEscape(identityID), nil)
		if err != nil {
			return false, true, err
		}
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := h.httpClient.Do(req)
		if err != nil {
			return isTransientNetError(err), true, err
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound {
			return false, false, errors.New("user not found")
		}
		if resp.StatusCode != http.StatusOK {
			return isTransientHTTPStatus(resp.StatusCode), true, fmt.Errorf("user status=%d", resp.StatusCode)
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			return false, true, err
		}
		if payload.ID <= 0 {
			return false, true, errors.New("invalid user id")
		}
		return false, true, nil
	})
	if err != nil {
		return 0, err
	}
	return payload.ID, nil
}

func (h *Handler) resolveOrganizationID(ctx context.Context, userID int64) (int64, error) {
	var payload []struct {
		OrganizationID string `json:"organizationId"`
	}
	token, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, "organizations-service", internalTokenClaims{
		UserID: userID,
	})
	if err != nil {
		return 0, fmt.Errorf("sign internal jwt: %w", err)
	}

	err = h.executeDependencyCall(ctx, h.organizationBreaker, h.organizationBulkhead, 3, 50*time.Millisecond, 800*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		req, err := http.NewRequestWithContext(attemptCtx, http.MethodGet, h.organizationsURL+"/organizations/me", nil)
		if err != nil {
			return false, true, err
		}
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := h.httpClient.Do(req)
		if err != nil {
			return isTransientNetError(err), true, err
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound {
			return false, false, errors.New("organization not found")
		}
		if resp.StatusCode != http.StatusOK {
			return isTransientHTTPStatus(resp.StatusCode), true, fmt.Errorf("organizations status=%d", resp.StatusCode)
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			return false, true, err
		}
		if len(payload) == 0 {
			return false, false, errors.New("organization not found")
		}
		return false, true, nil
	})
	if err != nil {
		return 0, err
	}
	organizationID, err := organizationIDFromHeader(payload[0].OrganizationID)
	if err != nil {
		return 0, err
	}
	return organizationID, nil
}
