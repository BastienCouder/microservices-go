package googleanalytics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

const (
	defaultLLMSourceRegex      = "(?i)(.*chatgpt.*|.*perplexity.*|.*claude\\.ai.*|.*copilot\\.microsoft\\.com.*|.*openai\\.com.*|.*gemini\\.google\\.com.*|.*edgeservices.*|.*edgepilot.*|.*nimble\\.ai.*|.*iask\\.ai.*|.*writesonic\\.com.*|.*copy\\.ai.*|.*chat-gpt\\.org.*)"
	llmChannelGroupDisplayName = "Default + AI"
	llmChannelDisplayName      = "AI"
	legacyLLMChannelGroupName  = "AI / LLM Channel Group"
	legacyLLMChannelName       = "AI Assistants"
	llmCustomDimensionParam    = "llm_source"
	googleAnalyticsAdminURL    = "https://analyticsadmin.googleapis.com"
)

var llmChannelGroupSourceFieldCandidates = []string{
	"Source",
	"source",
	"sessionSource",
	"session_source",
	"sessionSourceMedium",
	"session_source_medium",
	// The Admin API serializes the UI "Source" field as eachScopeSource.
	"eachScopeSource",
	"firstUserSource",
	"first_user_source",
	"manualSource",
	"manual_source",
	"trafficSource.source",
	"traffic_source.source",
}

var llmSourceValues = []string{
	"chatgpt.com",
	"openai.com",
	"perplexity.ai",
	"claude.ai",
	"gemini.google.com",
	"copilot.microsoft.com",
	"edgeservices.bing.com",
	"edgepilot.microsoft.com",
	"nimble.ai",
	"iask.ai",
	"writesonic.com",
	"copy.ai",
	"chat-gpt.org",
}

type llmChannelGroupFilterMode string

const (
	llmChannelGroupFilterModeRegex  llmChannelGroupFilterMode = "regex"
	llmChannelGroupFilterModeInList llmChannelGroupFilterMode = "in_list"
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
	FieldName    string               `json:"fieldName"`
	StringFilter *channelStringFilter `json:"stringFilter,omitempty"`
	InListFilter *channelInListFilter `json:"inListFilter,omitempty"`
}

type channelStringFilter struct {
	MatchType string `json:"matchType"`
	Value     string `json:"value"`
}

type channelInListFilter struct {
	Values []string `json:"values"`
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
	return c.setupLLMTrackingWithAccessToken(ctx, accessToken, property), nil
}

func (c *Client) ensureLLMChannelGroup(ctx context.Context, accessToken, property string) (string, error) {
	groups, err := c.listChannelGroups(ctx, accessToken, property)
	if err != nil {
		return "", err
	}
	if fields := collectChannelGroupFieldNames(groups); len(fields) > 0 {
		log.Printf("ga4 existing channel group fields property=%s fields=%s", property, strings.Join(fields, ","))
	}
	defaultRules := findDefaultChannelGroupRules(groups)
	for _, group := range groups {
		if isAIChannelGroupName(group.DisplayName) {
			return c.updateLLMChannelGroup(ctx, accessToken, property, group, defaultRules)
		}
	}
	created, err := c.createLLMChannelGroup(ctx, accessToken, property, defaultLLMSourceRegex, defaultRules)
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

func collectChannelGroupFieldNames(groups []channelGroup) []string {
	seen := map[string]struct{}{}
	fields := []string(nil)
	for _, group := range groups {
		for _, rule := range group.GroupingRule {
			collectChannelGroupExpressionFieldNames(rule.Expression, seen, &fields)
		}
	}
	return fields
}

func collectChannelGroupExpressionFieldNames(expression channelGroupFilterExpression, seen map[string]struct{}, fields *[]string) {
	if expression.Filter != nil {
		fieldName := strings.TrimSpace(expression.Filter.FieldName)
		if fieldName != "" {
			if _, ok := seen[fieldName]; !ok {
				seen[fieldName] = struct{}{}
				*fields = append(*fields, fieldName)
			}
		}
	}
	if expression.AndGroup != nil {
		for _, child := range expression.AndGroup.FilterExpressions {
			collectChannelGroupExpressionFieldNames(child, seen, fields)
		}
	}
	if expression.OrGroup != nil {
		for _, child := range expression.OrGroup.FilterExpressions {
			collectChannelGroupExpressionFieldNames(child, seen, fields)
		}
	}
}

func preferredLLMChannelGroupUpdateFields(existing channelGroup) []string {
	seen := map[string]struct{}{}
	fields := []string(nil)
	for _, fieldName := range llmChannelGroupSourceFieldCandidates {
		fieldName = strings.TrimSpace(fieldName)
		if fieldName == "" {
			continue
		}
		seen[fieldName] = struct{}{}
		fields = append(fields, fieldName)
	}
	for _, rule := range existing.GroupingRule {
		collectChannelGroupExpressionFieldNames(rule.Expression, seen, &fields)
	}
	return fields
}

func (c *Client) createChannelGroup(ctx context.Context, accessToken, property string, body channelGroup) (channelGroup, error) {
	endpoint := googleAnalyticsAdminURL + "/v1alpha/" + property + "/channelGroups"
	var created channelGroup
	if err := c.postAdminJSON(ctx, accessToken, endpoint, body, &created); err != nil {
		return channelGroup{}, err
	}
	return created, nil
}

func (c *Client) patchChannelGroup(ctx context.Context, accessToken string, body channelGroup) error {
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return fmt.Errorf("ga4 channel group name is required")
	}
	endpoint := googleAnalyticsAdminURL + "/v1alpha/" + name + "?updateMask=displayName,description,groupingRule"
	var updated channelGroup
	return c.patchAdminJSON(ctx, accessToken, endpoint, body, &updated)
}

