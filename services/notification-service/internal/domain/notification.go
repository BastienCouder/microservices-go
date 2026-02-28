package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidNotification = errors.New("invalid notification")
)

type Notification struct {
	ID        int64
	Channel   string
	Recipient string
	Subject   string
	Message   string
	CreatedAt time.Time
}

func (n *Notification) Validate() error {
	if strings.TrimSpace(n.Channel) == "" {
		return fmt.Errorf("%w: channel is required", ErrInvalidNotification)
	}
	if strings.TrimSpace(n.Recipient) == "" {
		return fmt.Errorf("%w: recipient is required", ErrInvalidNotification)
	}
	if strings.TrimSpace(n.Message) == "" {
		return fmt.Errorf("%w: message is required", ErrInvalidNotification)
	}
	return nil
}
