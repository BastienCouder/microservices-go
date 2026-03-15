package usecase

import "context"

type SchedulerLease interface {
	Release(ctx context.Context) error
}

type noopSchedulerLease struct{}

func (noopSchedulerLease) Release(_ context.Context) error {
	return nil
}
