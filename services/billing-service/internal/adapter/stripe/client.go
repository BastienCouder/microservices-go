package stripeadapter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/usecase"
	stripewebhook "github.com/stripe/stripe-go/v84/webhook"
)

const (
	stripeBaseURL             = "https://api.stripe.com"
	defaultHTTPTimeout        = 10 * time.Second
	defaultRetryWait          = 200 * time.Millisecond
	maxStripeRequestBodyBytes = 4 << 20
)

type Client struct {
	secretKey     string
	webhookSecret string
	baseURL       string
	httpClient    *http.Client
}

func NewClient(secretKey, webhookSecret string) *Client {
	return &Client{
		secretKey:     strings.TrimSpace(secretKey),
		webhookSecret: strings.TrimSpace(webhookSecret),
		baseURL:       stripeBaseURL,
		httpClient:    &http.Client{Timeout: defaultHTTPTimeout},
	}
}

func (c *Client) CreateSubscriptionCheckoutSession(ctx context.Context, req usecase.StripeCheckoutSessionRequest) (usecase.StripeCheckoutSession, error) {
	if strings.TrimSpace(c.secretKey) == "" {
		return usecase.StripeCheckoutSession{}, usecase.ErrStripeDisabled
	}
	if req.OrganizationID <= 0 || req.Seats <= 0 || req.MonthlyQuota <= 0 {
		return usecase.StripeCheckoutSession{}, fmt.Errorf("%w: invalid checkout payload", usecase.ErrStripeInvalidRequest)
	}
	if strings.TrimSpace(req.PriceID) == "" {
		return usecase.StripeCheckoutSession{}, fmt.Errorf("%w: missing plan price id", usecase.ErrStripeInvalidRequest)
	}
	if strings.TrimSpace(req.SuccessURL) == "" || strings.TrimSpace(req.CancelURL) == "" {
		return usecase.StripeCheckoutSession{}, fmt.Errorf("%w: success_url and cancel_url are required", usecase.ErrStripeInvalidRequest)
	}

	form := url.Values{}
	form.Set("mode", "subscription")
	form.Set("success_url", req.SuccessURL)
	form.Set("cancel_url", req.CancelURL)
	form.Set("allow_promotion_codes", "true")
	form.Set("client_reference_id", strconv.FormatInt(req.OrganizationID, 10))
	form.Set("line_items[0][price]", strings.TrimSpace(req.PriceID))
	form.Set("line_items[0][quantity]", strconv.Itoa(req.Seats))
	form.Set("metadata[organization_id]", strconv.FormatInt(req.OrganizationID, 10))
	form.Set("metadata[project_id]", strings.TrimSpace(req.ProjectID))
	form.Set("metadata[attribution_source]", strings.TrimSpace(req.AttributionSource))
	form.Set("metadata[plan]", domain.NormalizePlan(req.Plan))
	form.Set("metadata[billing_cycle]", domain.NormalizeBillingCycle(req.BillingCycle))
	form.Set("metadata[seats]", strconv.Itoa(req.Seats))
	form.Set("metadata[monthly_quota]", strconv.Itoa(req.MonthlyQuota))
	form.Set("metadata[correction_credits]", strconv.Itoa(req.CorrectionCredits))
	form.Set("subscription_data[metadata][organization_id]", strconv.FormatInt(req.OrganizationID, 10))
	form.Set("subscription_data[metadata][project_id]", strings.TrimSpace(req.ProjectID))
	form.Set("subscription_data[metadata][attribution_source]", strings.TrimSpace(req.AttributionSource))
	form.Set("subscription_data[metadata][plan]", domain.NormalizePlan(req.Plan))
	form.Set("subscription_data[metadata][billing_cycle]", domain.NormalizeBillingCycle(req.BillingCycle))
	form.Set("subscription_data[metadata][seats]", strconv.Itoa(req.Seats))
	form.Set("subscription_data[metadata][monthly_quota]", strconv.Itoa(req.MonthlyQuota))

	if req.CorrectionCredits > 0 && strings.TrimSpace(req.CorrectionPriceID) != "" {
		form.Set("line_items[1][price]", strings.TrimSpace(req.CorrectionPriceID))
		form.Set("line_items[1][quantity]", strconv.Itoa(req.CorrectionCredits))
	}

	body, err := c.doStripeFormRequest(ctx, "/v1/checkout/sessions", form, strings.TrimSpace(req.RequestID))
	if err != nil {
		return usecase.StripeCheckoutSession{}, err
	}

	var resp struct {
		ID           string          `json:"id"`
		URL          string          `json:"url"`
		Customer     json.RawMessage `json:"customer"`
		Subscription json.RawMessage `json:"subscription"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return usecase.StripeCheckoutSession{}, fmt.Errorf("decode stripe checkout response: %w", err)
	}
	if strings.TrimSpace(resp.ID) == "" || strings.TrimSpace(resp.URL) == "" {
		return usecase.StripeCheckoutSession{}, fmt.Errorf("stripe checkout response missing id or url")
	}

	return usecase.StripeCheckoutSession{
		ID:             strings.TrimSpace(resp.ID),
		URL:            strings.TrimSpace(resp.URL),
		CustomerID:     expandableID(resp.Customer),
		SubscriptionID: expandableID(resp.Subscription),
	}, nil
}

func (c *Client) CreateCustomerPortalSession(ctx context.Context, customerID, returnURL, requestID string) (string, error) {
	if strings.TrimSpace(c.secretKey) == "" {
		return "", usecase.ErrStripeDisabled
	}
	if strings.TrimSpace(customerID) == "" {
		return "", fmt.Errorf("%w: customer id is required", usecase.ErrStripeInvalidRequest)
	}
	if strings.TrimSpace(returnURL) == "" {
		return "", fmt.Errorf("%w: return_url is required", usecase.ErrStripeInvalidRequest)
	}

	form := url.Values{}
	form.Set("customer", strings.TrimSpace(customerID))
	form.Set("return_url", strings.TrimSpace(returnURL))

	body, err := c.doStripeFormRequest(ctx, "/v1/billing_portal/sessions", form, strings.TrimSpace(requestID))
	if err != nil {
		return "", err
	}

	var resp struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("decode stripe customer portal response: %w", err)
	}
	if strings.TrimSpace(resp.URL) == "" {
		return "", fmt.Errorf("stripe customer portal response missing url")
	}
	return strings.TrimSpace(resp.URL), nil
}

func (c *Client) GetCheckoutSession(ctx context.Context, sessionID string) (usecase.StripeCheckoutSessionDetails, error) {
	if strings.TrimSpace(c.secretKey) == "" {
		return usecase.StripeCheckoutSessionDetails{}, usecase.ErrStripeDisabled
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return usecase.StripeCheckoutSessionDetails{}, fmt.Errorf("%w: stripe checkout session id is required", usecase.ErrStripeInvalidRequest)
	}

	body, err := c.doStripeRequest(ctx, http.MethodGet, "/v1/checkout/sessions/"+url.PathEscape(sessionID), nil, "")
	if err != nil {
		return usecase.StripeCheckoutSessionDetails{}, err
	}

	parsed, err := parseCheckoutSessionCompleted(body)
	if err != nil {
		return usecase.StripeCheckoutSessionDetails{}, err
	}

	return usecase.StripeCheckoutSessionDetails{
		ID:                   sessionID,
		OrganizationID:       parsed.OrganizationID,
		ProjectID:            parsed.ProjectID,
		AttributionSource:    parsed.AttributionSource,
		Plan:                 parsed.Plan,
		BillingCycle:         parsed.BillingCycle,
		Seats:                parsed.Seats,
		MonthlyQuota:         parsed.MonthlyQuota,
		Paid:                 parsed.Paid,
		StripeCustomerID:     parsed.StripeCustomerID,
		StripeSubscriptionID: parsed.StripeSubscriptionID,
	}, nil
}

func (c *Client) GetSubscription(ctx context.Context, subscriptionID string) (usecase.StripeSubscriptionDetails, error) {
	if strings.TrimSpace(c.secretKey) == "" {
		return usecase.StripeSubscriptionDetails{}, usecase.ErrStripeDisabled
	}
	subscriptionID = strings.TrimSpace(subscriptionID)
	if subscriptionID == "" {
		return usecase.StripeSubscriptionDetails{}, fmt.Errorf("%w: stripe subscription id is required", usecase.ErrStripeInvalidRequest)
	}

	body, err := c.doStripeRequest(ctx, http.MethodGet, "/v1/subscriptions/"+url.PathEscape(subscriptionID), nil, "")
	if err != nil {
		return usecase.StripeSubscriptionDetails{}, err
	}

	parsed, err := parseSubscriptionEvent(body)
	if err != nil {
		return usecase.StripeSubscriptionDetails{}, err
	}

	return usecase.StripeSubscriptionDetails{
		OrganizationID:       parsed.OrganizationID,
		ProjectID:            parsed.ProjectID,
		AttributionSource:    parsed.AttributionSource,
		Plan:                 parsed.Plan,
		BillingCycle:         parsed.BillingCycle,
		Seats:                parsed.Seats,
		MonthlyQuota:         parsed.MonthlyQuota,
		StripeCustomerID:     parsed.StripeCustomerID,
		StripeSubscriptionID: parsed.StripeSubscriptionID,
		StripePriceID:        parsed.StripePriceID,
		Status:               parsed.Status,
		CancelAtPeriodEnd:    parsed.CancelAtPeriodEnd,
		CurrentPeriodEnd:     parsed.CurrentPeriodEnd,
	}, nil
}

func (c *Client) CancelSubscription(ctx context.Context, subscriptionID, requestID string) (usecase.StripeSubscriptionDetails, error) {
	if strings.TrimSpace(c.secretKey) == "" {
		return usecase.StripeSubscriptionDetails{}, usecase.ErrStripeDisabled
	}
	subscriptionID = strings.TrimSpace(subscriptionID)
	if subscriptionID == "" {
		return usecase.StripeSubscriptionDetails{}, fmt.Errorf("%w: stripe subscription id is required", usecase.ErrStripeInvalidRequest)
	}

	body, err := c.doStripeRequest(ctx, http.MethodDelete, "/v1/subscriptions/"+url.PathEscape(subscriptionID), nil, strings.TrimSpace(requestID))
	if err != nil {
		if isStripeStatus(err, http.StatusNotFound) {
			return usecase.StripeSubscriptionDetails{
				StripeSubscriptionID: subscriptionID,
				Status:               domain.SubscriptionStatusCanceled,
			}, nil
		}
		return usecase.StripeSubscriptionDetails{}, err
	}

	parsed, err := parseSubscriptionEvent(body)
	if err != nil {
		return usecase.StripeSubscriptionDetails{}, err
	}

	return usecase.StripeSubscriptionDetails{
		OrganizationID:       parsed.OrganizationID,
		ProjectID:            parsed.ProjectID,
		AttributionSource:    parsed.AttributionSource,
		Plan:                 parsed.Plan,
		BillingCycle:         parsed.BillingCycle,
		Seats:                parsed.Seats,
		MonthlyQuota:         parsed.MonthlyQuota,
		StripeCustomerID:     parsed.StripeCustomerID,
		StripeSubscriptionID: parsed.StripeSubscriptionID,
		StripePriceID:        parsed.StripePriceID,
		Status:               parsed.Status,
		CancelAtPeriodEnd:    parsed.CancelAtPeriodEnd,
		CurrentPeriodEnd:     parsed.CurrentPeriodEnd,
	}, nil
}

func (c *Client) SyncPricingCatalog(ctx context.Context, req usecase.StripePricingCatalogSyncRequest) (usecase.StripePricingCatalogSyncResult, error) {
	if strings.TrimSpace(c.secretKey) == "" {
		return usecase.StripePricingCatalogSyncResult{}, usecase.ErrStripeDisabled
	}

	result := usecase.StripePricingCatalogSyncResult{}
	for _, product := range req.Products {
		created, err := c.upsertProduct(ctx, product)
		if err != nil {
			return usecase.StripePricingCatalogSyncResult{}, err
		}
		if created {
			result.ProductsCreated++
		} else {
			result.ProductsUpdated++
		}
	}

	for _, price := range req.Prices {
		reused, err := c.syncPrice(ctx, price)
		if err != nil {
			return usecase.StripePricingCatalogSyncResult{}, err
		}
		if reused {
			result.PricesReused++
		} else {
			result.PricesCreated++
		}
	}
	return result, nil
}

func (c *Client) FindPriceIDByLookupKey(ctx context.Context, lookupKey string) (string, error) {
	if strings.TrimSpace(c.secretKey) == "" {
		return "", usecase.ErrStripeDisabled
	}
	price, err := c.findPriceByLookupKey(ctx, lookupKey)
	if err != nil {
		return "", err
	}
	if price == nil || strings.TrimSpace(price.ID) == "" {
		return "", nil
	}
	return strings.TrimSpace(price.ID), nil
}

func (c *Client) upsertProduct(ctx context.Context, product usecase.StripePricingCatalogProduct) (bool, error) {
	productID := strings.TrimSpace(product.ID)
	if productID == "" {
		return false, fmt.Errorf("%w: stripe product id is required", usecase.ErrStripeInvalidRequest)
	}
	form := stripeProductForm(product)
	if _, err := c.doStripeFormRequest(ctx, "/v1/products/"+url.PathEscape(productID), form, ""); err == nil {
		return false, nil
	} else if !isStripeStatus(err, http.StatusNotFound) {
		return false, fmt.Errorf("update stripe product %s: %w", productID, err)
	}

	form = stripeProductForm(product)
	form.Set("id", productID)
	if _, err := c.doStripeFormRequest(ctx, "/v1/products", form, ""); err != nil {
		return false, fmt.Errorf("create stripe product %s: %w", productID, err)
	}
	return true, nil
}

func (c *Client) syncPrice(ctx context.Context, price usecase.StripePricingCatalogPrice) (bool, error) {
	existing, err := c.findPriceByLookupKey(ctx, price.LookupKey)
	if err != nil {
		return false, err
	}
	if existing != nil &&
		existing.UnitAmount == int64(price.UnitAmountCents) &&
		strings.EqualFold(existing.Currency, price.Currency) &&
		strings.EqualFold(existing.Recurring.Interval, price.Interval) &&
		expandableID(existing.Product) == strings.TrimSpace(price.ProductID) {
		return true, nil
	}

	form := url.Values{}
	form.Set("product", strings.TrimSpace(price.ProductID))
	form.Set("currency", strings.ToLower(strings.TrimSpace(price.Currency)))
	form.Set("unit_amount", strconv.Itoa(price.UnitAmountCents))
	form.Set("recurring[interval]", strings.TrimSpace(price.Interval))
	form.Set("lookup_key", strings.TrimSpace(price.LookupKey))
	form.Set("transfer_lookup_key", "true")
	form.Set("nickname", stripePriceNickname(price))
	setStripePricingMetadata(form, price)

	if _, err := c.doStripeFormRequest(ctx, "/v1/prices", form, stripePriceIdempotencyKey(price)); err != nil {
		return false, fmt.Errorf("create stripe price %s: %w", strings.TrimSpace(price.LookupKey), err)
	}
	return false, nil
}

type stripePriceListItem struct {
	ID         string          `json:"id"`
	UnitAmount int64           `json:"unit_amount"`
	Currency   string          `json:"currency"`
	Product    json.RawMessage `json:"product"`
	Recurring  struct {
		Interval string `json:"interval"`
	} `json:"recurring"`
}

func (c *Client) findPriceByLookupKey(ctx context.Context, lookupKey string) (*stripePriceListItem, error) {
	lookupKey = strings.TrimSpace(lookupKey)
	if lookupKey == "" {
		return nil, fmt.Errorf("%w: stripe price lookup key is required", usecase.ErrStripeInvalidRequest)
	}

	query := url.Values{}
	query.Set("lookup_keys[0]", lookupKey)
	query.Set("limit", "1")
	body, err := c.doStripeRequest(ctx, http.MethodGet, "/v1/prices", query, "")
	if err != nil {
		return nil, fmt.Errorf("list stripe price %s: %w", lookupKey, err)
	}

	var resp struct {
		Data []stripePriceListItem `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("decode stripe price list: %w", err)
	}
	if len(resp.Data) == 0 {
		return nil, nil
	}
	return &resp.Data[0], nil
}

