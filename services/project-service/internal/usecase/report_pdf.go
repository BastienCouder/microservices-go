package usecase

import (
	"bytes"
	"fmt"
	"strings"
)

func buildProjectReportPDF(report ProjectReport) ([]byte, error) {
	lines := buildProjectReportTextLines(report)
	return buildSimplePDF(lines), nil
}

func buildProjectReportTextLines(report ProjectReport) []string {
	perceptionScores := extractPerceptionScores(report.Analytics.Perception)
	visibilityScore, completedResponses, expectedResponses := extractDashboardMetrics(report.Analytics.Dashboard)
	brandName := extractBrandName(report)

	lines := []string{
		report.WhiteLabel.Branding.PlatformName,
		report.Title,
		"",
		"Brand: " + brandName,
		"Generated: " + report.GeneratedAt.UTC().Format("2006-01-02 15:04 UTC"),
		"Period: " + report.PeriodLabel,
		"Frequency: " + report.Frequency,
		"",
		"Summary:",
		report.Summary,
		"",
		"Key metrics:",
		fmt.Sprintf("Visibility score: %d/100", visibilityScore),
		fmt.Sprintf("Completed responses: %d/%d", completedResponses, expectedResponses),
		fmt.Sprintf("Positioning accuracy: %d%%", perceptionScores.PositioningAccuracy),
		fmt.Sprintf("Factual accuracy: %d%%", perceptionScores.FactualAccuracy),
		fmt.Sprintf("Sentiment score: %d%%", perceptionScores.SentimentScore),
	}

	if len(report.EmailedRecipients) > 0 {
		lines = append(lines, "", "Recipients: "+strings.Join(report.EmailedRecipients, ", "))
	}

	return wrapPDFLines(lines, 92)
}

func wrapPDFLines(lines []string, limit int) []string {
	if limit <= 0 {
		return lines
	}
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		remaining := strings.TrimSpace(line)
		if remaining == "" {
			out = append(out, "")
			continue
		}
		for len(remaining) > limit {
			splitAt := strings.LastIndex(remaining[:limit], " ")
			if splitAt <= 0 {
				splitAt = limit
			}
			out = append(out, strings.TrimSpace(remaining[:splitAt]))
			remaining = strings.TrimSpace(remaining[splitAt:])
		}
		out = append(out, remaining)
	}
	return out
}

func buildSimplePDF(lines []string) []byte {
	if len(lines) == 0 {
		lines = []string{"Report"}
	}

	var content bytes.Buffer
	content.WriteString("BT\n/F1 12 Tf\n50 760 Td\n14 TL\n")
	for _, line := range lines {
		content.WriteString("(" + escapePDFText(line) + ") Tj\nT*\n")
	}
	content.WriteString("ET")

	var pdf bytes.Buffer
	offsets := []int{0}
	writeObject := func(id int, body string) {
		offsets = append(offsets, pdf.Len())
		pdf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", id, body))
	}

	pdf.WriteString("%PDF-1.4\n")
	writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>")
	writeObject(2, "<< /Type /Pages /Count 1 /Kids [3 0 R] >>")
	writeObject(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>")
	writeObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
	writeObject(5, fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", content.Len(), content.String()))

	xrefStart := pdf.Len()
	pdf.WriteString("xref\n0 6\n")
	pdf.WriteString("0000000000 65535 f \n")
	for _, offset := range offsets[1:] {
		pdf.WriteString(fmt.Sprintf("%010d 00000 n \n", offset))
	}
	pdf.WriteString("trailer\n<< /Size 6 /Root 1 0 R >>\n")
	pdf.WriteString(fmt.Sprintf("startxref\n%d\n%%%%EOF", xrefStart))
	return pdf.Bytes()
}

func escapePDFText(value string) string {
	value = strings.ReplaceAll(value, "\\", "\\\\")
	value = strings.ReplaceAll(value, "(", "\\(")
	value = strings.ReplaceAll(value, ")", "\\)")
	return value
}
