package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
)

type notificationMessage struct {
	Channel   string `json:"channel"`
	Recipient string `json:"recipient"`
	Subject   string `json:"subject"`
	Message   string `json:"message"`
	Template  string `json:"template,omitempty"`
	Locale    string `json:"locale,omitempty"`
	Data      any    `json:"data,omitempty"`
}

type invitationTemplateData struct {
	OrganizationName string     `json:"organizationName"`
	Role             string     `json:"role,omitempty"`
	ProjectName      string     `json:"projectName,omitempty"`
	CustomMessage    string     `json:"customMessage,omitempty"`
	AcceptURL        string     `json:"acceptUrl,omitempty"`
	ExpiresAt        *time.Time `json:"expiresAt,omitempty"`
	Locale           string     `json:"locale"`
}

type Client struct {
	conn       *amqp.Connection
	channel    *amqp.Channel
	exchange   string
	queue      string
	routingKey string
}

func NewClient(amqpURL, exchange, queue, routingKey string) (*Client, error) {
	amqpURL = strings.TrimSpace(amqpURL)
	exchange = strings.TrimSpace(exchange)
	queue = strings.TrimSpace(queue)
	routingKey = strings.TrimSpace(routingKey)
	if amqpURL == "" || exchange == "" || queue == "" || routingKey == "" {
		return nil, fmt.Errorf("amqpURL, exchange, queue and routingKey are required")
	}

	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		return nil, fmt.Errorf("dial rabbitmq: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("open rabbitmq channel: %w", err)
	}

	client := &Client{
		conn:       conn,
		channel:    ch,
		exchange:   exchange,
		queue:      queue,
		routingKey: routingKey,
	}
	if err := client.declareTopology(); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, err
	}
	return client, nil
}

func (c *Client) Close() error {
	if c == nil {
		return nil
	}
	var closeErr error
	if c.channel != nil {
		if err := c.channel.Close(); err != nil {
			closeErr = err
		}
	}
	if c.conn != nil {
		if err := c.conn.Close(); err != nil && closeErr == nil {
			closeErr = err
		}
	}
	return closeErr
}

func (c *Client) declareTopology() error {
	if err := c.channel.ExchangeDeclare(c.exchange, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare exchange: %w", err)
	}
	if _, err := c.channel.QueueDeclare(c.queue, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare queue: %w", err)
	}
	if err := c.channel.QueueBind(c.queue, c.routingKey, c.exchange, false, nil); err != nil {
		return fmt.Errorf("bind queue: %w", err)
	}
	return nil
}

func (c *Client) SendInvitation(ctx context.Context, invitation usecase.InvitationNotification) error {
	message := buildInvitationNotificationMessage(invitation)
	if strings.TrimSpace(message.Recipient) == "" {
		return fmt.Errorf("invitation recipient email is required")
	}
	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("marshal invitation notification message: %w", err)
	}

	if err := c.channel.PublishWithContext(
		ctx,
		c.exchange,
		c.routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Timestamp:    time.Now().UTC(),
			Body:         body,
		},
	); err != nil {
		return fmt.Errorf("publish invitation notification message: %w", err)
	}
	return nil
}

func buildInvitationNotificationMessage(invitation usecase.InvitationNotification) notificationMessage {
	organizationName := strings.TrimSpace(invitation.OrganizationName)
	if organizationName == "" {
		organizationName = "votre organisation"
	}

	return notificationMessage{
		Channel:   "email",
		Recipient: strings.TrimSpace(invitation.Email),
		Subject:   "Invitation à rejoindre " + organizationName,
		Message:   buildInvitationMessage(invitation, organizationName),
		Template:  "invitation",
		Locale:    domain.NormalizeInvitationLocale(invitation.Locale),
		Data: invitationTemplateData{
			OrganizationName: organizationName,
			Role:             strings.TrimSpace(invitation.Role),
			ProjectName:      strings.TrimSpace(invitation.ProjectName),
			CustomMessage:    strings.TrimSpace(invitation.Message),
			AcceptURL:        strings.TrimSpace(invitation.AcceptURL),
			ExpiresAt:        invitation.ExpiresAt,
			Locale:           domain.NormalizeInvitationLocale(invitation.Locale),
		},
	}
}

func buildInvitationMessage(invitation usecase.InvitationNotification, organizationName string) string {
	lines := []string{
		"Vous avez été invité à rejoindre " + organizationName + ".",
	}
	if role := strings.TrimSpace(invitation.Role); role != "" {
		lines = append(lines, "Rôle: "+role+".")
	}
	if projectName := strings.TrimSpace(invitation.ProjectName); projectName != "" {
		lines = append(lines, "Cette invitation est limitée au projet "+projectName+".")
	}
	if message := strings.TrimSpace(invitation.Message); message != "" {
		lines = append(lines, "", message)
	}
	if acceptURL := strings.TrimSpace(invitation.AcceptURL); acceptURL != "" {
		lines = append(lines, "", "Accepter l'invitation: "+acceptURL)
	}
	if invitation.ExpiresAt != nil {
		lines = append(lines, "Expire le : "+invitation.ExpiresAt.UTC().Format(time.RFC3339)+".")
	}
	return strings.Join(lines, "\n")
}
