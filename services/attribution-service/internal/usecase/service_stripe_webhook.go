package usecase

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const stripeWebhookTolerance = 5 * time.Minute

type parsedStripeEvent struct {
	Handled      bool
	Stage        string
	Source       string
	Count        int64
	RevenueCents int64
	OccurredAt   time.Time
}

func (s *Service) RecordStripeWebhook(
	ctx context.Context,
	projectID string,
	payload []byte,
	signature string,
) error {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if len(payload) == 0 {
		return fmt.Errorf("%w: webhook payload is required", ErrValidation)
	}
	if s.projectResolver == nil {
		return fmt.Errorf("%w: project resolver is not configured", ErrValidation)
	}

	project, err := s.projectResolver.GetProject(ctx, projectID, 0)
	if err != nil {
		return err
	}
	webhookSecret := strings.TrimSpace(project.Stripe.WebhookSecret)
	if webhookSecret == "" {
		return fmt.Errorf("%w: stripe webhook is not configured for project", ErrValidation)
	}

	if err := verifyStripeWebhookSignature(payload, signature, webhookSecret, s.now().UTC()); err != nil {
		return fmt.Errorf("%w: %v", ErrValidation, err)
	}

	event, err := parseStripeWebhookEvent(payload)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrValidation, err)
	}
	if !event.Handled {
		return nil
	}

	_, err = s.recordValidatedEvent(
		ctx,
		projectID,
		event.Stage,
		normalizeAttributionSource(event.Source),
		event.Count,
		event.RevenueCents,
		event.OccurredAt,
	)
	return err
}

func verifyStripeWebhookSignature(payload []byte, signatureHeader, secret string, now time.Time) error {
	signatureHeader = strings.TrimSpace(signatureHeader)
	secret = strings.TrimSpace(secret)
	if signatureHeader == "" || secret == "" {
		return fmt.Errorf("missing stripe signature or webhook secret")
	}

	var timestamp int64
	signatures := make([]string, 0, 1)
	for _, segment := range strings.Split(signatureHeader, ",") {
		key, value, ok := strings.Cut(strings.TrimSpace(segment), "=")
		if !ok {
			continue
		}
		switch strings.TrimSpace(key) {
		case "t":
			parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
			if err != nil {
				return fmt.Errorf("invalid stripe signature timestamp")
			}
			timestamp = parsed
		case "v1":
			signatures = append(signatures, strings.TrimSpace(value))
		}
	}
	if timestamp <= 0 || len(signatures) == 0 {
		return fmt.Errorf("invalid stripe signature header")
	}

	signedAt := time.Unix(timestamp, 0).UTC()
	if now.Sub(signedAt) > stripeWebhookTolerance || signedAt.Sub(now) > stripeWebhookTolerance {
		return fmt.Errorf("expired stripe signature")
	}

	message := strconv.FormatInt(timestamp, 10) + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(message))
	expected := hex.EncodeToString(mac.Sum(nil))
	for _, candidate := range signatures {
		if hmac.Equal([]byte(expected), []byte(candidate)) {
			return nil
		}
	}
	return fmt.Errorf("invalid stripe signature")
}

func parseStripeWebhookEvent(payload []byte) (parsedStripeEvent, error) {
	var envelope struct {
		Type    string `json:"type"`
		Created int64  `json:"created"`
		Data    struct {
			Object             json.RawMessage `json:"object"`
			PreviousAttributes struct {
				Status string `json:"status"`
			} `json:"previous_attributes"`
		} `json:"data"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return parsedStripeEvent{}, fmt.Errorf("decode stripe event: %w", err)
	}

	occurredAt := time.Unix(envelope.Created, 0).UTC()
	if envelope.Created <= 0 {
		occurredAt = time.Time{}
	}

	switch strings.TrimSpace(envelope.Type) {
	case "customer.subscription.created", "customer.subscription.updated":
		var object struct {
			Status   string            `json:"status"`
			Metadata map[string]string `json:"metadata"`
		}
		if err := json.Unmarshal(envelope.Data.Object, &object); err != nil {
			return parsedStripeEvent{}, fmt.Errorf("decode stripe subscription event: %w", err)
		}
		status := strings.ToLower(strings.TrimSpace(object.Status))
		previousStatus := strings.ToLower(strings.TrimSpace(envelope.Data.PreviousAttributes.Status))
		if status == "trialing" && (envelope.Type == "customer.subscription.created" || previousStatus != "trialing") {
			return parsedStripeEvent{
				Handled:    true,
				Stage:      StageTrial,
				Source:     metadataSource(object.Metadata),
				Count:      1,
				OccurredAt: occurredAt,
			}, nil
		}
		return parsedStripeEvent{}, nil
	case "invoice.paid":
		var object struct {
			AmountPaid          int64             `json:"amount_paid"`
			Metadata            map[string]string `json:"metadata"`
			SubscriptionDetails struct {
				Metadata map[string]string `json:"metadata"`
			} `json:"subscription_details"`
			Parent struct {
				SubscriptionDetails struct {
					Metadata map[string]string `json:"metadata"`
				} `json:"subscription_details"`
			} `json:"parent"`
		}
		if err := json.Unmarshal(envelope.Data.Object, &object); err != nil {
			return parsedStripeEvent{}, fmt.Errorf("decode stripe invoice event: %w", err)
		}
		metadata := firstNonEmptyMetadata(
			object.Metadata,
			object.SubscriptionDetails.Metadata,
			object.Parent.SubscriptionDetails.Metadata,
		)
		revenueCents := object.AmountPaid
		if revenueCents < 0 {
			revenueCents = 0
		}
		return parsedStripeEvent{
			Handled:      true,
			Stage:        StagePaid,
			Source:       metadataSource(metadata),
			Count:        1,
			RevenueCents: revenueCents,
			OccurredAt:   occurredAt,
		}, nil
	default:
		return parsedStripeEvent{}, nil
	}
}

func firstNonEmptyMetadata(candidates ...map[string]string) map[string]string {
	for _, candidate := range candidates {
		if len(candidate) > 0 {
			return candidate
		}
	}
	return map[string]string{}
}

func metadataSource(metadata map[string]string) string {
	for _, key := range []string{"attribution_source", "ai_source", "source"} {
		if value := strings.TrimSpace(metadata[key]); value != "" {
			return value
		}
	}
	return "unknown"
}

func normalizeAttributionSource(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "unknown"
	}
	value = strings.ReplaceAll(value, "_", "-")
	value = strings.ReplaceAll(value, " ", "-")
	return value
}
