-- name: CreateNotification :one
INSERT INTO notifications (channel, recipient, subject, message, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, channel, recipient, subject, message, created_at;

-- name: ListNotifications :many
SELECT id, channel, recipient, subject, message, created_at
FROM notifications
ORDER BY id DESC
LIMIT $1;
