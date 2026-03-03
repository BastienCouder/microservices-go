package http

import (
	"net/http"
)

func (h *Handler) serveProxyWithInternalAuth(
	w http.ResponseWriter,
	r *http.Request,
	next http.Handler,
	audience string,
	claims internalTokenClaims,
) {
	token, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, audience, claims)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "internal jwt signing failure")
		return
	}
	r2 := r.Clone(r.Context())
	r2.Header = r.Header.Clone()
	r2.Header.Del("X-Authenticated-Identity-ID")
	r2.Header.Del("X-Authenticated-User-ID")
	r2.Header.Del("X-Organization-ID")
	r2.Header.Set("Authorization", "Bearer "+token)
	next.ServeHTTP(w, r2)
}