func stripeProductForm(product usecase.StripePricingCatalogProduct) url.Values {
	form := url.Values{}
	form.Set("name", strings.TrimSpace(product.Name))
	form.Set("active", "true")
	form.Set("metadata[source]", "admin_pricing")
	form.Set("metadata[plan]", strings.TrimSpace(product.Plan))
	form.Set("metadata[monthly_quota]", strconv.Itoa(product.MonthlyQuota))
	form.Set("metadata[model_selection_limit]", strconv.Itoa(product.ModelSelectionLimit))
	form.Set("metadata[monthly_model_change_limit]", strconv.Itoa(product.MonthlyModelChangeLimit))
	form.Set("metadata[max_projects]", strconv.Itoa(product.MaxProjects))
	return form
}

func setStripePricingMetadata(form url.Values, price usecase.StripePricingCatalogPrice) {
	form.Set("metadata[source]", "admin_pricing")
	form.Set("metadata[plan]", strings.TrimSpace(price.Plan))
	form.Set("metadata[tier_label]", strings.TrimSpace(price.TierLabel))
	form.Set("metadata[prompt_volume]", strconv.Itoa(price.PromptVolume))
	form.Set("metadata[monthly_quota]", strconv.Itoa(price.MonthlyQuota))
	form.Set("metadata[model_selection_limit]", strconv.Itoa(price.ModelSelectionLimit))
	form.Set("metadata[monthly_model_change_limit]", strconv.Itoa(price.MonthlyModelChangeLimit))
	form.Set("metadata[max_projects]", strconv.Itoa(price.MaxProjects))
}

