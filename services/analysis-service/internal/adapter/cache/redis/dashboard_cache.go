package redis

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

type DashboardCache struct {
	addr      string
	password  string
	ioTimeout time.Duration
}

func NewDashboardCache(addr, password string) *DashboardCache {
	return &DashboardCache{
		addr:      strings.TrimSpace(addr),
		password:  strings.TrimSpace(password),
		ioTimeout: 3 * time.Second,
	}
}

func (c *DashboardCache) GetDashboard(ctx context.Context, projectID string, organizationID int64) (usecase.DashboardData, bool, error) {
	reply, err := c.do(ctx, "GET", cacheKey(projectID, organizationID))
	if err != nil {
		return usecase.DashboardData{}, false, err
	}
	if reply.nil {
		return usecase.DashboardData{}, false, nil
	}

	var dashboard usecase.DashboardData
	if err := json.Unmarshal(reply.bulk, &dashboard); err != nil {
		return usecase.DashboardData{}, false, fmt.Errorf("decode cached dashboard: %w", err)
	}
	return dashboard, true, nil
}

func (c *DashboardCache) SetDashboard(ctx context.Context, projectID string, organizationID int64, data usecase.DashboardData, ttl time.Duration) error {
	if ttl <= 0 {
		return nil
	}

	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("encode cached dashboard: %w", err)
	}
	ttlSeconds := max(1, int(ttl.Round(time.Second)/time.Second))
	_, err = c.do(ctx, "SET", cacheKey(projectID, organizationID), string(payload), "EX", strconv.Itoa(ttlSeconds))
	if err != nil {
		return err
	}
	return nil
}

func (c *DashboardCache) DeleteDashboard(ctx context.Context, projectID string, organizationID int64) error {
	_, err := c.do(ctx, "DEL", cacheKey(projectID, organizationID))
	return err
}

type redisReply struct {
	bulk []byte
	nil  bool
}

func (c *DashboardCache) do(ctx context.Context, parts ...string) (redisReply, error) {
	if c == nil || c.addr == "" {
		return redisReply{}, errors.New("redis cache address is empty")
	}

	dialer := &net.Dialer{Timeout: c.ioTimeout}
	conn, err := dialer.DialContext(ctx, "tcp", c.addr)
	if err != nil {
		return redisReply{}, fmt.Errorf("dial redis %s: %w", c.addr, err)
	}
	defer conn.Close()

	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	} else {
		_ = conn.SetDeadline(time.Now().Add(c.ioTimeout))
	}

	reader := bufio.NewReader(conn)
	if c.password != "" {
		if err := writeCommand(conn, "AUTH", c.password); err != nil {
			return redisReply{}, err
		}
		if _, err := readReply(reader); err != nil {
			return redisReply{}, fmt.Errorf("auth redis: %w", err)
		}
	}

	if err := writeCommand(conn, parts...); err != nil {
		return redisReply{}, err
	}
	reply, err := readReply(reader)
	if err != nil {
		return redisReply{}, err
	}
	return reply, nil
}

func cacheKey(projectID string, organizationID int64) string {
	return fmt.Sprintf("analysis:dashboard:v1:org:%d:project:%s", organizationID, strings.TrimSpace(projectID))
}

func writeCommand(w io.Writer, parts ...string) error {
	if _, err := fmt.Fprintf(w, "*%d\r\n", len(parts)); err != nil {
		return fmt.Errorf("write redis command header: %w", err)
	}
	for _, part := range parts {
		if _, err := fmt.Fprintf(w, "$%d\r\n%s\r\n", len(part), part); err != nil {
			return fmt.Errorf("write redis command part: %w", err)
		}
	}
	return nil
}

func readReply(reader *bufio.Reader) (redisReply, error) {
	prefix, err := reader.ReadByte()
	if err != nil {
		return redisReply{}, fmt.Errorf("read redis reply prefix: %w", err)
	}

	switch prefix {
	case '+', ':':
		if _, err := reader.ReadString('\n'); err != nil {
			return redisReply{}, fmt.Errorf("read redis inline reply: %w", err)
		}
		return redisReply{}, nil
	case '-':
		line, err := reader.ReadString('\n')
		if err != nil {
			return redisReply{}, fmt.Errorf("read redis error reply: %w", err)
		}
		return redisReply{}, errors.New(strings.TrimSpace(line))
	case '$':
		line, err := reader.ReadString('\n')
		if err != nil {
			return redisReply{}, fmt.Errorf("read redis bulk size: %w", err)
		}
		size, err := strconv.Atoi(strings.TrimSpace(line))
		if err != nil {
			return redisReply{}, fmt.Errorf("parse redis bulk size: %w", err)
		}
		if size == -1 {
			return redisReply{nil: true}, nil
		}

		payload := make([]byte, size+2)
		if _, err := io.ReadFull(reader, payload); err != nil {
			return redisReply{}, fmt.Errorf("read redis bulk payload: %w", err)
		}
		return redisReply{bulk: payload[:size]}, nil
	default:
		return redisReply{}, fmt.Errorf("unsupported redis reply prefix %q", prefix)
	}
}
