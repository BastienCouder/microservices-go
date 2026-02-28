package domain

import "context"

type Repository interface {
	Check(ctx context.Context, in CheckInput) (CheckResult, error)
}