func stripePriceNickname(price usecase.StripePricingCatalogPrice) string {
	plan := strings.TrimSpace(price.Plan)
	if plan == "" {
		plan = "plan"
	}
	label := strings.TrimSpace(price.TierLabel)
	if label == "" {
		label = strconv.Itoa(price.PromptVolume)
	}
	return fmt.Sprintf("%s - %s prompts monthly", plan, label)
}

func stripePriceIdempotencyKey(price usecase.StripePricingCatalogPrice) string {
	return fmt.Sprintf(
		"admin-pricing-price:%s:%d:%d:%s",
		strings.TrimSpace(price.Plan),
		price.PromptVolume,
		price.UnitAmountCents,
		strings.ToLower(strings.TrimSpace(price.Currency)),
	)
}

func (c *Client) ParseWebhookEvent(payload []byte, signature string) (usecase.StripeWebhookEvent, error) {
	if strings.TrimSpace(c.webhookSecret) == "" {
		return usecase.StripeWebhookEvent{}, usecase.ErrStripeDisabled
	}

	eventEnvelope, err := stripewebhook.ConstructEvent(payload, strings.TrimSpace(signature), c.webhookSecret)
	if err != nil {
		return usecase.StripeWebhookEvent{}, usecase.ErrStripeInvalidSignature
	}

	event := usecase.StripeWebhookEvent{
		ID:   strings.TrimSpace(eventEnvelope.ID),
		Type: strings.TrimSpace(string(eventEnvelope.Type)),
	}
	if event.ID == "" || event.Type == "" {
		return usecase.StripeWebhookEvent{}, fmt.Errorf("stripe event missing id or type")
	}

	switch event.Type {
	case "checkout.session.completed":
		parsed, err := parseCheckoutSessionCompleted(eventEnvelope.Data.Raw)
		if err != nil {
			return usecase.StripeWebhookEvent{}, err
		}
		event.Handled = true
		event.OrganizationID = parsed.OrganizationID
		event.ProjectID = parsed.ProjectID
		event.AttributionSource = parsed.AttributionSource
		event.Plan = parsed.Plan
		event.BillingCycle = parsed.BillingCycle
		event.Seats = parsed.Seats
		event.MonthlyQuota = parsed.MonthlyQuota
		event.StripeCustomerID = parsed.StripeCustomerID
		event.StripeSubscriptionID = parsed.StripeSubscriptionID
		if parsed.Paid {
			event.Status = domain.SubscriptionStatusActive
			event.CorrectionCreditsDelta = parsed.CorrectionCredits
		} else {
			event.Status = domain.SubscriptionStatusCheckoutPending
		}
	case "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted":
		parsed, err := parseSubscriptionEvent(eventEnvelope.Data.Raw)
		if err != nil {
			return usecase.StripeWebhookEvent{}, err
		}
		event.Handled = true
		event.OrganizationID = parsed.OrganizationID
		event.ProjectID = parsed.ProjectID
		event.AttributionSource = parsed.AttributionSource
		event.Plan = parsed.Plan
		event.BillingCycle = parsed.BillingCycle
		event.Seats = parsed.Seats
		event.MonthlyQuota = parsed.MonthlyQuota
		event.StripeCustomerID = parsed.StripeCustomerID
		event.StripeSubscriptionID = parsed.StripeSubscriptionID
		event.StripePriceID = parsed.StripePriceID
		event.Status = parsed.Status
		event.CancelAtPeriodEnd = parsed.CancelAtPeriodEnd
		event.CurrentPeriodEnd = parsed.CurrentPeriodEnd
	case "invoice.paid":
		parsed, err := parseInvoicePaidEvent(eventEnvelope.Data.Raw)
		if err != nil {
			return usecase.StripeWebhookEvent{}, err
		}
		event.Handled = true
		event.OrganizationID = parsed.OrganizationID
		event.ProjectID = parsed.ProjectID
		event.AttributionSource = parsed.AttributionSource
		event.StripeCustomerID = parsed.StripeCustomerID
		event.StripeSubscriptionID = parsed.StripeSubscriptionID
		event.RevenueCents = parsed.RevenueCents
		event.Status = domain.SubscriptionStatusActive
	default:
		event.Handled = false
	}

	return event, nil
}

