package googleanalytics

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"net/url"
	"strconv"
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
	payload := buildLLMChannelGroup(defaultLLMSourceRegex, "Source", llmChannelGroupFilterModeRegex, nil)
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal channel group payload: %v", err)
	}
	body := string(raw)

	if !strings.Contains(body, `"displayName":"Default + AI"`) {
		t.Fatalf("expected tutorial channel group name in payload: %s", body)
	}
	if !strings.Contains(body, `"displayName":"AI"`) {
		t.Fatalf("expected tutorial AI channel name in payload: %s", body)
	}
	if !strings.Contains(body, `"andGroup"`) {
		t.Fatalf("expected top-level andGroup in payload: %s", body)
	}
	if !strings.Contains(body, `"orGroup"`) {
		t.Fatalf("expected nested orGroup in payload: %s", body)
	}
	if !strings.Contains(body, `"fieldName":"Source"`) {
		t.Fatalf("expected Source filter in payload: %s", body)
	}
	if !strings.Contains(body, `"matchType":"FULL_REGEXP"`) {
		t.Fatalf("expected full regexp match in payload: %s", body)
	}
	if !strings.Contains(body, "(?i)") {
		t.Fatalf("expected case-insensitive AI traffic regex in payload: %s", body)
	}
	if !strings.Contains(body, "copy\\\\.ai") || !strings.Contains(body, "chat-gpt\\\\.org") {
		t.Fatalf("expected GA4 AI traffic skill sources in payload: %s", body)
	}
	if strings.Contains(body, "qwen") || strings.Contains(body, "z\\\\.ai") || strings.Contains(body, "poe") {
		t.Fatalf("expected exact tutorial regex without extra AI sources in payload: %s", body)
	}
	if strings.Contains(body, "caseSensitive") {
		t.Fatalf("channel group payload must omit caseSensitive: %s", body)
	}
	if strings.Contains(body, "inListFilter") {
		t.Fatalf("regex channel group payload must omit inListFilter: %s", body)
	}
}

func TestBuildLLMChannelGroupPayloadSupportsInListFallback(t *testing.T) {
	payload := buildLLMChannelGroup(defaultLLMSourceRegex, "source", llmChannelGroupFilterModeInList, nil)
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal channel group payload: %v", err)
	}
	body := string(raw)

	if !strings.Contains(body, `"fieldName":"source"`) {
		t.Fatalf("expected source filter in payload: %s", body)
	}
	if !strings.Contains(body, `"inListFilter"`) {
		t.Fatalf("expected inListFilter fallback in payload: %s", body)
	}
	if !strings.Contains(body, `"chatgpt.com"`) {
		t.Fatalf("expected LLM source values in payload: %s", body)
	}
	if strings.Contains(body, "stringFilter") {
		t.Fatalf("in-list channel group payload must omit stringFilter: %s", body)
	}
}

func TestCreateLLMChannelGroupRetriesSourceFieldCandidates(t *testing.T) {
	attempts := []string(nil)
	client, err := NewClient("client-id", "client-secret")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.Method != http.MethodPost || req.URL.Path != "/v1alpha/properties/123/channelGroups" {
				t.Fatalf("unexpected request %s %s", req.Method, req.URL.String())
			}
			var payload channelGroup
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				t.Fatalf("decode request body: %v", err)
			}
			filter := payload.GroupingRule[0].Expression.AndGroup.FilterExpressions[0].OrGroup.FilterExpressions[0].Filter
			mode := "regex"
			if filter.InListFilter != nil {
				mode = "in_list"
			}
			attempts = append(attempts, filter.FieldName+"/"+mode)
			if filter.FieldName != "source" || filter.StringFilter == nil {
				return jsonResponse(http.StatusBadRequest, `{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.PreconditionFailure","violations":[{"type":"analyticsadminservice:unsupported-channel-grouping-field","description":"The provided channel grouping contained a 'field_name' that is not supported."}]}]}}`), nil
			}
			return jsonResponse(http.StatusCreated, `{"name":"properties/123/channelGroups/456","displayName":"Default + AI"}`), nil
		}),
	}

	created, err := client.createLLMChannelGroup(t.Context(), "access-token", "properties/123", defaultLLMSourceRegex, nil)
	if err != nil {
		t.Fatalf("create llm channel group: %v", err)
	}
	if created.Name != "properties/123/channelGroups/456" {
		t.Fatalf("expected created channel group, got %+v", created)
	}
	if strings.Join(attempts, ",") != "Source/regex,Source/in_list,source/regex" {
		t.Fatalf("expected retry from Source regex/in-list to source regex, got %v", attempts)
	}
}

func TestCreateLLMChannelGroupFallsBackToInListFilter(t *testing.T) {
	attempts := []string(nil)
	client, err := NewClient("client-id", "client-secret")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.Method != http.MethodPost || req.URL.Path != "/v1alpha/properties/123/channelGroups" {
				t.Fatalf("unexpected request %s %s", req.Method, req.URL.String())
			}
			var payload channelGroup
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				t.Fatalf("decode request body: %v", err)
			}
			filter := payload.GroupingRule[0].Expression.AndGroup.FilterExpressions[0].OrGroup.FilterExpressions[0].Filter
			mode := "regex"
			if filter.InListFilter != nil {
				mode = "in_list"
			}
			attempts = append(attempts, filter.FieldName+"/"+mode)
			if filter.FieldName != "Source" || filter.InListFilter == nil {
				return jsonResponse(http.StatusBadRequest, `{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}`), nil
			}
			return jsonResponse(http.StatusCreated, `{"name":"properties/123/channelGroups/456","displayName":"Default + AI"}`), nil
		}),
	}

	created, err := client.createLLMChannelGroup(t.Context(), "access-token", "properties/123", defaultLLMSourceRegex, nil)
	if err != nil {
		t.Fatalf("create llm channel group: %v", err)
	}
	if created.Name != "properties/123/channelGroups/456" {
		t.Fatalf("expected created channel group, got %+v", created)
	}
	if strings.Join(attempts, ",") != "Source/regex,Source/in_list" {
		t.Fatalf("expected retry from Source regex to Source in-list, got %v", attempts)
	}
}

