package googleanalytics

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestAuthorizationURLRequestsAnalyticsEditScope(t *testing.T) {
	client, err := NewClient("client-id", "client-secret")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	rawURL, err := client.AuthorizationURL("state-token", "https://app.example/callback")
	if err != nil {
		t.Fatalf("authorization url: %v", err)
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse authorization url: %v", err)
	}

	if got := parsed.Query().Get("scope"); got != analyticsEditScope {
		t.Fatalf("expected analytics edit scope %q, got %q", analyticsEditScope, got)
	}
}

func TestBuildLLMChannelGroupPayloadUsesGA4AdminShape(t *testing.T) {
	payload := buildLLMChannelGroup(defaultLLMSourceRegex)
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal channel group payload: %v", err)
	}
	body := string(raw)

	if !strings.Contains(body, `"andGroup"`) {
		t.Fatalf("expected top-level andGroup in payload: %s", body)
	}
	if !strings.Contains(body, `"orGroup"`) {
		t.Fatalf("expected nested orGroup in payload: %s", body)
	}
	if !strings.Contains(body, `"fieldName":"sessionSource"`) {
		t.Fatalf("expected sessionSource filter in payload: %s", body)
	}
	if !strings.Contains(body, `"matchType":"FULL_REGEXP"`) {
		t.Fatalf("expected full regexp match in payload: %s", body)
	}
	if strings.Contains(body, "caseSensitive") {
		t.Fatalf("channel group payload must omit caseSensitive: %s", body)
	}
}

func TestBuildLLMCustomDimensionPayload(t *testing.T) {
	payload := buildLLMCustomDimension()

	if payload.ParameterName != "llm_source" {
		t.Fatalf("expected llm_source parameter, got %q", payload.ParameterName)
	}
	if payload.Scope != "EVENT" {
		t.Fatalf("expected event scoped custom dimension, got %q", payload.Scope)
	}
}

func TestSetupLLMTrackingReusesExistingResources(t *testing.T) {
	createCalls := 0
	client, err := NewClient("client-id", "client-secret")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.Host == "oauth2.googleapis.com" && req.URL.Path == "/token":
				return jsonResponse(http.StatusOK, `{"access_token":"access-token"}`), nil
			case req.Method == http.MethodGet && req.URL.Path == "/v1alpha/properties/123/channelGroups":
				return jsonResponse(http.StatusOK, `{"channelGroups":[{"name":"properties/123/channelGroups/456","displayName":"AI / LLM Channel Group"}]}`), nil
			case req.Method == http.MethodGet && req.URL.Path == "/v1beta/properties/123/customDimensions":
				return jsonResponse(http.StatusOK, `{"customDimensions":[{"name":"properties/123/customDimensions/789","parameterName":"llm_source","displayName":"LLM Source","scope":"EVENT"}]}`), nil
			case req.Method == http.MethodPost && strings.Contains(req.URL.Path, "/channelGroups"):
				createCalls++
				return jsonResponse(http.StatusCreated, `{}`), nil
			case req.Method == http.MethodPost && strings.Contains(req.URL.Path, "/customDimensions"):
				createCalls++
				return jsonResponse(http.StatusCreated, `{}`), nil
			default:
				t.Fatalf("unexpected request %s %s", req.Method, req.URL.String())
				return nil, nil
			}
		}),
	}

	result, err := client.SetupLLMTracking(t.Context(), "refresh-token", "123")
	if err != nil {
		t.Fatalf("setup llm tracking: %v", err)
	}
	if createCalls != 0 {
		t.Fatalf("expected setup to reuse existing resources, got %d create calls", createCalls)
	}
	if result.SetupStatus != "success" {
		t.Fatalf("expected success status, got %+v", result)
	}
	if result.CreatedResources.ChannelGroupName != "properties/123/channelGroups/456" {
		t.Fatalf("expected existing channel group name, got %+v", result.CreatedResources)
	}
	if result.CreatedResources.CustomDimensionName != "properties/123/customDimensions/789" {
		t.Fatalf("expected existing custom dimension name, got %+v", result.CreatedResources)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