func (c *Client) doStripeFormRequest(ctx context.Context, path string, form url.Values, idempotencyKey string) ([]byte, error) {
	return c.doStripeRequest(ctx, http.MethodPost, path, form, idempotencyKey)
}

func (c *Client) doStripeRequest(ctx context.Context, method, path string, form url.Values, idempotencyKey string) ([]byte, error) {
	endpoint := strings.TrimRight(c.baseURL, "/") + path
	payload := form.Encode()
	if strings.EqualFold(method, http.MethodGet) && payload != "" {
		endpoint += "?" + payload
		payload = ""
	}

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, endpoint, strings.NewReader(payload))
		if err != nil {
			return nil, fmt.Errorf("create stripe request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+c.secretKey)
		if !strings.EqualFold(method, http.MethodGet) {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
		if strings.TrimSpace(idempotencyKey) != "" {
			req.Header.Set("Idempotency-Key", idempotencyKey)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("send stripe request: %w", err)
			if attempt == 0 && canRetry(ctx) {
				waitWithContext(ctx, defaultRetryWait)
				continue
			}
			return nil, lastErr
		}

		body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxStripeRequestBodyBytes))
		_ = resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("read stripe response: %w", readErr)
		}

		if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
			return body, nil
		}

		lastErr = parseStripeAPIError(resp.StatusCode, body)
		if attempt == 0 && (resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= http.StatusInternalServerError) && canRetry(ctx) {
			waitWithContext(ctx, defaultRetryWait)
			continue
		}
		return nil, lastErr
	}

	if lastErr == nil {
		lastErr = errors.New("stripe request failed")
	}
	return nil, lastErr
}