func (c *Client) createLLMChannelGroup(ctx context.Context, accessToken, property, llmRegex string, baseRules []groupingRule) (channelGroup, error) {
	var errors []string
	for _, fieldName := range llmChannelGroupSourceFieldCandidates {
		for _, mode := range []llmChannelGroupFilterMode{llmChannelGroupFilterModeRegex, llmChannelGroupFilterModeInList} {
			created, err := c.createChannelGroup(ctx, accessToken, property, buildLLMChannelGroup(llmRegex, fieldName, mode, baseRules))
			if err == nil {
				log.Printf("ga4 llm channel group created property=%s field=%s mode=%s name=%s", property, fieldName, mode, strings.TrimSpace(created.Name))
				return created, nil
			}
			log.Printf("ga4 llm channel group create rejected property=%s field=%s mode=%s error=%v", property, fieldName, mode, err)
			errors = append(errors, fmt.Sprintf("%s/%s: %v", fieldName, mode, err))
		}
	}
	return channelGroup{}, fmt.Errorf("create ga4 llm channel group failed for source field/filter candidates: %s", strings.Join(errors, " | "))
}

func (c *Client) updateLLMChannelGroup(ctx context.Context, accessToken, property string, existing channelGroup, defaultRules []groupingRule) (string, error) {
	name := strings.TrimSpace(existing.Name)
	if name == "" {
		return "", fmt.Errorf("existing ga4 llm channel group name is empty")
	}
	baseRules := existing.GroupingRule
	if len(baseRules) <= 1 && len(defaultRules) > 0 {
		baseRules = defaultRules
	}
	var errors []string
	for _, fieldName := range preferredLLMChannelGroupUpdateFields(existing) {
		updated := buildLLMChannelGroup(defaultLLMSourceRegex, fieldName, llmChannelGroupFilterModeRegex, baseRules)
		updated.Name = name
		if err := c.patchChannelGroup(ctx, accessToken, updated); err == nil {
			log.Printf("ga4 llm channel group updated property=%s field=%s name=%s", property, fieldName, name)
			return name, nil
		} else {
			log.Printf("ga4 llm channel group update rejected property=%s field=%s error=%v", property, fieldName, err)
			errors = append(errors, fmt.Sprintf("%s: %v", fieldName, err))
		}
	}
	return "", fmt.Errorf("update ga4 llm channel group failed for source field candidates: %s", strings.Join(errors, " | "))
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
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return readGoogleError(resp, "ga4 admin")
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode ga4 admin response: %w", err)
	}
	return nil
}

func (c *Client) postAdminJSON(ctx context.Context, accessToken, endpoint string, body, out any) error {
	return c.sendAdminJSON(ctx, http.MethodPost, accessToken, endpoint, body, out)
}

func (c *Client) patchAdminJSON(ctx context.Context, accessToken, endpoint string, body, out any) error {
	return c.sendAdminJSON(ctx, http.MethodPatch, accessToken, endpoint, body, out)
}

