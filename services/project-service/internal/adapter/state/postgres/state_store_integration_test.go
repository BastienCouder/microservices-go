package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const testSecretEncryptionKey = "project-state-test-encryption-key"

func TestStateStoreRoundTripUsesRelationalTables(t *testing.T) {
	dsn := os.Getenv("PROJECT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PROJECT_TEST_DATABASE_URL is required for integration tests")
	}

	ctx := context.Background()
	testDSN, cleanup := createProjectTestSchema(t, ctx, dsn)
	defer cleanup()

	if err := RunMigrations(testDSN); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	db, err := pgxpool.New(ctx, testDSN)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	defer db.Close()

	store, err := NewStateStore(db, testSecretEncryptionKey)
	if err != nil {
		t.Fatalf("init state store: %v", err)
	}
	payload := []byte(`{
		"seq": 7,
		"projects": {
			"prj-1": {
				"id": "prj-1",
				"organizationId": 42,
				"createdBy": 7,
				"name": "Acme",
				"domain": "acme.test",
				"websiteUrl": "https://acme.test",
				"brandName": "Acme",
				"brandDescription": "Acme brand",
				"industry": "SaaS",
				"primaryLanguage": "fr",
				"country": "FR",
				"status": "active",
				"createdAt": "2026-03-01T10:00:00Z",
				"updatedAt": "2026-03-01T11:00:00Z",
				"deletedAt": "2026-03-02T09:00:00Z"
			}
		},
		"prompts": {
			"prm-1": {
				"id": "prm-1",
				"projectId": "prj-1",
				"text": "Quel outil recommander ?",
				"intent": "commercial",
				"modelIds": ["gpt-4o"],
				"schedule": {
					"mode": "per_model",
					"cron": "0 */6 * * *",
					"timezone": "UTC",
					"modelCrons": {
						"gpt-4o": "15 */2 * * *"
					}
				},
				"isActive": true,
				"createdAt": "2026-03-01T10:10:00Z",
				"updatedAt": "2026-03-01T11:10:00Z"
			}
		},
		"competitors": {
			"cmp-1": {
				"id": "cmp-1",
				"projectId": "prj-1",
				"name": "Competitor",
				"domain": "competitor.test",
				"websiteUrl": "https://competitor.test",
				"isActive": true,
				"createdAt": "2026-03-01T10:20:00Z",
				"updatedAt": "2026-03-01T11:20:00Z"
			}
		},
		"models": {
			"gpt-4o": {
				"id": "gpt-4o",
				"displayName": "GPT-4o",
				"provider": "openai",
				"groupName": "chatgpt",
				"iconPath": "/models/openai.svg",
				"providerModelId": "gpt-4o",
				"isActive": true,
				"supportsLiveSearch": false
			}
		},
		"projectModels": {
			"prj-1": {
				"gpt-4o": true
			}
		},
		"providerCredentials": {
			"prj-1": {
				"openai": {
					"apiKey": "sk-project-openai",
					"hasApiKey": true,
					"updatedAt": "2026-03-01T11:40:00Z"
				}
			}
		},
		"outbox": {
			"evt-1": {
				"id": "evt-1",
				"eventType": "project.finalized",
				"status": "pending",
				"payload": {
					"project": {
						"id": "prj-1",
						"organizationId": 42,
						"createdBy": 7,
						"name": "Acme",
						"domain": "acme.test",
						"websiteUrl": "https://acme.test",
						"brandName": "Acme",
						"primaryLanguage": "fr",
						"country": "FR",
						"status": "active",
						"createdAt": "2026-03-01T10:00:00Z",
						"updatedAt": "2026-03-01T11:00:00Z"
					},
					"prompts": [{"id": "prm-1", "text": "Quel outil recommander ?"}],
					"modelIds": ["gpt-4o"],
					"competitors": ["Competitor"]
				},
				"createdAt": "2026-03-01T10:30:00Z",
				"updatedAt": "2026-03-01T11:30:00Z"
			}
		},
		"outboxOrder": ["evt-1"]
	}`)

	if err := store.Save(ctx, payload); err != nil {
		t.Fatalf("save state: %v", err)
	}

	assertProjectTableCount(t, ctx, db, "projects", 1)
	assertProjectTableCount(t, ctx, db, "prompts", 1)
	assertProjectTableCount(t, ctx, db, "prompt_models", 1)
	assertProjectTableCount(t, ctx, db, "prompt_model_schedules", 1)
	assertProjectTableCount(t, ctx, db, "competitors", 1)
	assertProjectTableCount(t, ctx, db, "brand_canon", 1)
	assertProjectTableCount(t, ctx, db, "ai_models", 1)
	assertProjectTableCount(t, ctx, db, "project_models", 1)
	assertProjectTableCount(t, ctx, db, "project_llm_provider_credentials", 1)
	assertProjectTableCount(t, ctx, db, "outbox_events", 1)

	var storedCiphertext string
	if err := db.QueryRow(ctx, `
		SELECT api_key_ciphertext
		FROM project_llm_provider_credentials
		WHERE project_id = $1 AND provider = $2
	`, "prj-1", "openai").Scan(&storedCiphertext); err != nil {
		t.Fatalf("select encrypted provider credential: %v", err)
	}
	if storedCiphertext == "" || strings.Contains(storedCiphertext, "sk-project-openai") {
		t.Fatalf("expected provider credential to be encrypted, got %q", storedCiphertext)
	}

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

	if seq, ok := got["seq"].(float64); !ok || int(seq) != 7 {
		t.Fatalf("expected seq 7, got %#v", got["seq"])
	}
	projects := got["projects"].(map[string]any)
	project := projects["prj-1"].(map[string]any)
	if project["domain"] != "acme.test" {
		t.Fatalf("expected project domain acme.test, got %#v", project["domain"])
	}
	if project["deletedAt"] != "2026-03-02T09:00:00Z" {
		t.Fatalf("expected project deletedAt round-trip, got %#v", project["deletedAt"])
	}
	brandCanonByProject := got["brandCanonByProject"].(map[string]any)
	brandCanon := brandCanonByProject["prj-1"].(map[string]any)
	if brandCanon["brandName"] != "Acme" {
		t.Fatalf("expected brand canon brandName Acme, got %#v", brandCanon["brandName"])
	}
	if brandCanon["positioning"] != "Acme brand" {
		t.Fatalf("expected brand canon positioning Acme brand, got %#v", brandCanon["positioning"])
	}
	if brandCanon["category"] != "SaaS" {
		t.Fatalf("expected brand canon category SaaS, got %#v", brandCanon["category"])
	}
	models := got["models"].(map[string]any)
	model := models["gpt-4o"].(map[string]any)
	if model["groupName"] != "chatgpt" {
		t.Fatalf("expected model group chatgpt, got %#v", model["groupName"])
	}
	credentials := got["providerCredentials"].(map[string]any)
	projectCredentials := credentials["prj-1"].(map[string]any)
	openai := projectCredentials["openai"].(map[string]any)
	if openai["hasApiKey"] != true {
		t.Fatalf("expected openai credential to be configured, got %#v", openai["hasApiKey"])
	}
	if openai["apiKey"] != "sk-project-openai" {
		t.Fatalf("expected decrypted openai credential to be loaded")
	}
	prompts := got["prompts"].(map[string]any)
	prompt := prompts["prm-1"].(map[string]any)
	modelIDs := prompt["modelIds"].([]any)
	if len(modelIDs) != 1 || modelIDs[0] != "gpt-4o" {
		t.Fatalf("expected prompt modelIds [gpt-4o], got %#v", modelIDs)
	}
	schedule := prompt["schedule"].(map[string]any)
	if schedule["mode"] != "per_model" {
		t.Fatalf("expected schedule mode per_model, got %#v", schedule["mode"])
	}
	if schedule["cron"] != "0 */6 * * *" {
		t.Fatalf("expected schedule cron 0 */6 * * *, got %#v", schedule["cron"])
	}
	modelCrons := schedule["modelCrons"].(map[string]any)
	if modelCrons["gpt-4o"] != "15 */2 * * *" {
		t.Fatalf("expected gpt-4o override, got %#v", modelCrons["gpt-4o"])
	}
	storedProviderCredentials := got["providerCredentials"].(map[string]any)
	storedProjectCredentials := storedProviderCredentials["prj-1"].(map[string]any)
	storedOpenAICredential := storedProjectCredentials["openai"].(map[string]any)
	if storedOpenAICredential["hasApiKey"] != true {
		t.Fatalf("expected openai credential to be configured, got %#v", storedOpenAICredential["hasApiKey"])
	}
	outboxOrder := got["outboxOrder"].([]any)
	if len(outboxOrder) != 1 || outboxOrder[0] != "evt-1" {
		t.Fatalf("expected outbox order [evt-1], got %#v", outboxOrder)
	}
}

