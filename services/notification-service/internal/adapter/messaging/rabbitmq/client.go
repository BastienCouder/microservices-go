package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	amqp "github.com/rabbitmq/amqp091-go"
)

type NotificationMessage struct {
	Channel   string          `json:"channel"`
	Recipient string          `json:"recipient"`
	Subject   string          `json:"subject"`
	Message   string          `json:"message"`
	Template  string          `json:"template,omitempty"`
	Locale    string          `json:"locale,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
}

type Client struct {
	conn         *amqp.Connection
	channel      *amqp.Channel
	exchange     string
	queue        string
	routingKey   string
	consumerName string
}

func NewClient(amqpURL, exchange, queue, routingKey, consumerName string) (*Client, error) {
	amqpURL = strings.TrimSpace(amqpURL)
	exchange = strings.TrimSpace(exchange)
	queue = strings.TrimSpace(queue)
	routingKey = strings.TrimSpace(routingKey)
	consumerName = strings.TrimSpace(consumerName)
	if amqpURL == "" || exchange == "" || queue == "" || routingKey == "" {
		return nil, fmt.Errorf("amqpURL, exchange, queue and routingKey are required")
	}
	if consumerName == "" {
		consumerName = "notification-service"
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
		conn:         conn,
		channel:      ch,
		exchange:     exchange,
		queue:        queue,
		routingKey:   routingKey,
		consumerName: consumerName,
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
	if err := c.channel.Qos(10, 0, false); err != nil {
		return fmt.Errorf("set qos: %w", err)
	}
	return nil
}

func (c *Client) ConsumeNotifications(ctx context.Context, handler func(context.Context, NotificationMessage) error) error {
	deliveries, err := c.channel.Consume(c.queue, c.consumerName, false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("consume queue: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case message, ok := <-deliveries:
			if !ok {
				return fmt.Errorf("rabbitmq deliveries channel closed")
			}
			payload, err := decodeNotificationMessage(message.Body)
			if err != nil {
				_ = message.Nack(false, false)
				continue
			}
			if err := handler(ctx, payload); err != nil {
				_ = message.Nack(false, true)
				continue
			}
			_ = message.Ack(false)
		}
	}
}

func decodeNotificationMessage(body []byte) (NotificationMessage, error) {
	var message NotificationMessage
	if err := json.Unmarshal(body, &message); err != nil {
		return NotificationMessage{}, err
	}
	message.Channel = strings.TrimSpace(strings.ToLower(message.Channel))
	message.Recipient = strings.TrimSpace(message.Recipient)
	message.Subject = strings.TrimSpace(message.Subject)
	message.Message = strings.TrimSpace(message.Message)
	message.Template = strings.TrimSpace(strings.ToLower(message.Template))
	message.Locale = strings.TrimSpace(strings.ToLower(message.Locale))
	if message.Channel == "" || message.Recipient == "" || message.Subject == "" || message.Message == "" {
		return NotificationMessage{}, fmt.Errorf("notification message is missing required fields")
	}
	return message, nil
}
