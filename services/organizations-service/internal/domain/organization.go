package domain

import (
	"errors"
	"fmt"
	"net/mail"
	"slices"
	"strings"
	"time"
)

var (
	ErrOrganizationNotFound     = errors.New("organization not found")
	ErrInvalidOrganization      = errors.New("invalid organization")
	ErrTeamNotFound             = errors.New("team not found")
	ErrInvalidTeam              = errors.New("invalid team")
	ErrMemberNotFound           = errors.New("member not found")
	ErrInvalidMember            = errors.New("invalid member")
	ErrInvalidRole              = errors.New("invalid role")
	ErrInvitationNotFound       = errors.New("invitation not found")
	ErrInvalidInvitation        = errors.New("invalid invitation")
	ErrInvitationExpired        = errors.New("invitation expired")
	ErrInvitationAlreadyHandled = errors.New("invitation already handled")
	ErrInvitationEmailMismatch  = errors.New("invitation email does not match authenticated user")
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

type OrganizationAPIKey struct {
	ID             int64      `json:"id"`
	OrganizationID int64      `json:"organizationId"`
	Name           string     `json:"name"`
	Prefix         string     `json:"prefix"`
	KeyHash        string     `json:"-"`
	Key            string     `json:"key,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	LastUsedAt     *time.Time `json:"lastUsedAt,omitempty"`
	RevokedAt      *time.Time `json:"revokedAt,omitempty"`
}

func (k *OrganizationAPIKey) ValidateForCreate() error {
	if k.OrganizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", ErrInvalidOrganization)
	}
	if strings.TrimSpace(k.Name) == "" {
		return fmt.Errorf("%w: api key name is required", ErrInvalidOrganization)
	}
	if strings.TrimSpace(k.Prefix) == "" {
		return fmt.Errorf("%w: api key prefix is required", ErrInvalidOrganization)
	}
	if strings.TrimSpace(k.KeyHash) == "" {
		return fmt.Errorf("%w: api key hash is required", ErrInvalidOrganization)
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
	Email          string
	FirstName      string
	LastName       string
	Roles          []string
	AddedAt        time.Time
	DeletedAt      *time.Time
}

type ProjectMember struct {
	ProjectID      string    `json:"projectId"`
	OrganizationID int64     `json:"organizationId"`
	UserID         int64     `json:"userId"`
	Role           string    `json:"role"`
	AddedAt        time.Time `json:"addedAt"`
}

type Membership struct {
	OrganizationID int64
	UserID         int64
	Roles          []string
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

type InvitationStatus string

const (
	RoleBanned = "banned"
)

const (
	InvitationStatusPending  InvitationStatus = "pending"
	InvitationStatusAccepted InvitationStatus = "accepted"
	InvitationStatusRefused  InvitationStatus = "refused"
	InvitationStatusRevoked  InvitationStatus = "revoked"
)

type Invitation struct {
	ID               int64
	OrganizationID   int64
	ProjectID        string
	Email            string
	Role             string
	Token            string
	Message          string
	Status           InvitationStatus
	InvitedByUserID  int64
	AcceptedByUserID int64
	CreatedAt        time.Time
	ExpiresAt        *time.Time
	RespondedAt      *time.Time
	DeletedAt        *time.Time
}

func NormalizeInvitationEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", fmt.Errorf("%w: email is required", ErrInvalidInvitation)
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", fmt.Errorf("%w: invalid email", ErrInvalidInvitation)
	}
	return email, nil
}

func (i *Invitation) ValidateForCreate() error {
	if i.OrganizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", ErrInvalidInvitation)
	}
	if i.InvitedByUserID <= 0 {
		return fmt.Errorf("%w: inviter user id must be positive", ErrInvalidInvitation)
	}
	if strings.TrimSpace(i.Token) == "" {
		return fmt.Errorf("%w: token is required", ErrInvalidInvitation)
	}
	if _, err := NormalizeInvitationEmail(i.Email); err != nil {
		return err
	}
	if _, err := NormalizeRole(i.Role); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidInvitation, err)
	}
	if i.Status != InvitationStatusPending {
		return fmt.Errorf("%w: status must be pending on create", ErrInvalidInvitation)
	}
	if i.ExpiresAt != nil && !i.ExpiresAt.After(i.CreatedAt) {
		return fmt.Errorf("%w: expiration must be in the future", ErrInvalidInvitation)
	}
	return nil
}
