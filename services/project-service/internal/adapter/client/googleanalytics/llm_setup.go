package googleanalytics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

const (
	defaultLLMSourceRegex      = ".*(openai|chatgpt|perplexity|claude|anthropic|gemini|bard|copilot|grok|deepseek|mistral|you\\.com|phind).*"
	llmChannelGroupDisplayName = "AI / LLM Channel Group"
	llmChannelDisplayName      = "AI Assistants"
	llmCustomDimensionParam    = "llm_source"
	googleAnalyticsAdminURL    = "https://analyticsadmin.googleapis.com"
)

type channelGroup struct {
	Name         string         `json:"name,omitempty"`
	DisplayName  string         `json:"displayName"`
	Description  string         `json:"description,omitempty"`
	GroupingRule []groupingRule `json:"groupingRule"`
}

type groupingRule struct {
	DisplayName string                       `json:"displayName"`
	Expression  channelGroupFilterExpression `json:"expression"`
}

type channelGroupFilterExpression struct {
	AndGroup *channelGroupFilterExpressionList `json:"andGroup,omitempty"`
	OrGroup  *channelGroupFilterExpressionList `json:"orGroup,omitempty"`
	Filter   *channelGroupFilter               `json:"filter,omitempty"`
}

type channelGroupFilterExpressionList struct {
	FilterExpressions []channelGroupFilterExpression `json:"filterExpressions"`
}

type channelGroupFilter struct {
	FieldName    string              `json:"fieldName"`
	StringFilter channelStringFilter `json:"stringFilter"`
}

type channelStringFilter struct {
	MatchType string `json:"matchType"`
	Value     string `json:"value"`
}

type customDimension struct {
	Name          string `json:"name,omitempty"`
	ParameterName string `json:"parameterName"`
	DisplayName   string `json:"displayName"`
	Description   string `json:"description,omitempty"`
	Scope         string `json:"scope"`
}

func (c *Client) SetupLLMTracking(ctx context.Context, refreshToken, propertyID string) (usecase.GA4LLMSetupResult, error) {
	property := normalizeGA4Property(propertyID)
	if property == "" {
		return usecase.GA4LLMSetupResult{}, fmt.Errorf("ga4 property id is required")
	}
	accessToken, err := c.refreshAccessToken(ctx, refreshToken)
	if err != nil {
		return usecase.GA4LLMSetupResult{}, err
	}

	var result usecase.GA4LLMSetupResult
	channelGroupName, channelGroupErr := c.ensureLLMChannelGroup(ctx, accessToken, property)
	if channelGroupErr != nil {
		result.Errors = append(result.Errors, usecase.GA4LLMSetupError{
			Resource: "channelGroup",
			Message:  channelGroupErr.Error(),
		})
	} else {
		result.CreatedResources.ChannelGroupName = channelGroupName
	}

	customDimensionName, customDimensionErr := c.ensureLLMCustomDimension(ctx, accessToken, property)
	if customDimensionErr != nil {
		result.Errors = append(result.Errors, usecase.GA4LLMSetupError{
			Resource: "customDimension",
			Message:  customDimensionErr.Error(),
		})
	} else {
		result.CreatedResources.CustomDimensionName = customDimensionName
	}

	result.SetupStatus = setupStatus(result)
	return result, nil
}

func (c *Client) ensureLLMChannelGroup(ctx context.Context, accessToken, property string) (string, error) {
	groups, err := c.listChannelGroups(ctx, accessToken, property)
	if err != nil {
		return "", err
	}
	for _, group := range groups {
		if strings.EqualFold(strings.TrimSpace(group.DisplayName), llmChannelGroupDisplayName) {
			return strings.TrimSpace(group.Name), nil
		}
	}
	created, err := c.createChannelGroup(ctx, accessToken, property, buildLLMChannelGroup(defaultLLMSourceRegex))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(created.Name), nil
}

func (c *Client) ensureLLMCustomDimension(ctx context.Context, accessToken, property string) (string, error) {
	dimensions, err := c.listCustomDimensions(ctx, accessToken, property)
	if err != nil {
		return "", err
	}
	for _, dimension := range dimensions {
		if strings.EqualFold(strings.TrimSpace(dimension.ParameterName), llmCustomDimensionParam) {
			return strings.TrimSpace(dimension.Name), nil
		}
	}
	created, err := c.createCustomDimension(ctx, accessToken, property, buildLLMCustomDimension())
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(created.Name), nil
}

