package domain

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

var (
	ErrOrganizationNotFound = errors.New("organization not found")
	ErrInvalidOrganization  = errors.New("invalid organization")
	ErrTeamNotFound         = errors.New("team not found")
	ErrInvalidTeam          = errors.New("invalid team")
	ErrMemberNotFound       = errors.New("member not found")
	ErrInvalidMember        = errors.New("invalid member")
	ErrInvalidRole          = errors.New("invalid role")
)

type Organization struct {
	ID              int64
	Name            string
	OwnerIdentityID int64
	CreatedAt       time.Time
	DeletedAt       *time.Time
}

func (o *Organization) Validate() error {
	if strings.TrimSpace(o.Name) == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidOrganization)
	}
	if o.OwnerIdentityID <= 0 {
		return fmt.Errorf("%w: owner identity id must be positive", ErrInvalidOrganization)
	}
	return nil
}

type Team struct {
	ID             int64
	OrganizationID int64
	Name           string
	CreatedAt      time.Time
	DeletedAt      *time.Time
}

func (t *Team) Validate() error {
	if t.OrganizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", ErrInvalidTeam)
	}
	if strings.TrimSpace(t.Name) == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidTeam)
	}
	return nil
}

type Member struct {
	OrganizationID int64
	UserID         int64
	TeamID         int64
	Roles          []string
	AddedAt        time.Time
	DeletedAt      *time.Time
}

func (m *Member) Validate() error {
	if m.OrganizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", ErrInvalidMember)
	}
	if m.UserID <= 0 {
		return fmt.Errorf("%w: user id must be positive", ErrInvalidMember)
	}
	if m.TeamID < 0 {
		return fmt.Errorf("%w: team id must be zero or positive", ErrInvalidMember)
	}
	return nil
}

func NormalizeRole(role string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(role))
	if normalized == "" {
		return "", fmt.Errorf("%w: role is required", ErrInvalidRole)
	}
	return normalized, nil
}

func AddRole(roles []string, role string) []string {
	if slices.Contains(roles, role) {
		return roles
	}
	return append(roles, role)
}
