package service

import (
	"awcp-examples/backend/internal/model"
	"awcp-examples/backend/internal/repository"
	"context"
)

func (s *Sessions) Events(ctx context.Context, token, cursor string) (repository.EventBatch, error) {
	if token == "" {
		return repository.EventBatch{}, model.Failure(401, "session.expired", "请先建立演示会话。")
	}
	return s.Store.Events(ctx, tokenHash(token), cursor, s.clock())
}