func (c *Client) listChannelGroups(ctx context.Context, accessToken, property string) ([]channelGroup, error) {
	endpoint := googleAnalyticsAdminURL + "/v1alpha/" + property + "/channelGroups?pageSize=200"
	var payload struct {
		ChannelGroups []channelGroup `json:"channelGroups"`
	}
	if err := c.getAdminJSON(ctx, accessToken, endpoint, &payload); err != nil {
		return nil, err
	}
	return payload.ChannelGroups, nil
}

func (c *Client) createChannelGroup(ctx context.Context, accessToken, property string, body channelGroup) (channelGroup, error) {
	endpoint := googleAnalyticsAdminURL + "/v1alpha/" + property + "/channelGroups"
	var created channelGroup
	if err := c.postAdminJSON(ctx, accessToken, endpoint, body, &created); err != nil {
		return channelGroup{}, err
	}
	return created, nil
}

func (c *Client) listCustomDimensions(ctx context.Context, accessToken, property string) ([]customDimension, error) {
	endpoint := googleAnalyticsAdminURL + "/v1beta/" + property + "/customDimensions?pageSize=200"
	var payload struct {
		CustomDimensions []customDimension `json:"customDimensions"`
	}
	if err := c.getAdminJSON(ctx, accessToken, endpoint, &payload); err != nil {
		return nil, err
	}
	return payload.CustomDimensions, nil
}

func (c *Client) createCustomDimension(ctx context.Context, accessToken, property string, body customDimension) (customDimension, error) {
	endpoint := googleAnalyticsAdminURL + "/v1beta/" + property + "/customDimensions"
	var created customDimension
	if err := c.postAdminJSON(ctx, accessToken, endpoint, body, &created); err != nil {
		return customDimension{}, err
	}
	return created, nil
}

func (c *Client) getAdminJSON(ctx context.Context, accessToken, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("create ga4 admin request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send ga4 admin request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return readGoogleError(resp, "ga4 admin")
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode ga4 admin response: %w", err)
	}
	return nil
}

func (c *Client) postAdminJSON(ctx context.Context, accessToken, endpoint string, body, out any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal ga4 admin payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("create ga4 admin request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send ga4 admin request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return readGoogleError(resp, "ga4 admin")
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode ga4 admin response: %w", err)
	}
	return nil
}

func buildLLMChannelGroup(llmRegex string) channelGroup {
	llmRegex = strings.TrimSpace(llmRegex)
	if llmRegex == "" {
		llmRegex = defaultLLMSourceRegex
	}
	return channelGroup{
		DisplayName: llmChannelGroupDisplayName,
		Description: "Classe le trafic provenant des assistants IA",
		GroupingRule: []groupingRule{
			{
				DisplayName: llmChannelDisplayName,
				Expression: channelGroupFilterExpression{
					AndGroup: &channelGroupFilterExpressionList{
						FilterExpressions: []channelGroupFilterExpression{
							{
								OrGroup: &channelGroupFilterExpressionList{
									FilterExpressions: []channelGroupFilterExpression{
										{
											Filter: &channelGroupFilter{
												FieldName: "sessionSource",
												StringFilter: channelStringFilter{
													MatchType: "FULL_REGEXP",
													Value:     llmRegex,
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func buildLLMCustomDimension() customDimension {
	return customDimension{
		ParameterName: llmCustomDimensionParam,
		DisplayName:   "LLM Source",
		Description:   "Source LLM normalisee envoyee par l app",
		Scope:         "EVENT",
	}
}

func normalizeGA4Property(propertyID string) string {
	propertyID = strings.TrimSpace(propertyID)
	propertyID = strings.TrimPrefix(propertyID, "/")
	if propertyID == "" {
		return ""
	}
	if strings.HasPrefix(propertyID, "properties/") {
		return propertyID
	}
	return "properties/" + propertyID
}

func setupStatus(result usecase.GA4LLMSetupResult) string {
	successes := 0
	if strings.TrimSpace(result.CreatedResources.ChannelGroupName) != "" {
		successes++
	}
	if strings.TrimSpace(result.CreatedResources.CustomDimensionName) != "" {
		successes++
	}
	if len(result.Errors) == 0 && successes == 2 {
		return usecase.GA4LLMSetupStatusSuccess
	}
	if successes > 0 {
		return usecase.GA4LLMSetupStatusPartialSuccess
	}
	return usecase.GA4LLMSetupStatusFailed
}
