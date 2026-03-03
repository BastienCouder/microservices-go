package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type projectFinalizeMessage struct {
	EventID string `json:"eventId"`
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
		consumerName = "project-service"
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
	if err := c.channel.ExchangeDeclare(
		c.exchange,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("declare exchange: %w", err)
	}
	if _, err := c.channel.QueueDeclare(
		c.queue,
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("declare queue: %w", err)
	}
	if err := c.channel.QueueBind(
		c.queue,
		c.routingKey,
		c.exchange,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("bind queue: %w", err)
	}
	if err := c.channel.Qos(10, 0, false); err != nil {
		return fmt.Errorf("set qos: %w", err)
	}
	return nil
}

func (c *Client) PublishProjectFinalized(ctx context.Context, eventID string) error {
	eventID = strings.TrimSpace(eventID)
	if eventID == "" {
		return fmt.Errorf("eventId is required")
	}
	body, err := json.Marshal(projectFinalizeMessage{EventID: eventID})
	if err != nil {
		return fmt.Errorf("marshal project finalize message: %w", err)
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
		return fmt.Errorf("publish project finalize message: %w", err)
	}
	return nil
}

func (c *Client) ConsumeProjectFinalized(ctx context.Context, handler func(context.Context, string) error) error {
	deliveries, err := c.channel.Consume(
		c.queue,
		c.consumerName,
		false,
		false,
		false,
		false,
		nil,
	)
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
			var payload projectFinalizeMessage
			if err := json.Unmarshal(message.Body, &payload); err != nil {
				_ = message.Nack(false, false)
				continue
			}
			if err := handler(ctx, payload.EventID); err != nil {
				_ = message.Nack(false, true)
				continue
			}
			_ = message.Ack(false)
		}
	}
}
