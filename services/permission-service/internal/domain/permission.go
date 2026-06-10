package domain

import (
	"errors"
	"fmt"
	"strings"
)

var (
	ErrInvalidPermissionCheck = errors.New("invalid permission check")
)

type CheckInput struct {
	OrganizationID int64
	UserID         int64
	Action         string
	Resource       string
	Roles          []string
}

type CheckResult struct {
	Allowed bool
	Reason  string
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
	if len(in.Roles) == 0 {
		return fmt.Errorf("%w: at least one role is required", ErrInvalidPermissionCheck)
	}
	return nil
}