type stripeAPIError struct {
	StatusCode int
	Message    string
}

func (e stripeAPIError) Error() string {
	return fmt.Sprintf("stripe api error (%d): %s", e.StatusCode, e.Message)
}

func parseStripeAPIError(statusCode int, body []byte) error {
	var payload struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
			Code    string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &payload); err == nil {
		msg := strings.TrimSpace(payload.Error.Message)
		if msg != "" {
			return stripeAPIError{StatusCode: statusCode, Message: msg}
		}
	}
	raw := strings.TrimSpace(string(body))
	if raw == "" {
		raw = http.StatusText(statusCode)
	}
	return stripeAPIError{StatusCode: statusCode, Message: raw}
}

func isStripeStatus(err error, statusCode int) bool {
	var apiErr stripeAPIError
	return errors.As(err, &apiErr) && apiErr.StatusCode == statusCode
}

func expandableID(raw json.RawMessage) string {
	raw = []byte(strings.TrimSpace(string(raw)))
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var id string
	if err := json.Unmarshal(raw, &id); err == nil {
		return strings.TrimSpace(id)
	}
	var expanded struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &expanded); err == nil {
		return strings.TrimSpace(expanded.ID)
	}
	return ""
}

type parsedCheckoutSession struct {
	OrganizationID       int64
	ProjectID            string
	AttributionSource    string
	Plan                 string
	BillingCycle         string
	Seats                int
	MonthlyQuota         int
	CorrectionCredits    int
	Paid                 bool
	StripeCustomerID     string
	StripeSubscriptionID string
}