func TestBuildLLMChannelGroupInsertsAIChannelBeforeReferral(t *testing.T) {
	baseRules := []groupingRule{
		{DisplayName: "Organic Search"},
		{DisplayName: "Referral"},
		{DisplayName: "Paid Search"},
	}

	payload := buildLLMChannelGroup(defaultLLMSourceRegex, "Source", llmChannelGroupFilterModeRegex, baseRules)

	if len(payload.GroupingRule) != 4 {
		t.Fatalf("expected AI plus copied default rules, got %+v", payload.GroupingRule)
	}
	if payload.GroupingRule[1].DisplayName != "AI" || payload.GroupingRule[2].DisplayName != "Referral" {
		t.Fatalf("expected AI before Referral, got %+v", payload.GroupingRule)
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
	patchCalls := 0
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
				return jsonResponse(http.StatusOK, `{"channelGroups":[{"name":"properties/123/channelGroups/456","displayName":"AI / LLM Channel Group","groupingRule":[{"displayName":"AI Assistants","expression":{"andGroup":{"filterExpressions":[{"orGroup":{"filterExpressions":[{"filter":{"fieldName":"eachScopeSource","stringFilter":{"matchType":"FULL_REGEXP","value":".*(chatgpt).*"}}}]}}]}}}]}]}`), nil
			case req.Method == http.MethodPatch && req.URL.Path == "/v1alpha/properties/123/channelGroups/456":
				patchCalls++
				if req.URL.Query().Get("updateMask") != "displayName,description,groupingRule" {
					t.Fatalf("unexpected updateMask: %s", req.URL.RawQuery)
				}
				var payload channelGroup
				if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
					t.Fatalf("decode patch request body: %v", err)
				}
				filter := payload.GroupingRule[0].Expression.AndGroup.FilterExpressions[0].OrGroup.FilterExpressions[0].Filter
				if payload.DisplayName != "Default + AI" || payload.GroupingRule[0].DisplayName != "AI" {
					t.Fatalf("expected tutorial channel group naming, got %+v", payload)
				}
				if filter.FieldName != "Source" || filter.StringFilter == nil || !strings.Contains(filter.StringFilter.Value, "copy\\.ai") {
					t.Fatalf("expected tutorial Source regex update, got %+v", filter)
				}
				return jsonResponse(http.StatusOK, `{"name":"properties/123/channelGroups/456","displayName":"Default + AI"}`), nil
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
	if patchCalls != 1 {
		t.Fatalf("expected setup to update existing channel group once, got %d patch calls", patchCalls)
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

func TestSetupLLMTrackingWithServiceAccountCreatesAccessTokenAndResources(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}
	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})
	client, err := NewClient("", "")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	tokenCalls := 0
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.Host == "oauth2.googleapis.com" && req.URL.Path == "/token":
				tokenCalls++
				if req.Method != http.MethodPost {
					t.Fatalf("expected POST token request, got %s", req.Method)
				}
				return jsonResponse(http.StatusOK, `{"access_token":"service-account-access-token"}`), nil
			case req.Method == http.MethodGet && req.URL.Path == "/v1alpha/properties/123/channelGroups":
				return jsonResponse(http.StatusOK, `{"channelGroups":[]}`), nil
			case req.Method == http.MethodPost && req.URL.Path == "/v1alpha/properties/123/channelGroups":
				return jsonResponse(http.StatusCreated, `{"name":"properties/123/channelGroups/456","displayName":"Default + AI"}`), nil
			case req.Method == http.MethodGet && req.URL.Path == "/v1beta/properties/123/customDimensions":
				return jsonResponse(http.StatusOK, `{"customDimensions":[]}`), nil
			case req.Method == http.MethodPost && req.URL.Path == "/v1beta/properties/123/customDimensions":
				return jsonResponse(http.StatusCreated, `{"name":"properties/123/customDimensions/789","parameterName":"llm_source","displayName":"LLM Source","scope":"EVENT"}`), nil
			default:
				t.Fatalf("unexpected request %s %s", req.Method, req.URL.String())
				return nil, nil
			}
		}),
	}

	result, err := client.SetupLLMTrackingWithServiceAccount(
		t.Context(),
		`{"client_email":"ga4@example.iam.gserviceaccount.com","private_key":`+strconv.Quote(string(privateKeyPEM))+`}`,
		"123",
	)
	if err != nil {
		t.Fatalf("setup llm tracking with service account: %v", err)
	}
	if tokenCalls != 1 {
		t.Fatalf("expected exactly one token exchange, got %d", tokenCalls)
	}
	if result.SetupStatus != "success" {
		t.Fatalf("expected success result, got %+v", result)
	}
	if result.CreatedResources.ChannelGroupName != "properties/123/channelGroups/456" {
		t.Fatalf("expected created channel group name, got %+v", result.CreatedResources)
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