func (c *Client) sendAdminJSON(ctx context.Context, method, accessToken, endpoint string, body, out any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal ga4 admin payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("create ga4 admin request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send ga4 admin request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return readGoogleError(resp, "ga4 admin")
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode ga4 admin response: %w", err)
	}
	return nil
}

func buildLLMChannelGroup(llmRegex, sourceFieldName string, mode llmChannelGroupFilterMode, baseRules []groupingRule) channelGroup {
	llmRegex = strings.TrimSpace(llmRegex)
	if llmRegex == "" {
		llmRegex = defaultLLMSourceRegex
	}
	sourceFieldName = strings.TrimSpace(sourceFieldName)
	if sourceFieldName == "" {
		sourceFieldName = llmChannelGroupSourceFieldCandidates[0]
	}
	if mode == "" {
		mode = llmChannelGroupFilterModeRegex
	}
	return channelGroup{
		DisplayName:  llmChannelGroupDisplayName,
		Description:  "Default GA4 channels + dedicated AI traffic channel",
		GroupingRule: insertAIChannelRule(buildAIChannelRule(llmRegex, sourceFieldName, mode), baseRules),
	}
}

func buildAIChannelRule(llmRegex, sourceFieldName string, mode llmChannelGroupFilterMode) groupingRule {
	return groupingRule{
		DisplayName: llmChannelDisplayName,
		Expression: channelGroupFilterExpression{
			AndGroup: &channelGroupFilterExpressionList{
				FilterExpressions: []channelGroupFilterExpression{
					{
						OrGroup: &channelGroupFilterExpressionList{
							FilterExpressions: []channelGroupFilterExpression{
								{
									Filter: &channelGroupFilter{
										FieldName:    sourceFieldName,
										StringFilter: buildLLMChannelGroupStringFilter(llmRegex, mode),
										InListFilter: buildLLMChannelGroupInListFilter(mode),
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

func insertAIChannelRule(aiRule groupingRule, baseRules []groupingRule) []groupingRule {
	rules := []groupingRule{aiRule}
	inserted := false
	if len(baseRules) == 0 {
		return rules
	}

	rules = make([]groupingRule, 0, len(baseRules)+1)
	for _, rule := range baseRules {
		if isAIChannelName(rule.DisplayName) {
			continue
		}
		if !inserted && strings.EqualFold(strings.TrimSpace(rule.DisplayName), "Referral") {
			rules = append(rules, aiRule)
			inserted = true
		}
		rules = append(rules, rule)
	}
	if !inserted {
		rules = append([]groupingRule{aiRule}, rules...)
	}
	return rules
}

func findDefaultChannelGroupRules(groups []channelGroup) []groupingRule {
	for _, group := range groups {
		displayName := strings.TrimSpace(group.DisplayName)
		if isAIChannelGroupName(displayName) {
			continue
		}
		if strings.EqualFold(displayName, "Default Channel Group") ||
			strings.EqualFold(displayName, "Default channel group") {
			return group.GroupingRule
		}
	}
	return nil
}

func isAIChannelGroupName(displayName string) bool {
	displayName = strings.TrimSpace(displayName)
	return strings.EqualFold(displayName, llmChannelGroupDisplayName) ||
		strings.EqualFold(displayName, legacyLLMChannelGroupName)
}

func isAIChannelName(displayName string) bool {
	displayName = strings.TrimSpace(displayName)
	return strings.EqualFold(displayName, llmChannelDisplayName) ||
		strings.EqualFold(displayName, legacyLLMChannelName) ||
		strings.EqualFold(displayName, "AI Tools")
}

func buildLLMChannelGroupStringFilter(llmRegex string, mode llmChannelGroupFilterMode) *channelStringFilter {
	if mode != llmChannelGroupFilterModeRegex {
		return nil
	}
	return &channelStringFilter{
		MatchType: "FULL_REGEXP",
		Value:     llmRegex,
	}
}

func buildLLMChannelGroupInListFilter(mode llmChannelGroupFilterMode) *channelInListFilter {
	if mode != llmChannelGroupFilterModeInList {
		return nil
	}
	values := make([]string, len(llmSourceValues))
	copy(values, llmSourceValues)
	return &channelInListFilter{Values: values}
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