func TestStateStoreSaveReplacesProviderCredentialRows(t *testing.T) {
	dsn := os.Getenv("PROJECT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PROJECT_TEST_DATABASE_URL is required for integration tests")
	}

	ctx := context.Background()
	testDSN, cleanup := createProjectTestSchema(t, ctx, dsn)
	defer cleanup()

	if err := RunMigrations(testDSN); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	db, err := pgxpool.New(ctx, testDSN)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	defer db.Close()

	store, err := NewStateStore(db, testSecretEncryptionKey)
	if err != nil {
		t.Fatalf("init state store: %v", err)
	}

	payload := []byte(`{
		"seq": 1,
		"projects": {
			"prj-1": {
				"id": "prj-1",
				"organizationId": 42,
				"createdBy": 7,
				"name": "Acme",
				"domain": "acme.test",
				"websiteUrl": "https://acme.test",
				"status": "active",
				"createdAt": "2026-04-21T13:00:00Z",
				"updatedAt": "2026-04-21T13:00:00Z"
			}
		},
		"prompts": {},
		"competitors": {},
		"models": {},
		"projectModels": {},
		"modelSelectionChanges": {},
		"impactIntegrations": {},
		"providerCredentials": {
			"prj-1": {
				"openai": {
					"apiKey": "sk-first",
					"hasApiKey": true,
					"updatedAt": "2026-04-21T13:39:28.53912194Z"
				}
			}
		},
		"outbox": {},
		"outboxOrder": []
	}`)
	if err := store.Save(ctx, payload); err != nil {
		t.Fatalf("first save: %v", err)
	}

	updatedPayload := []byte(`{
		"seq": 2,
		"projects": {
			"prj-1": {
				"id": "prj-1",
				"organizationId": 42,
				"createdBy": 7,
				"name": "Acme",
				"domain": "acme.test",
				"websiteUrl": "https://acme.test",
				"status": "active",
				"createdAt": "2026-04-21T13:00:00Z",
				"updatedAt": "2026-04-21T13:00:00Z"
			}
		},
		"prompts": {},
		"competitors": {},
		"models": {},
		"projectModels": {},
		"modelSelectionChanges": {},
		"impactIntegrations": {},
		"providerCredentials": {
			"prj-1": {
				"openai": {
					"apiKey": "sk-second",
					"hasApiKey": true,
					"updatedAt": "2026-04-21T14:10:00Z"
				}
			}
		},
		"outbox": {},
		"outboxOrder": []
	}`)
	if err := store.Save(ctx, updatedPayload); err != nil {
		t.Fatalf("second save: %v", err)
	}

	loaded, ok, err := store.Load(ctx)
	if err != nil {
		t.Fatalf("load state: %v", err)
	}
	if !ok {
		t.Fatalf("expected state to exist")
	}

	var got map[string]any
	if err := json.Unmarshal(loaded, &got); err != nil {
		t.Fatalf("unmarshal loaded payload: %v", err)
	}
	providerCredentials := got["providerCredentials"].(map[string]any)
	projectCredentials := providerCredentials["prj-1"].(map[string]any)
	openaiCredential := projectCredentials["openai"].(map[string]any)
	if openaiCredential["updatedAt"] != "2026-04-21T14:10:00Z" {
		t.Fatalf("expected updated timestamp, got %#v", openaiCredential["updatedAt"])
	}
	if openaiCredential["apiKey"] != "sk-second" {
		t.Fatalf("expected decrypted updated api key to be loaded")
	}
}

