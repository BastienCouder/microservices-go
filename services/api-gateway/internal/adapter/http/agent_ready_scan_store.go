package http

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
)

type agentReadyScanStore struct {
	mu    sync.RWMutex
	scans map[string]agentReadyScanResult
}

func newAgentReadyScanStore() *agentReadyScanStore {
	return &agentReadyScanStore{scans: make(map[string]agentReadyScanResult)}
}

func (s *agentReadyScanStore) create(input agentReadyScanRequest) string {
	id := newAgentReadyScanID()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.scans[id] = agentReadyScanResult{
		ScanID: id,
		Status: "queued",
		URL:    input.URL,
		Mode:   input.Mode,
	}
	return id
}

func (s *agentReadyScanStore) update(id string, result agentReadyScanResult) {
	result.ScanID = id
	s.mu.Lock()
	defer s.mu.Unlock()
	s.scans[id] = result
}

func (s *agentReadyScanStore) markRunning(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := s.scans[id]
	result.Status = "running"
	s.scans[id] = result
}

func (s *agentReadyScanStore) get(id string) (agentReadyScanResult, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result, ok := s.scans[id]
	return result, ok
}

func newAgentReadyScanID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return hex.EncodeToString([]byte("agent-ready-scan"))
	}
	return hex.EncodeToString(bytes[:])
}