func parseCheckoutSessionCompleted(raw json.RawMessage) (parsedCheckoutSession, error) {
	var payload struct {
		ID              string            `json:"id"`
		ClientReference string            `json:"client_reference_id"`
		Customer        json.RawMessage   `json:"customer"`
		Subscription    json.RawMessage   `json:"subscription"`
		PaymentStatus   string            `json:"payment_status"`
		Metadata        map[string]string `json:"metadata"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return parsedCheckoutSession{}, fmt.Errorf("decode checkout.session.completed object: %w", err)
	}
	organizationID := metadataInt64(payload.Metadata, "organization_id")
	if organizationID <= 0 {
		parsed, err := strconv.ParseInt(strings.TrimSpace(payload.ClientReference), 10, 64)
		if err == nil && parsed > 0 {
			organizationID = parsed
		}
	}
	return parsedCheckoutSession{
		OrganizationID:       organizationID,
		ProjectID:            metadataString(payload.Metadata, "project_id"),
		AttributionSource:    metadataString(payload.Metadata, "attribution_source"),
		Plan:                 metadataString(payload.Metadata, "plan"),
		BillingCycle:         metadataString(payload.Metadata, "billing_cycle"),
		Seats:                metadataInt(payload.Metadata, "seats"),
		MonthlyQuota:         metadataInt(payload.Metadata, "monthly_quota"),
		CorrectionCredits:    metadataInt(payload.Metadata, "correction_credits"),
		Paid:                 strings.EqualFold(strings.TrimSpace(payload.PaymentStatus), "paid"),
		StripeCustomerID:     expandableID(payload.Customer),
		StripeSubscriptionID: expandableID(payload.Subscription),
	}, nil
}

type parsedSubscription struct {
	OrganizationID       int64
	ProjectID            string
	AttributionSource    string
	Plan                 string
	BillingCycle         string
	Seats                int
	MonthlyQuota         int
	StripeCustomerID     string
	StripeSubscriptionID string
	StripePriceID        string
	Status               string
	CancelAtPeriodEnd    bool
	CurrentPeriodEnd     *time.Time
}

func parseSubscriptionEvent(raw json.RawMessage) (parsedSubscription, error) {
	var payload struct {
		ID                string            `json:"id"`
		Customer          json.RawMessage   `json:"customer"`
		Status            string            `json:"status"`
		CancelAtPeriodEnd bool              `json:"cancel_at_period_end"`
		CurrentPeriodEnd  int64             `json:"current_period_end"`
		Metadata          map[string]string `json:"metadata"`
		Items             struct {
			Data []struct {
				Price struct {
					ID string `json:"id"`
				} `json:"price"`
			} `json:"data"`
		} `json:"items"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return parsedSubscription{}, fmt.Errorf("decode customer.subscription object: %w", err)
	}

	var priceID string
	if len(payload.Items.Data) > 0 {
		priceID = strings.TrimSpace(payload.Items.Data[0].Price.ID)
	}

	var currentPeriodEnd *time.Time
	if payload.CurrentPeriodEnd > 0 {
		value := time.Unix(payload.CurrentPeriodEnd, 0).UTC()
		currentPeriodEnd = &value
	}

	return parsedSubscription{
		OrganizationID:       metadataInt64(payload.Metadata, "organization_id"),
		ProjectID:            metadataString(payload.Metadata, "project_id"),
		AttributionSource:    metadataString(payload.Metadata, "attribution_source"),
		Plan:                 metadataString(payload.Metadata, "plan"),
		BillingCycle:         metadataString(payload.Metadata, "billing_cycle"),
		Seats:                metadataInt(payload.Metadata, "seats"),
		MonthlyQuota:         metadataInt(payload.Metadata, "monthly_quota"),
		StripeCustomerID:     expandableID(payload.Customer),
		StripeSubscriptionID: strings.TrimSpace(payload.ID),
		StripePriceID:        priceID,
		Status:               strings.TrimSpace(payload.Status),
		CancelAtPeriodEnd:    payload.CancelAtPeriodEnd,
		CurrentPeriodEnd:     currentPeriodEnd,
	}, nil
}

