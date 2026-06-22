package http

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
)

func (h *Handler) handleDeleteOrganizationCascade(w http.ResponseWriter, r *http.Request) {
	organizationID, userID, ok := orgAndUserIDsFromRequest(w, r)
	if !ok {
		return
	}

	claims := internalTokenClaims{
		IdentityID:   r.Header.Get("X-Authenticated-Identity-ID"),
		UserID:       userID,
		Organization: organizationID,
	}

	if err := h.cancelOrganizationBilling(r.Context(), claims); err != nil {
		writeJSONError(w, http.StatusBadGateway, "billing dependency unavailable")
		return
	}

	statusCode, headers, body, err := h.forwardOrganizationDelete(r.Context(), r, claims)
	if err != nil {
		if statusCode > 0 {
			copyResponseHeaders(w.Header(), headers)
			w.WriteHeader(statusCode)
			if len(body) > 0 {
				_, _ = w.Write(body)
			}
			return
		}
		writeJSONError(w, http.StatusBadGateway, "organization dependency unavailable")
		return
	}

	copyResponseHeaders(w.Header(), headers)
	w.WriteHeader(statusCode)
	if len(body) > 0 {
		_, _ = w.Write(body)
	}
}

func (h *Handler) cancelOrganizationBilling(ctx context.Context, claims internalTokenClaims) error {
	_, _, _, err := h.doInternalServiceRequest(
		ctx,
		"billing-service",
		h.billingURL+"/billing/subscriptions/cancel",
		http.MethodPost,
		nil,
		claims,
	)
	return err
}

func (h *Handler) forwardOrganizationDelete(
	ctx context.Context,
	r *http.Request,
	claims internalTokenClaims,
) (int, http.Header, []byte, error) {
	return h.doInternalServiceRequest(
		ctx,
		"organizations-service",
		h.organizationsURL+r.URL.RequestURI(),
		http.MethodDelete,
		nil,
		claims,
	)
}

func (h *Handler) doInternalServiceRequest(
	ctx context.Context,
	audience string,
	targetURL string,
	method string,
	body []byte,
	claims internalTokenClaims,
) (int, http.Header, []byte, error) {
	token, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, audience, claims)
	if err != nil {
		return 0, nil, nil, fmt.Errorf("sign internal jwt: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, method, targetURL, bytes.NewReader(body))
	if err != nil {
		return 0, nil, nil, fmt.Errorf("create request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)
	if claims.IdentityID != "" {
		request.Header.Set("X-Authenticated-Identity-ID", claims.IdentityID)
	}
	if claims.UserID > 0 {
		request.Header.Set("X-Authenticated-User-ID", strconv.FormatInt(claims.UserID, 10))
	}
	if claims.Organization > 0 {
		request.Header.Set("X-Organization-ID", strconv.FormatInt(claims.Organization, 10))
	}
	if len(body) > 0 {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := h.httpClient.Do(request)
	if err != nil {
		return 0, nil, nil, err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return 0, nil, nil, fmt.Errorf("read response: %w", err)
	}
	if response.StatusCode >= http.StatusBadRequest {
		return response.StatusCode, response.Header.Clone(), responseBody, fmt.Errorf("%s status=%d", audience, response.StatusCode)
	}
	return response.StatusCode, response.Header.Clone(), responseBody, nil
}

func copyResponseHeaders(target http.Header, source http.Header) {
	for key, values := range source {
		switch http.CanonicalHeaderKey(key) {
		case "Content-Length", "Transfer-Encoding", "Connection":
			continue
		}
		for _, value := range values {
			target.Add(key, value)
		}
	}
}