func TestRunMigrationsMigratesLegacyProjectPayload(t *testing.T) {
	dsn := os.Getenv("PROJECT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PROJECT_TEST_DATABASE_URL is required for integration tests")
	}

	ctx := context.Background()
	testDSN, cleanup := createProjectTestSchema(t, ctx, dsn)
	defer cleanup()

	db, err := pgxpool.New(ctx, testDSN)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	defer db.Close()

	legacyPayload := `{
		"seq": 11,
		"projects": {
			"prj-legacy": {
				"id": "prj-legacy",
				"name": "Legacy",
				"domain": "legacy.test",
				"websiteUrl": "https://legacy.test",
				"primaryLanguage": "fr",
				"country": "FR",
				"status": "draft",
				"createdAt": "2026-03-01T10:00:00Z",
				"updatedAt": "2026-03-01T10:00:00Z"
			}
		},
		"prompts": {},
		"competitors": {},
		"models": {},
		"projectModels": {},
		"outbox": {},
		"outboxOrder": []
	}`
	if _, err := db.Exec(ctx, `
		CREATE TABLE project_service_state (
			id SMALLINT PRIMARY KEY,
			payload JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT project_service_state_singleton CHECK (id = 1)
		)
	`); err != nil {
		t.Fatalf("create legacy state table: %v", err)
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO project_service_state (id, payload, updated_at)
		VALUES (1, $1::jsonb, NOW())
	`, legacyPayload); err != nil {
		t.Fatalf("seed legacy state: %v", err)
	}

	if err := RunMigrations(testDSN); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	store, err := NewStateStore(db, testSecretEncryptionKey)
	if err != nil {
		t.Fatalf("init state store: %v", err)
	}
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
	projects := got["projects"].(map[string]any)
	if _, exists := projects["prj-legacy"]; !exists {
		t.Fatalf("expected legacy project to be migrated, got %#v", projects)
	}

	var exists bool
	if err := db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = current_schema()
			  AND table_name = 'project_service_state'
		)
	`).Scan(&exists); err != nil {
		t.Fatalf("check legacy table removal: %v", err)
	}
	if exists {
		t.Fatalf("expected legacy project_service_state table to be dropped")
	}
}

func createProjectTestSchema(t *testing.T, ctx context.Context, baseDSN string) (string, func()) {
	t.Helper()

	baseDB, err := pgxpool.New(ctx, baseDSN)
	if err != nil {
		t.Fatalf("open base db: %v", err)
	}

	schema := fmt.Sprintf("project_state_test_%d", time.Now().UnixNano())
	if _, err := baseDB.Exec(ctx, fmt.Sprintf(`CREATE SCHEMA "%s"`, schema)); err != nil {
		baseDB.Close()
		t.Fatalf("create schema: %v", err)
	}

	testDSN := withSearchPath(t, baseDSN, schema)
	cleanup := func() {
		_, _ = baseDB.Exec(context.Background(), fmt.Sprintf(`DROP SCHEMA IF EXISTS "%s" CASCADE`, schema))
		baseDB.Close()
	}
	return testDSN, cleanup
}

func withSearchPath(t *testing.T, rawDSN, schema string) string {
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

func assertProjectTableCount(t *testing.T, ctx context.Context, db *pgxpool.Pool, table string, want int) {
	t.Helper()

	var got int
	if err := db.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM %s`, table)).Scan(&got); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	if got != want {
		t.Fatalf("expected %d rows in %s, got %d", want, table, got)
	}
}
