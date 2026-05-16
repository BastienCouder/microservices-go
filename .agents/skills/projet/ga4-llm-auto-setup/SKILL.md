---
name: ga4-llm-auto-setup
description: Configure GA4 Admin API resources for LLM/AI assistant traffic tracking. Use when implementing or reviewing automatic GA4 setup that creates an AI/LLM custom channel group, creates the event-scoped llm_source custom dimension, handles Google OAuth analytics.edit, or writes Go idempotent setup code for Google Analytics properties.
---

# GA4 LLM Auto-Setup

Use this skill to implement automatic Google Analytics 4 setup for traffic from AI assistants and LLM products such as ChatGPT, Perplexity, Claude, Gemini, Copilot, Bard, Grok, DeepSeek, Mistral, and similar sources.

The target implementation language is Go. Prefer a backend service that runs after the user connects a GA4 property with a Google OAuth token containing:

```text
https://www.googleapis.com/auth/analytics.edit
```

## Scope

This skill configures GA4 Admin resources. It does not make missing attribution appear if no referrer, UTM, or app-sent event parameter reaches GA4.

Create or ensure:

- Custom channel group: `AI / LLM Channel Group`
- Channel inside that group: `AI Assistants`
- Event-scoped custom dimension: `llm_source`

Recommended event emitted by the app:

```json
{
  "name": "llm_visit",
  "params": {
    "llm_source": "chatgpt",
    "llm_referrer": "https://chatgpt.com/",
    "llm_detected": true
  }
}
```

## API Facts

Use the Google Analytics Admin API base URL:

```text
https://analyticsadmin.googleapis.com
```

Channel groups currently use `v1alpha`:

```text
GET  /v1alpha/properties/{propertyId}/channelGroups
POST /v1alpha/properties/{propertyId}/channelGroups
```

Custom dimensions use `v1beta`:

```text
GET  /v1beta/properties/{propertyId}/customDimensions
POST /v1beta/properties/{propertyId}/customDimensions
```

The `propertyId` input is normally the numeric ID. Convert it to `properties/{propertyId}` for Admin API parent paths. Accept an already-prefixed value defensively, but normalize it internally.

## Inputs

```go
type SetupInput struct {
    PropertyID             string
    AccessToken            string
    LLMRegex               string
    CreateCustomDimension  bool
    CreateChannelGroup     bool
}
```

Defaults:

```text
LLMRegex = ".*(openai|chatgpt|perplexity|claude|anthropic|gemini|bard|copilot|grok|deepseek|mistral|you\\.com|phind).*"
CreateCustomDimension = true
CreateChannelGroup = true
```

## Outputs

Return a structured result instead of only an error so the product can show partial success:

```go
type SetupResult struct {
    SetupStatus      string
    CreatedResources CreatedResources
    Errors           []SetupError
}

type CreatedResources struct {
    ChannelGroupName    string
    CustomDimensionName string
}
```

Use `success`, `partial_success`, or `failed` for `SetupStatus`.

## Go Design

Recommended package: `ga4setup`.

Keep Google-specific HTTP code behind an interface so the setup service is testable without live GA4 calls:

```go
type SetupService interface {
    Setup(ctx context.Context, propertyID string) (*SetupResult, error)
    EnsureChannelGroup(ctx context.Context, propertyID string) (string, error)
    EnsureCustomDimension(ctx context.Context, propertyID string) (string, error)
}

type AdminClient interface {
    ListChannelGroups(ctx context.Context, property string) ([]ChannelGroup, error)
    CreateChannelGroup(ctx context.Context, property string, req ChannelGroup) (ChannelGroup, error)
    ListCustomDimensions(ctx context.Context, property string) ([]CustomDimension, error)
    CreateCustomDimension(ctx context.Context, property string, req CustomDimension) (CustomDimension, error)
}
```

## Workflow

