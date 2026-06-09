package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAnalysisStateStoreRoundTripUsesRelationalTables(t *testing.T) {
	dsn := os.Getenv("ANALYSIS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ANALYSIS_TEST_DATABASE_URL is required for integration tests")
	}

	ctx := context.Background()
	testDSN, cleanup := createAnalysisTestSchema(t, ctx, dsn)
	defer cleanup()

	if err := RunMigrations(testDSN); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	db, err := pgxpool.New(ctx, testDSN)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	defer db.Close()

	store := NewStateStore(db)
	payload := []byte(`{
		"seq": 12,
		"runs": {
			"run-1": {
				"id": "run-1",
				"projectId": "prj-1",
				"organizationId": 42,
				"createdBy": 7,
				"runType": "manual",
				"status": "completed",
				"promptsCount": 1,
				"modelsCount": 2,
				"expectedResponses": 2,
				"completedResponses": 2,
				"visibilityScore": 80,
				"createdAt": "2026-03-01T10:00:00Z",
				"updatedAt": "2026-03-01T11:00:00Z"
			}
		},
		"runsByProject": {"prj-1": ["run-1"]},
		"promptRuns": {
			"prun-1": {
				"id": "prun-1",
				"runId": "run-1",
				"promptId": "prm-1",
				"promptText": "Quel outil recommander ?",
				"createdAt": "2026-03-01T10:10:00Z"
			}
		},
		"promptRunsByRun": {"run-1": ["prun-1"]},
		"responses": {
			"resp-1": {
				"id": "resp-1",
				"runId": "run-1",
				"promptRunId": "prun-1",
				"modelId": "gpt-4o",
				"rawResponse": "Acme est citee",
				"brandMentioned": true,
				"brandPosition": "top",
				"citationFound": true,
				"citedUrls": ["https://acme.test"],
				"sentiment": "positive",
				"createdAt": "2026-03-01T10:20:00Z"
			}
		},
		"responsesByRun": {"run-1": ["resp-1"]},
		"responseIndexByRun": {"run-1": {"prun-1|gpt-4o": "resp-1"}},
		"runByRequest": {"prj-1|request-1": "run-1"}
	}`)

	if err := store.Save(ctx, payload); err != nil {
		t.Fatalf("save state: %v", err)
	}

	assertAnalysisTableCount(t, ctx, db, "analysis_runs", 1)
	assertAnalysisTableCount(t, ctx, db, "prompt_runs", 1)
	assertAnalysisTableCount(t, ctx, db, "ai_responses", 1)

	loaded, ok, err := store.Load(ctx)
	if err != nil {
		t.Fatalf("load state: %v", err)
	}
	if !ok {
		t.Fatalf("expected persisted state to exist")
	}

	var got map[string]any
	if err := json.Unmarshal(loaded, &got); err != nil {
		t.Fatalf("unmarshal loaded payload: %v", err)
	}

	if seq, ok := got["seq"].(float64); !ok || int(seq) != 12 {
		t.Fatalf("expected seq 12, got %#v", got["seq"])
	}
	runByRequest := got["runByRequest"].(map[string]any)
	if runByRequest["prj-1|request-1"] != "run-1" {
		t.Fatalf("expected request index to be restored, got %#v", runByRequest)
	}
}

func TestRunMigrationsMigratesLegacyAnalysisPayload(t *testing.T) {
	dsn := os.Getenv("ANALYSIS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ANALYSIS_TEST_DATABASE_URL is required for integration tests")
	}

	ctx := context.Background()
	testDSN, cleanup := createAnalysisTestSchema(t, ctx, dsn)
	defer cleanup()

	db, err := pgxpool.New(ctx, testDSN)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	defer db.Close()

	legacyPayload := `{
		"seq": 3,
		"runs": {
			"run-legacy": {
				"id": "run-legacy",
				"projectId": "prj-legacy",
				"runType": "manual",
				"status": "running",
				"promptsCount": 1,
				"modelsCount": 1,
				"expectedResponses": 1,
				"completedResponses": 0,
				"visibilityScore": 0,
				"createdAt": "2026-03-01T10:00:00Z",
				"updatedAt": "2026-03-01T10:00:00Z"
			}
		},
		"runsByProject": {"prj-legacy": ["run-legacy"]},
		"promptRuns": {},
		"promptRunsByRun": {},
		"responses": {},
		"responsesByRun": {},
		"responseIndexByRun": {},
		"runByRequest": {"prj-legacy|req-legacy": "run-legacy"}
	}`
	if _, err := db.Exec(ctx, `
		CREATE TABLE analysis_service_state (
			id SMALLINT PRIMARY KEY,
			payload JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT analysis_service_state_singleton CHECK (id = 1)
		)
	`); err != nil {
		t.Fatalf("create legacy state table: %v", err)
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO analysis_service_state (id, payload, updated_at)
		VALUES (1, $1::jsonb, NOW())
	`, legacyPayload); err != nil {
		t.Fatalf("seed legacy state: %v", err)
	}

	if err := RunMigrations(testDSN); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	store := NewStateStore(db)
	loaded, ok, err := store.Load(ctx)
	if err != nil {
		t.Fatalf("load state after migration: %v", err)
	}
	if !ok {
		t.Fatalf("expected migrated state to exist")
	}

	var got map[string]any
	if err := json.Unmarshal(loaded, &got); err != nil {
		t.Fatalf("unmarshal loaded payload: %v", err)
	}
	runs := got["runs"].(map[string]any)
	if _, exists := runs["run-legacy"]; !exists {
		t.Fatalf("expected legacy run to be migrated, got %#v", runs)
	}

	var exists bool
	if err := db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = current_schema()
			  AND table_name = 'analysis_service_state'
		)
	`).Scan(&exists); err != nil {
		t.Fatalf("check legacy table removal: %v", err)
	}
	if exists {
		t.Fatalf("expected legacy analysis_service_state table to be dropped")
	}
}

func createAnalysisTestSchema(t *testing.T, ctx context.Context, baseDSN string) (string, func()) {
	t.Helper()

	baseDB, err := pgxpool.New(ctx, baseDSN)
	if err != nil {
		t.Fatalf("open base db: %v", err)
	}

	schema := fmt.Sprintf("analysis_state_test_%d", time.Now().UnixNano())
	if _, err := baseDB.Exec(ctx, fmt.Sprintf(`CREATE SCHEMA "%s"`, schema)); err != nil {
		baseDB.Close()
		t.Fatalf("create schema: %v", err)
	}

	testDSN := withAnalysisSearchPath(t, baseDSN, schema)
	cleanup := func() {
		_, _ = baseDB.Exec(context.Background(), fmt.Sprintf(`DROP SCHEMA IF EXISTS "%s" CASCADE`, schema))
		baseDB.Close()
	}
	return testDSN, cleanup
}

func withAnalysisSearchPath(t *testing.T, rawDSN, schema string) string {
	t.Helper()

	parsed, err := url.Parse(rawDSN)
	if err != nil {
		t.Fatalf("parse dsn: %v", err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func assertAnalysisTableCount(t *testing.T, ctx context.Context, db *pgxpool.Pool, table string, want int) {
	t.Helper()

	var got int
	if err := db.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM %s`, table)).Scan(&got); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	if got != want {
		t.Fatalf("expected %d rows in %s, got %d", want, table, got)
	}
}
