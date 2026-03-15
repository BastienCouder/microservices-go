package usecase

import "strings"

const (
	WhiteLabelVersion             = 1
	WhiteLabelTemplateExecutive   = "executive"
	WhiteLabelTemplatePerformance = "performance"
	WhiteLabelTemplateBoard       = "board"
	WhiteLabelFrequencyWeekly     = "weekly"
	WhiteLabelFrequencyMonthly    = "monthly"
	WhiteLabelFrequencyQuarterly  = "quarterly"
	DefaultWhiteLabelTimezone     = "UTC"
	DefaultWhiteLabelShareTTL     = 168
)

type WhiteLabelSettings struct {
	Version   int                 `json:"version,omitempty"`
	Branding  WhiteLabelBranding  `json:"branding,omitempty"`
	Reporting WhiteLabelReporting `json:"reporting,omitempty"`
}

type WhiteLabelBranding struct {
	PlatformName   string `json:"platformName,omitempty"`
	LogoURL        string `json:"logoUrl,omitempty"`
	FaviconURL     string `json:"faviconUrl,omitempty"`
	PrimaryColor   string `json:"primaryColor,omitempty"`
	SecondaryColor string `json:"secondaryColor,omitempty"`
	AccentColor    string `json:"accentColor,omitempty"`
	FontFamily     string `json:"fontFamily,omitempty"`
	EmailFromName  string `json:"emailFromName,omitempty"`
	EmailReplyTo   string `json:"emailReplyTo,omitempty"`
	CustomDomain   string `json:"customDomain,omitempty"`
}

type WhiteLabelReporting struct {
	Template          string   `json:"template,omitempty"`
	Locale            string   `json:"locale,omitempty"`
	Timezone          string   `json:"timezone,omitempty"`
	Frequency         string   `json:"frequency,omitempty"`
	Recipients        []string `json:"recipients,omitempty"`
	LiveShareEnabled  bool     `json:"liveShareEnabled,omitempty"`
	ShareLinkTTLHours int      `json:"shareLinkTTLHours,omitempty"`
}

func normalizeWhiteLabelSettings(input WhiteLabelSettings, project Project) WhiteLabelSettings {
	platformName := firstNonEmpty(
		strings.TrimSpace(input.Branding.PlatformName),
		strings.TrimSpace(project.BrandName),
		strings.TrimSpace(project.Name),
		"Client Workspace",
	)
	locale := normalizeWhiteLabelLocale(input.Reporting.Locale, project.PrimaryLanguage)

	return WhiteLabelSettings{
		Version: WhiteLabelVersion,
		Branding: WhiteLabelBranding{
			PlatformName:   platformName,
			LogoURL:        strings.TrimSpace(input.Branding.LogoURL),
			FaviconURL:     strings.TrimSpace(input.Branding.FaviconURL),
			PrimaryColor:   strings.TrimSpace(input.Branding.PrimaryColor),
			SecondaryColor: strings.TrimSpace(input.Branding.SecondaryColor),
			AccentColor:    strings.TrimSpace(input.Branding.AccentColor),
			FontFamily:     strings.TrimSpace(input.Branding.FontFamily),
			EmailFromName: firstNonEmpty(
				strings.TrimSpace(input.Branding.EmailFromName),
				platformName,
			),
			EmailReplyTo: strings.TrimSpace(input.Branding.EmailReplyTo),
			CustomDomain: strings.TrimSpace(input.Branding.CustomDomain),
		},
		Reporting: WhiteLabelReporting{
			Template:          normalizeWhiteLabelTemplate(input.Reporting.Template),
			Locale:            locale,
			Timezone:          firstNonEmpty(strings.TrimSpace(input.Reporting.Timezone), DefaultWhiteLabelTimezone),
			Frequency:         normalizeWhiteLabelFrequency(input.Reporting.Frequency),
			Recipients:        normalizeWhiteLabelRecipients(input.Reporting.Recipients),
			LiveShareEnabled:  input.Reporting.LiveShareEnabled,
			ShareLinkTTLHours: normalizeWhiteLabelShareTTL(input.Reporting.ShareLinkTTLHours),
		},
	}
}

func copyWhiteLabelSettings(value WhiteLabelSettings) WhiteLabelSettings {
	out := value
	out.Branding = value.Branding
	out.Reporting = value.Reporting
	out.Reporting.Recipients = append([]string(nil), value.Reporting.Recipients...)
	return out
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func normalizeWhiteLabelTemplate(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case WhiteLabelTemplatePerformance:
		return WhiteLabelTemplatePerformance
	case WhiteLabelTemplateBoard:
		return WhiteLabelTemplateBoard
	default:
		return WhiteLabelTemplateExecutive
	}
}

func normalizeWhiteLabelFrequency(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case WhiteLabelFrequencyWeekly:
		return WhiteLabelFrequencyWeekly
	case WhiteLabelFrequencyQuarterly:
		return WhiteLabelFrequencyQuarterly
	default:
		return WhiteLabelFrequencyMonthly
	}
}

func normalizeWhiteLabelLocale(value string, fallback string) string {
	switch strings.ToLower(strings.TrimSpace(firstNonEmpty(value, fallback))) {
	case "en", "es", "de":
		return strings.ToLower(strings.TrimSpace(firstNonEmpty(value, fallback)))
	default:
		return "fr"
	}
}

func normalizeWhiteLabelShareTTL(value int) int {
	switch {
	case value < 24:
		return DefaultWhiteLabelShareTTL
	case value > 24*30:
		return 24 * 30
	default:
		return value
	}
}

func normalizeWhiteLabelRecipients(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(strings.ToLower(value))
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}
