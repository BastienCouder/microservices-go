package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrInvalidUser  = errors.New("invalid user")
)

type User struct {
	ID             int64
	AuthIdentityID string
	Email          string
	FirstName      string
	LastName       string
	CreatedAt      time.Time
}

func (u *User) Validate() error {
	if strings.TrimSpace(u.AuthIdentityID) == "" {
		return fmt.Errorf("%w: auth identity id is required", ErrInvalidUser)
	}
	if strings.TrimSpace(u.Email) == "" {
		return fmt.Errorf("%w: email is required", ErrInvalidUser)
	}
	if strings.TrimSpace(u.FirstName) == "" {
		return fmt.Errorf("%w: first name is required", ErrInvalidUser)
	}
	if strings.TrimSpace(u.LastName) == "" {
		return fmt.Errorf("%w: last name is required", ErrInvalidUser)
	}
	return nil
}