type parsedInvoice struct {
	OrganizationID       int64
	ProjectID            string
	AttributionSource    string
	StripeCustomerID     string
	StripeSubscriptionID string
	RevenueCents         int64
}

func parseInvoicePaidEvent(raw json.RawMessage) (parsedInvoice, error) {
	var payload struct {
		Customer     json.RawMessage `json:"customer"`
		Subscription json.RawMessage `json:"subscription"`
		AmountPaid   int64           `json:"amount_paid"`
		Parent       struct {
			SubscriptionDetails struct {
				Metadata map[string]string `json:"metadata"`
			} `json:"subscription_details"`
		} `json:"parent"`
		SubscriptionDetails struct {
			Metadata map[string]string `json:"metadata"`
		} `json:"subscription_details"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return parsedInvoice{}, fmt.Errorf("decode invoice.paid object: %w", err)
	}

	metadata := payload.SubscriptionDetails.Metadata
	if len(metadata) == 0 {
		metadata = payload.Parent.SubscriptionDetails.Metadata
	}

	return parsedInvoice{
		OrganizationID:       metadataInt64(metadata, "organization_id"),
		ProjectID:            metadataString(metadata, "project_id"),
		AttributionSource:    metadataString(metadata, "attribution_source"),
		StripeCustomerID:     expandableID(payload.Customer),
		StripeSubscriptionID: expandableID(payload.Subscription),
		RevenueCents:         payload.AmountPaid,
	}, nil
}

func metadataString(metadata map[string]string, key string) string {
	if len(metadata) == 0 {
		return ""
	}
	return strings.TrimSpace(metadata[key])
}

func metadataInt(metadata map[string]string, key string) int {
	value := metadataString(metadata, key)
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}

func metadataInt64(metadata map[string]string, key string) int64 {
	value := metadataString(metadata, key)
	if value == "" {
		return 0
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func waitWithContext(ctx context.Context, duration time.Duration) {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}

func canRetry(ctx context.Context) bool {
	return ctx.Err() == nil
}
