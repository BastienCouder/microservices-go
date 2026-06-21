package domain

import (
	"errors"
	"fmt"
	"strings"
)

var (
	ErrInvalidPermissionCheck   = errors.New("invalid permission check")
	ErrSuperAdminAlreadyClaimed = errors.New("super admin already claimed")
)

type CheckInput struct {
	OrganizationID int64
	UserID         int64
	Action         string
	Resource       string
	ProjectID      string
	ResourceID     string
	Roles          []string
}

type CheckResult struct {
	Allowed bool
	Reason  string
}

type Membership struct {
	OrganizationID int64
	UserID         int64
	Roles          []string
}

type Member struct {
	OrganizationID int64    `json:"organizationId"`
	UserID         int64    `json:"userId"`
	Roles          []string `json:"roles"`
}

type ProjectMember struct {
	ProjectID      string `json:"projectId"`
	OrganizationID int64  `json:"organizationId"`
	UserID         int64  `json:"userId"`
	Role           string `json:"role"`
}

func (in *CheckInput) Validate() error {
	if in.OrganizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", ErrInvalidPermissionCheck)
	}
	if in.UserID <= 0 {
		return fmt.Errorf("%w: user id must be positive", ErrInvalidPermissionCheck)
	}
	if strings.TrimSpace(in.Action) == "" {
		return fmt.Errorf("%w: action is required", ErrInvalidPermissionCheck)
	}
	if strings.TrimSpace(in.Resource) == "" {
		return fmt.Errorf("%w: resource is required", ErrInvalidPermissionCheck)
	}
	return nil
}