1. Validate `propertyId` and credentials.
2. Normalize the property parent to `properties/{propertyId}`.
3. If `createChannelGroup` is true, list channel groups and find `displayName == "AI / LLM Channel Group"`.
4. Create the channel group only when missing.
5. If `createCustomDimension` is true, list custom dimensions and find `parameterName == "llm_source"`.
6. Create the custom dimension only when missing.
7. Return `success` when every requested resource exists, `partial_success` when at least one requested resource exists but another failed, and `failed` when no requested resource could be ensured.

## Channel Group Payload

Important Admin API details:

- `groupingRule[].expression` must be a `ChannelGroupFilterExpression`.
- The top-level expression must be an `andGroup`.
- `orGroup` can contain only simple `filter` expressions.
- `StringFilter` is case-insensitive; do not send a `caseSensitive` field.
- Custom channel group channel order matters in the GA4 UI. Put the AI channel before generic referral channels if you copy or manage a larger group definition.

Minimal create request body:

```json
{
  "displayName": "AI / LLM Channel Group",
  "description": "Classe le trafic provenant des assistants IA",
  "groupingRule": [
    {
      "displayName": "AI Assistants",
      "expression": {
        "andGroup": {
          "filterExpressions": [
            {
              "orGroup": {
                "filterExpressions": [
                  {
                    "filter": {
                      "fieldName": "sessionSource",
                      "stringFilter": {
                        "matchType": "FULL_REGEXP",
                        "value": ".*(openai|chatgpt|perplexity|claude|anthropic|gemini|bard|copilot|grok|deepseek|mistral|you\\.com|phind).*"
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    }
  ]
}
```

If GA4 rejects `sessionSource` for channel-group filters in a live property, retry or update the implementation to use the Admin/API field corresponding to the GA4 UI "Source" field for that property. Keep this behavior explicit in code and tests because Google documents custom channel groups in UI terms while the Admin API accepts filter field names.

## Custom Dimension Payload

Create request body:

```json
{
  "parameterName": "llm_source",
  "displayName": "LLM Source",
  "description": "Source LLM normalisee envoyee par l app",
  "scope": "EVENT"
}
```

`parameterName` is immutable, must start with a letter, and can contain only alphanumeric characters and underscores. `llm_source` is valid for an event-scoped dimension.

## LLM Source Normalization

Use this mapping when sending `llm_source` from the app:

```text
chatgpt.com|chat.openai.com|openai.com -> chatgpt
perplexity.ai -> perplexity
claude.ai|anthropic.com -> claude
gemini.google.com|bard.google.com -> gemini
copilot.microsoft.com -> copilot
grok.x.ai -> grok
chat.deepseek.com|deepseek.com -> deepseek
chat.mistral.ai|mistral.ai -> mistral
you.com -> you
phind.com -> phind
```

Do not classify `(direct) / (none)` traffic as LLM traffic unless the app has a first-party signal such as a landing-page parameter, an app-generated `llm_source`, or a known campaign tag.

## Error Handling

Expected cases:

- `401` or `403`: missing `analytics.edit`, expired token, or user lacks Editor/Admin access on the property.
- `404`: invalid property or the user cannot access it.
- `409` or API validation error: resource already exists or incompatible definition.
- Quota/rate errors: back off and return a retryable setup error.

Treat "already exists" as success only after confirming the existing resource matches the intended `displayName` or `parameterName`.

## Tests

Before implementation, add table-driven Go tests for:

- property normalization from `123456789` and `properties/123456789`
- no duplicate creation when channel group exists
- no duplicate creation when `llm_source` exists
- partial success when one resource succeeds and the other fails
- omission of `caseSensitive` in channel group payload
- custom dimension payload uses `scope: EVENT`

Mock `AdminClient`; do not hit live Google APIs in unit tests.

## Official References

- GA4 Admin API channel groups resource: https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/properties.channelGroups
- Create channel group: https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/properties.channelGroups/create
- List channel groups: https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/properties.channelGroups/list
- GA4 Admin API custom dimensions resource: https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.customDimensions
- Create custom dimension: https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.customDimensions/create
- List custom dimensions: https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.customDimensions/list
- GA4 Help, custom channel groups and AI assistants example: https://support.google.com/analytics/answer/13051316
