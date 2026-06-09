package http

import (
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, payload any) {
	httpjson.WriteJSON(w, status, payload)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	httpjson.WriteError(w, status, message)
}
