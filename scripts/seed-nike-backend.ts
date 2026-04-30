import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type UserRecord = {
  id: number;
  authIdentityID: string;
  email: string;
  firstName: string;
  lastName: string;
};

type OrganizationSeed = {
  id: number;
  name: string;
  teamID: number;
};

type BillingPlan = "starter" | "growth" | "pro";
export type SeedAnalysisMode = "synthetic" | "live";

type PromptSeed = {
  id: string;
  text: string;
  intent: string;
  topic: string;
  pagePath: string;
};
type CompetitorSeed = {
  id: string;
  name: string;
  domain: string;
  websiteUrl: string;
};
type RunSnapshot = {
  id: string;
  requestId: string;
  daysAgo: number;
  visibilityScore: number;
  nikeMentionRate: number;
  citationRate: number;
  theme: string;
};
type SeedPromptRun = {
  id: string;
  runId: string;
  promptId: string;
  promptText: string;
  createdAt: string;
};
type SeedResponse = {
  id: string;
  runId: string;
  promptRunId: string;
  modelId: string;
  rawResponse: string;
  brandMentioned: boolean;
  brandPosition: "top" | "mid" | "low" | "unknown";
  citationFound: boolean;
  citedUrls: string[];
  sentiment: "positive" | "neutral" | "negative";
  createdAt: string;
};
type SeedRun = {
  id: string;
  requestId: string;
  createdAt: string;
  visibilityScore: number;
  promptRuns: SeedPromptRun[];
  responses: SeedResponse[];
};
type SeedAlert = {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  createdAt: string;
};

type SuccessEnvelope<T> = {
  success: boolean;
  data: T;
};

type StartAnalysisResponse = {
  analysisRun: {
    id: string;
  };
  promptRuns: Array<{
    id: string;
    promptId: string;
    promptText: string;
  }>;
};

type IAExecuteResponse = {
  rawResponse: string;
  modelId: string;
  analysis: {
    brandMentioned: boolean;
    brandPosition: string;
    citationFound: boolean;
    citedUrls: string[];
    sentiment: string;
  };
};

type LiveSeedResult = {
  runId: string;
  responsesRecorded: number;
};

const COMPOSE_PROJECT_NAME = process.env.SEED_COMPOSE_PROJECT_NAME?.trim() || "microservices-go-prod";
const COMPOSE_FILES = parseComposeFiles(process.env.SEED_COMPOSE_FILES);
const COMPOSE_ARGS = ["compose", "-p", COMPOSE_PROJECT_NAME, ...COMPOSE_FILES.flatMap((file) => ["-f", file])];
const POSTGRES_EXEC = [...COMPOSE_ARGS, "exec", "-T", "postgres"];

const ORGANIZATION_NAME = process.env.SEED_ORG_NAME ?? "Nike";
const TEAM_NAME = process.env.SEED_TEAM_NAME ?? "Global Digital Marketing";
const PROJECT_ID = process.env.SEED_PROJECT_ID ?? "nike";
const PROJECT_NAME = process.env.SEED_PROJECT_NAME ?? "Nike";
const PROJECT_DOMAIN = process.env.SEED_PROJECT_DOMAIN ?? "nike.com";
const PROJECT_WEBSITE = process.env.SEED_PROJECT_WEBSITE ?? "https://www.nike.com";
const SEED_AUTH_ID = process.env.SEED_AUTH_ID?.trim() ?? "";
const SEED_USER_ID = process.env.SEED_USER_ID?.trim() ?? "";
const SEED_BILLING_PLAN = readBillingPlan(process.env.SEED_BILLING_PLAN);
const SEED_BILLING_SEATS = readPositiveIntEnv(process.env.SEED_BILLING_SEATS, 1);
const SEED_BILLING_MONTHLY_QUOTA = readPositiveIntEnv(
  process.env.SEED_BILLING_MONTHLY_QUOTA,
  defaultMonthlyQuotaForPlan(SEED_BILLING_PLAN),
);
const SEED_ANALYSIS_MODE = readAnalysisMode(process.env.SEED_ANALYSIS_MODE);
const SEED_ANALYSIS_BASE_URL = process.env.SEED_ANALYSIS_BASE_URL?.trim() || "http://localhost:50009";
const SEED_IA_BASE_URL = process.env.SEED_IA_BASE_URL?.trim() || "http://localhost:50011";
const SEED_HTTP_TIMEOUT_MS = readPositiveIntEnv(process.env.SEED_HTTP_TIMEOUT_MS, 120_000);
const SEED_INTERNAL_JWT_SECRET_FILE = process.env.SEED_INTERNAL_JWT_SECRET_FILE?.trim() || "deployments/secrets/internal_jwt_secret.txt";
const SEED_OPENROUTER_API_KEY_FILE = process.env.SEED_OPENROUTER_API_KEY_FILE?.trim() || "deployments/secrets/openrouter_api_key.txt";
const SEED_INTERNAL_JWT_ISSUER = process.env.SEED_INTERNAL_JWT_ISSUER?.trim() || "api-gateway";
const SEED_INTERNAL_JWT_SUBJECT = process.env.SEED_INTERNAL_JWT_SUBJECT?.trim() || "seed-nike-backend";
const SEED_LIVE_REQUEST_ID = process.env.SEED_LIVE_REQUEST_ID?.trim() || `${PROJECT_ID}-live-seed`;

const NOW = new Date().toISOString();
const EARLIER = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

const PROMPTS: PromptSeed[] = [
  {
    id: "seed-prompt-running",
    text: "Quelles marques dominent actuellement les recommandations IA pour les chaussures de running quotidiennes ?",
    intent: "comparison",
    topic: "les chaussures de running quotidiennes",
    pagePath: "/running",
  },
  {
    id: "seed-prompt-basketball",
    text: "Quelle marque est la plus souvent citee pour l'innovation basket performance et lifestyle ?",
    intent: "comparison",
    topic: "l'innovation basket performance et lifestyle",
    pagePath: "/basketball",
  },
  {
    id: "seed-prompt-sustainability",
    text: "Quelles marques de sport sont les plus credibles sur la durabilite et les materiaux responsables ?",
    intent: "awareness",
    topic: "la durabilite dans le sportswear",
    pagePath: "/sustainability",
  },
  {
    id: "seed-prompt-membership",
    text: "Quelle marque offre la meilleure experience de membership et de fidelisation dans le retail sport ?",
    intent: "consideration",
    topic: "les programmes de membership et de fidelisation",
    pagePath: "/membership",
  },
  {
    id: "seed-prompt-women",
    text: "Quelles marques ressortent le plus pour l'entrainement femme et les collections polyvalentes ?",
    intent: "comparison",
    topic: "l'entrainement femme et les collections polyvalentes",
    pagePath: "/women",
  },
  {
    id: "seed-prompt-sneakers",
    text: "Quelle marque est la plus recommandee pour des sneakers lifestyle iconiques en 2026 ?",
    intent: "commercial",
    topic: "les sneakers lifestyle iconiques",
    pagePath: "/air-max-dn8",
  },
];

const COMPETITORS: CompetitorSeed[] = [
  {
    id: "seed-comp-adidas",
    name: "Adidas",
    domain: "adidas.com",
    websiteUrl: "https://www.adidas.com",
  },
  {
    id: "seed-comp-puma",
    name: "Puma",
    domain: "puma.com",
    websiteUrl: "https://www.puma.com",
  },
  {
    id: "seed-comp-new-balance",
    name: "New Balance",
    domain: "newbalance.com",
    websiteUrl: "https://www.newbalance.com",
  },
  {
    id: "seed-comp-asics",
    name: "ASICS",
    domain: "asics.com",
    websiteUrl: "https://www.asics.com",
  },
  {
    id: "seed-comp-under-armour",
    name: "Under Armour",
    domain: "underarmour.com",
    websiteUrl: "https://www.underarmour.com",
  },
  {
    id: "seed-comp-lululemon",
    name: "lululemon",
    domain: "lululemon.com",
    websiteUrl: "https://shop.lululemon.com",
  },
];

const CITED_PAGE_PATHS = ["/", "/running", "/basketball", "/women", "/membership", "/sustainability", "/contact", "/air-max-dn8"] as const;
const RUN_SNAPSHOTS: RunSnapshot[] = [
  { id: "seed-run-01", requestId: "nike-seed-request-01", daysAgo: 2, visibilityScore: 84, nikeMentionRate: 9, citationRate: 9, theme: "l'innovation produit" },
  { id: "seed-run-02", requestId: "nike-seed-request-02", daysAgo: 5, visibilityScore: 82, nikeMentionRate: 8, citationRate: 8, theme: "la traction en search" },
  { id: "seed-run-03", requestId: "nike-seed-request-03", daysAgo: 9, visibilityScore: 79, nikeMentionRate: 8, citationRate: 8, theme: "la notoriete globale" },
  { id: "seed-run-04", requestId: "nike-seed-request-04", daysAgo: 14, visibilityScore: 76, nikeMentionRate: 7, citationRate: 7, theme: "les contenus performance" },
  { id: "seed-run-05", requestId: "nike-seed-request-05", daysAgo: 21, visibilityScore: 73, nikeMentionRate: 7, citationRate: 7, theme: "les pages category" },
  { id: "seed-run-06", requestId: "nike-seed-request-06", daysAgo: 30, visibilityScore: 70, nikeMentionRate: 6, citationRate: 6, theme: "la couverture e-commerce" },
  { id: "seed-run-07", requestId: "nike-seed-request-07", daysAgo: 45, visibilityScore: 67, nikeMentionRate: 6, citationRate: 5, theme: "le mix brand et performance" },
  { id: "seed-run-08", requestId: "nike-seed-request-08", daysAgo: 63, visibilityScore: 64, nikeMentionRate: 5, citationRate: 5, theme: "la couverture lifestyle" },
  { id: "seed-run-09", requestId: "nike-seed-request-09", daysAgo: 92, visibilityScore: 61, nikeMentionRate: 5, citationRate: 4, theme: "la base de citation historique" },
];

function logStep(message: string) {
  console.log(`- ${message}`);
}

function parseComposeFiles(rawValue: string | undefined): string[] {
  const files = rawValue
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (files && files.length > 0) {
    return files;
  }
  return ["docker-compose.yml"];
}

function readBillingPlan(rawPlan: string | undefined): BillingPlan {
  const plan = rawPlan?.trim().toLowerCase() ?? "pro";
  if (plan === "starter" || plan === "growth" || plan === "pro") {
    return plan;
  }
  throw new Error(`SEED_BILLING_PLAN invalide: ${rawPlan}`);
}

export function readAnalysisMode(rawMode: string | undefined): SeedAnalysisMode {
  const mode = rawMode?.trim().toLowerCase() ?? "synthetic";
  if (mode === "synthetic" || mode === "live") {
    return mode;
  }
  throw new Error(`SEED_ANALYSIS_MODE invalide: ${rawMode}`);
}

function readPositiveIntEnv(rawValue: string | undefined, fallback: number): number {
  if (!rawValue?.trim()) {
    return fallback;
  }
  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Valeur numerique invalide: ${rawValue}`);
  }
  return parsedValue;
}

function defaultMonthlyQuotaForPlan(plan: BillingPlan): number {
  if (plan === "starter") return 50;
  if (plan === "growth") return 200;
  return 1_000_000;
}

function isoDaysAgo(daysAgo: number, minuteOffset = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(9, minuteOffset, 0, 0);
  return date.toISOString();
}

function buildProjectURL(path: string): string {
  const baseURL = PROJECT_WEBSITE.replace(/\/$/, "");
  return path === "/" ? baseURL : `${baseURL}${path}`;
}

function pickCompetitorPair(runIndex: number, promptIndex: number, modelIndex: number): [CompetitorSeed, CompetitorSeed] {
  const first = COMPETITORS[(runIndex + promptIndex) % COMPETITORS.length]!;
  let second = COMPETITORS[(runIndex + promptIndex + modelIndex + 1) % COMPETITORS.length]!;
  if (second.id === first.id) {
    second = COMPETITORS[(runIndex + promptIndex + modelIndex + 2) % COMPETITORS.length]!;
  }
  return [first, second];
}

function buildResponseText(
  prompt: PromptSeed,
  run: RunSnapshot,
  brandMentioned: boolean,
  citationFound: boolean,
  citationPath: string,
  brandPosition: SeedResponse["brandPosition"],
  sentiment: SeedResponse["sentiment"],
  competitorNames: [string, string],
): string {
  const [firstCompetitor, secondCompetitor] = competitorNames;
  if (!brandMentioned) {
    return `${firstCompetitor} et ${secondCompetitor} sont plus souvent recommandes pour ${prompt.topic}, surtout quand les reponses IA insistent sur ${run.theme}.`;
  }

  if (sentiment === "negative") {
    return `Nike reste citee sur ${prompt.topic}, mais ${firstCompetitor} et ${secondCompetitor} prennent plus souvent l'avantage sur cette vague, avec un positionnement plutot ${brandPosition}.`;
  }

  if (sentiment === "neutral") {
    return `Nike reste presente face a ${firstCompetitor} et ${secondCompetitor} sur ${prompt.topic}, avec une dynamique plus partagee autour de ${run.theme}.`;
  }

  if (citationFound) {
    return `Nike revient devant ${firstCompetitor} et ${secondCompetitor} pour ${prompt.topic}. Les reponses citent regulierement ${citationPath} pour appuyer ${run.theme}.`;
  }

  return `Nike est bien positionnee face a ${firstCompetitor} et ${secondCompetitor} sur ${prompt.topic}, avec une presence stable portee par ${run.theme}.`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function readSecretFile(filePath: string, label: string): string {
  const resolvedPath = path.resolve(filePath);
  const value = readFileSync(resolvedPath, "utf8").trim();
  if (value === "") {
    throw new Error(`${label} vide dans ${resolvedPath}`);
  }
  return value;
}

function looksLikePlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized.includes("change-me") || normalized.includes("xxxxxxxx");
}

function base64url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function signInternalJWT({
  secret,
  issuer,
  audience,
  subject,
  organizationId = 0,
  userId = 0,
  ttlSeconds = 300,
}: {
  secret: string;
  issuer: string;
  audience: string;
  subject: string;
  organizationId?: number;
  userId?: number;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: Record<string, number | string> = {
    iss: issuer,
    sub: subject,
    aud: audience,
    iat: now,
    exp: now + ttlSeconds,
  };

  if (organizationId > 0) {
    payload.organization_id = organizationId;
  }
  if (userId > 0) {
    payload.user_id = userId;
  }

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(unsignedToken).digest("base64url");

  return `${unsignedToken}.${signature}`;
}

async function runDocker(args: string[], stdin?: string, envOverrides?: Record<string, string>): Promise<string> {
  try {
    const output = execFileSync("docker", args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...envOverrides,
      },
      input: stdin,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String((error as { stderr?: string }).stderr ?? "") : "";
    const stdout = error instanceof Error && "stdout" in error ? String((error as { stdout?: string }).stdout ?? "") : "";
    throw new Error(stderr.trim() || stdout.trim() || `docker command failed: ${args.join(" ")}`);
  }
}

async function postJSON<TResponse>(url: string, body: unknown, token: string): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEED_HTTP_TIMEOUT_MS),
  });

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = raw === "" ? null : JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  if (!response.ok) {
    const message =
      typeof parsed === "object" && parsed !== null && "error" in parsed && typeof (parsed as { error?: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : raw || `${response.status} ${response.statusText}`;
    throw new Error(`HTTP ${response.status} ${url}: ${message}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("success" in parsed) ||
    !("data" in parsed) ||
    (parsed as { success?: unknown }).success !== true
  ) {
    throw new Error(`Réponse inattendue depuis ${url}`);
  }

  return (parsed as SuccessEnvelope<TResponse>).data;
}

async function waitForReady(serviceName: string, baseURL: string): Promise<void> {
  let lastError = "";
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const response = await fetch(`${baseURL.replace(/\/$/, "")}/ready`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${serviceName} n'est pas prêt: ${lastError}`);
}

async function psql(database: string, sql: string, opts?: { quiet?: boolean }): Promise<string> {
  const baseArgs = [...POSTGRES_EXEC, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"];
  const args = opts?.quiet ? [...baseArgs, "-t", "-A"] : baseArgs;
  return runDocker(args, sql);
}

async function getSeedUser(): Promise<UserRecord> {
  const where =
    SEED_USER_ID !== ""
      ? `where id = ${Number.parseInt(SEED_USER_ID, 10) || 0}`
      : SEED_AUTH_ID !== ""
        ? `where auth_identity_id = ${quoteLiteral(SEED_AUTH_ID)}`
        : "order by id asc limit 1";

  const raw = await psql(
    "usersvc",
    `
      select id || '|' || auth_identity_id || '|' || email || '|' || first_name || '|' || last_name
      from users
      ${where};
    `,
    { quiet: true },
  );

  const line = raw.split("\n").map((item) => item.trim()).find(Boolean);
  if (!line) {
    throw new Error("Aucun utilisateur trouvé dans usersvc. Connecte-toi une fois pour provisionner un profil.");
  }

  const [id, authIdentityID, email, firstName, lastName] = line.split("|");
  return {
    id: Number(id),
    authIdentityID,
    email,
    firstName,
    lastName,
  };
}

async function ensureOrganization(user: UserRecord): Promise<OrganizationSeed> {
  const existing = await psql(
    "orgsvc",
    `
      select id
      from organizations
      where name = ${quoteLiteral(ORGANIZATION_NAME)}
        and deleted_at is null
      order by id asc
      limit 1;
    `,
    { quiet: true },
  );

  let orgID = Number(existing.split("\n").map((item) => item.trim()).find(Boolean) ?? "0");
  if (!orgID) {
    const inserted = await psql(
      "orgsvc",
      `
        insert into organizations (name, owner_user_id, created_at, deleted_at)
        values (${quoteLiteral(ORGANIZATION_NAME)}, ${user.id}, ${quoteLiteral(EARLIER)}, null)
        returning id;
      `,
      { quiet: true },
    );
    orgID = Number(inserted.split("\n").map((item) => item.trim()).find(Boolean) ?? "0");
  }

  await psql(
    "orgsvc",
    `
      insert into organization_members (organization_id, user_id, team_id, added_at, deleted_at)
      values (${orgID}, ${user.id}, null, ${quoteLiteral(EARLIER)}, null)
      on conflict (organization_id, user_id) do update set
        deleted_at = null;

      insert into member_roles (organization_id, user_id, role)
      values (${orgID}, ${user.id}, 'owner')
      on conflict do nothing;
    `,
  );

  const existingTeam = await psql(
    "orgsvc",
    `
      select id
      from teams
      where organization_id = ${orgID}
        and name = ${quoteLiteral(TEAM_NAME)}
        and deleted_at is null
      order by id asc
      limit 1;
    `,
    { quiet: true },
  );

  let teamID = Number(existingTeam.split("\n").map((item) => item.trim()).find(Boolean) ?? "0");
  if (!teamID) {
    const insertedTeam = await psql(
      "orgsvc",
      `
        insert into teams (organization_id, name, created_at, deleted_at)
        values (${orgID}, ${quoteLiteral(TEAM_NAME)}, ${quoteLiteral(EARLIER)}, null)
        returning id;
      `,
      { quiet: true },
    );
    teamID = Number(insertedTeam.split("\n").map((item) => item.trim()).find(Boolean) ?? "0");
  }

  await psql(
    "orgsvc",
    `
      update organization_members
      set team_id = ${teamID}, deleted_at = null
      where organization_id = ${orgID}
        and user_id = ${user.id};
    `,
  );

  return { id: orgID, name: ORGANIZATION_NAME, teamID };
}

async function seedBillingSubscription(organization: OrganizationSeed) {
  await psql(
    "billsvc",
    `
      insert into billing_subscriptions (
        organization_id,
        plan,
        seats,
        monthly_quota,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        billing_cycle,
        status,
        cancel_at_period_end,
        current_period_end,
        correction_credits,
        updated_at
      )
      values (
        ${organization.id},
        ${quoteLiteral(SEED_BILLING_PLAN)},
        ${SEED_BILLING_SEATS},
        ${SEED_BILLING_MONTHLY_QUOTA},
        '',
        '',
        '',
        'monthly',
        'active',
        false,
        null,
        0,
        ${quoteLiteral(NOW)}
      )
      on conflict (organization_id) do update set
        plan = excluded.plan,
        seats = excluded.seats,
        monthly_quota = excluded.monthly_quota,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_price_id = excluded.stripe_price_id,
        billing_cycle = excluded.billing_cycle,
        status = excluded.status,
        cancel_at_period_end = excluded.cancel_at_period_end,
        current_period_end = excluded.current_period_end,
        correction_credits = excluded.correction_credits,
        updated_at = excluded.updated_at;
    `,
  );
}

async function loadJSONState<T extends object>(database: string, table: string): Promise<T> {
  const raw = await psql(
    database,
    `select coalesce(payload::text, '{}') from ${table} where id = 1;`,
    { quiet: true },
  );
  const line = raw.split("\n").map((item) => item.trim()).find(Boolean) ?? "{}";
  return JSON.parse(line) as T;
}

async function saveJSONState(database: string, table: string, state: object) {
  const payload = JSON.stringify(state).replaceAll("'", "''");
  await psql(
    database,
    `
      insert into ${table} (id, payload, updated_at)
      values (1, '${payload}'::jsonb, now())
      on conflict (id) do update set
        payload = excluded.payload,
        updated_at = excluded.updated_at;
    `,
  );
}

export const MODELS = [
  {
    id: "gpt-oss-20b-free",
    label: "gpt-oss-20b (free)",
    provider: "openai",
    group: "gpt-oss",
    iconKey: "openai",
    modelId: "openai/gpt-oss-20b:free",
    supportsLiveSearch: false,
  },
  {
    id: "gpt-oss-120b-free",
    label: "gpt-oss-120b (free)",
    provider: "openai",
    group: "gpt-oss",
    iconKey: "openai",
    modelId: "openai/gpt-oss-120b:free",
    supportsLiveSearch: false,
  },
  {
    id: "gemma-3-4b-free",
    label: "Gemma 3 4B (free)",
    provider: "google",
    group: "gemma",
    iconKey: "google",
    modelId: "google/gemma-3-4b-it:free",
    supportsLiveSearch: false,
  },
  {
    id: "gemma-3-27b-free",
    label: "Gemma 3 27B (free)",
    provider: "google",
    group: "gemma",
    iconKey: "google",
    modelId: "google/gemma-3-27b-it:free",
    supportsLiveSearch: false,
  },
] as const;

function sqlTextArray(values: readonly string[]): string {
  if (values.length === 0) {
    return "array[]::text[]";
  }
  return `array[${values.map((value) => quoteLiteral(value)).join(", ")}]`;
}

function buildSeedRuns(): SeedRun[] {
  return RUN_SNAPSHOTS.map((run, runIndex) => {
    const createdAt = isoDaysAgo(run.daysAgo, runIndex * 9);
    const promptRuns = PROMPTS.map((prompt, promptIndex) => ({
      id: `seed-prun-${runIndex + 1}-${promptIndex + 1}`,
      runId: run.id,
      promptId: prompt.id,
      promptText: prompt.text,
      createdAt: isoDaysAgo(run.daysAgo, runIndex * 9 + promptIndex + 1),
    }));

    const responses = promptRuns.flatMap((promptRun, promptIndex) =>
      MODELS.map((model, modelIndex) => {
        const prompt = PROMPTS[promptIndex]!;
        const [firstCompetitor, secondCompetitor] = pickCompetitorPair(runIndex, promptIndex, modelIndex);
        const competitorNames = [firstCompetitor.name, secondCompetitor.name];
        const competitorPressure =
          competitorNames.includes("Puma")
            ? 2
            : competitorNames.some((name) => name === "Adidas" || name === "ASICS")
              ? 1
              : 0;
        const mentionScore = (runIndex * 5 + promptIndex * 3 + modelIndex * 2) % 10;
        const brandMentioned = mentionScore < run.nikeMentionRate;
        const citationScore = (runIndex * 7 + promptIndex * 2 + modelIndex) % 10;
        const citationThreshold = Math.max(1, run.citationRate - competitorPressure - (runIndex < 2 ? 1 : 0));
        const citationFound = brandMentioned && citationScore < citationThreshold;
        const brandPosition = !brandMentioned
          ? "unknown"
          : mentionScore <= Math.max(1, run.nikeMentionRate - 4)
            ? "top"
            : mentionScore <= Math.max(2, run.nikeMentionRate - 2)
              ? "mid"
              : "low";
        const sentimentScore = (runIndex * 11 + promptIndex * 5 + modelIndex * 3 + competitorPressure * 2) % 10;
        let sentiment: SeedResponse["sentiment"];
        if (!brandMentioned) {
          sentiment = sentimentScore < 5 ? "negative" : "neutral";
        } else if (citationFound && brandPosition === "top" && sentimentScore < Math.max(3, 7 - competitorPressure * 2)) {
          sentiment = "positive";
        } else if (sentimentScore >= 8 - competitorPressure) {
          sentiment = "negative";
        } else if (sentimentScore >= 4) {
          sentiment = "neutral";
        } else {
          sentiment = "positive";
        }
        if (brandPosition === "top" && sentiment === "negative") {
          sentiment = "neutral";
        }
        const citationPath = citationFound
          ? prompt.pagePath
          : CITED_PAGE_PATHS[(runIndex + promptIndex + modelIndex) % CITED_PAGE_PATHS.length]!;
        const citedUrls = citationFound
          ? Array.from(
              new Set(
                [buildProjectURL(prompt.pagePath), buildProjectURL(citationPath)].filter((value) => value !== ""),
              ),
            )
          : [];
        return {
          id: `seed-resp-${runIndex + 1}-${promptIndex + 1}-${modelIndex + 1}`,
          runId: run.id,
          promptRunId: promptRun.id,
          modelId: model.id,
          rawResponse: buildResponseText(
            prompt,
            run,
            brandMentioned,
            citationFound,
            citationPath,
            brandPosition,
            sentiment,
            [firstCompetitor.name, secondCompetitor.name],
          ),
          brandMentioned,
          brandPosition,
          citationFound,
          citedUrls,
          sentiment,
          createdAt: isoDaysAgo(run.daysAgo, runIndex * 9 + promptIndex * MODELS.length + modelIndex + 2),
        };
      }),
    );

    return {
      id: run.id,
      requestId: run.requestId,
      createdAt,
      visibilityScore: run.visibilityScore,
      promptRuns,
      responses,
    };
  });
}

const SEED_RUNS = buildSeedRuns();
const SEED_ALERTS: SeedAlert[] = [
  {
    id: "seed-alert-01",
    alertType: "visibility_drop",
    severity: "medium",
    title: "Adidas regagne de la place sur les requetes running",
    description: "La fenetre historique montre une periode ou Adidas a pris plus de part de voix sur les requetes running avant le rebond de Nike.",
    createdAt: isoDaysAgo(31, 20),
  },
  {
    id: "seed-alert-02",
    alertType: "citation_drop",
    severity: "low",
    title: "Les citations de /membership ont fluctue",
    description: "Les reponses IA citaient moins la page /membership il y a quelques semaines, ce qui permet de tester les variations de pages citees.",
    createdAt: isoDaysAgo(21, 25),
  },
  {
    id: "seed-alert-03",
    alertType: "visibility_drop",
    severity: "high",
    title: "ASICS a perce sur les prompts performance",
    description: "Le seed injecte une phase ou ASICS ressort davantage sur les sujets performance pour alimenter la carte d'activite.",
    createdAt: isoDaysAgo(45, 30),
  },
  {
    id: "seed-alert-04",
    alertType: "citation_drop",
    severity: "medium",
    title: "Reprise des citations Nike sur /running",
    description: "Les periodes recentes montrent un retour progressif des citations Nike sur /running et /air-max-dn8.",
    createdAt: isoDaysAgo(5, 35),
  },
];

async function resetProjectRelationalData() {
  const managedModelIDs = MODELS.map((model) => model.id);
  await psql(
    "projectsvc",
    `
      delete from outbox_events
      where payload -> 'project' ->> 'id' = ${quoteLiteral(PROJECT_ID)}
         or payload ->> 'projectId' = ${quoteLiteral(PROJECT_ID)};

      delete from projects
      where id = ${quoteLiteral(PROJECT_ID)};

      update ai_models
      set is_active = id = any(${sqlTextArray(managedModelIDs)}),
          updated_at = ${quoteLiteral(NOW)}
      where is_active is distinct from (id = any(${sqlTextArray(managedModelIDs)}));
    `,
  );
}

async function seedProjectRelational(user: UserRecord, organization: OrganizationSeed) {
  const modelStatements = MODELS.map(
    (model) => `
      insert into ai_models (id, provider, display_name, group_name, icon_key, provider_model_id, is_active, supports_live_search, created_at, updated_at)
      values (
        ${quoteLiteral(model.id)},
        ${quoteLiteral(model.provider)},
        ${quoteLiteral(model.label)},
        ${quoteLiteral(model.group)},
        ${quoteLiteral(model.iconKey)},
        ${quoteLiteral(model.modelId)},
        true,
        ${model.supportsLiveSearch ? "true" : "false"},
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (id) do update set
        provider = excluded.provider,
        display_name = excluded.display_name,
        group_name = excluded.group_name,
        icon_key = excluded.icon_key,
        provider_model_id = excluded.provider_model_id,
        is_active = excluded.is_active,
        supports_live_search = excluded.supports_live_search,
        updated_at = excluded.updated_at;
    `,
  ).join("\n");

  const promptStatements = PROMPTS.map(
    (prompt) => `
      insert into prompts (id, project_id, text, intent, language, country, is_active, created_at, updated_at)
      values (
        ${quoteLiteral(prompt.id)},
        ${quoteLiteral(PROJECT_ID)},
        ${quoteLiteral(prompt.text)},
        ${quoteLiteral(prompt.intent)},
        'fr',
        'FR',
        true,
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (id) do update set
        project_id = excluded.project_id,
        text = excluded.text,
        intent = excluded.intent,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at;
    `,
  ).join("\n");

  const competitorStatements = COMPETITORS.map(
    (competitor) => `
      insert into competitors (id, project_id, name, domain, website_url, is_active, created_at, updated_at)
      values (
        ${quoteLiteral(competitor.id)},
        ${quoteLiteral(PROJECT_ID)},
        ${quoteLiteral(competitor.name)},
        ${quoteLiteral(competitor.domain)},
        ${quoteLiteral(competitor.websiteUrl)},
        true,
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (id) do update set
        project_id = excluded.project_id,
        name = excluded.name,
        domain = excluded.domain,
        website_url = excluded.website_url,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at;
    `,
  ).join("\n");

  const projectModelStatements = MODELS.map(
    (model) => `
      insert into project_models (project_id, model_id, is_enabled, created_at, updated_at)
      values (
        ${quoteLiteral(PROJECT_ID)},
        ${quoteLiteral(model.id)},
        true,
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (project_id, model_id) do update set
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at;
    `,
  ).join("\n");

  await psql(
    "projectsvc",
    `
      insert into project_service_meta (id, seq, updated_at)
      values (1, 100, ${quoteLiteral(NOW)})
      on conflict (id) do update set
        seq = greatest(project_service_meta.seq, excluded.seq),
        updated_at = excluded.updated_at;

      ${modelStatements}

      insert into projects (
        id,
        organization_id,
        created_by,
        name,
        domain,
        website_url,
        brand_name,
        brand_description,
        industry,
        primary_language,
        country,
        status,
        created_at,
        updated_at
      )
      values (
        ${quoteLiteral(PROJECT_ID)},
        ${organization.id},
        ${user.id},
        ${quoteLiteral(PROJECT_NAME)},
        ${quoteLiteral(PROJECT_DOMAIN)},
        ${quoteLiteral(PROJECT_WEBSITE)},
        ${quoteLiteral(PROJECT_NAME)},
        ${quoteLiteral("Marque sport globale utilisee comme dataset de demo pour le monitoring IA, les prompts et la perception.")},
        ${quoteLiteral("Sportswear / footwear")},
        'fr',
        'FR',
        'active',
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (id) do update set
        organization_id = excluded.organization_id,
        created_by = excluded.created_by,
        name = excluded.name,
        domain = excluded.domain,
        website_url = excluded.website_url,
        brand_name = excluded.brand_name,
        brand_description = excluded.brand_description,
        industry = excluded.industry,
        primary_language = excluded.primary_language,
        country = excluded.country,
        status = excluded.status,
        updated_at = excluded.updated_at;

      ${promptStatements}
      ${competitorStatements}
      ${projectModelStatements}
    `,
  );
}

async function seedAnalysisRelational(user: UserRecord, organization: OrganizationSeed) {
  const runStatements = SEED_RUNS.map((run) => `
    insert into analysis_runs (
      id,
      project_id,
      organization_id,
      created_by,
      request_id,
      run_type,
      status,
      prompts_count,
      models_count,
      expected_responses,
      completed_responses,
      visibility_score,
      created_at,
      updated_at
    )
    values (
      ${quoteLiteral(run.id)},
      ${quoteLiteral(PROJECT_ID)},
      ${organization.id},
      ${user.id},
      ${quoteLiteral(run.requestId)},
      'manual',
      'completed',
      ${PROMPTS.length},
      ${MODELS.length},
      ${run.responses.length},
      ${run.responses.length},
      ${run.visibilityScore},
      ${quoteLiteral(run.createdAt)},
      ${quoteLiteral(run.createdAt)}
    )
    on conflict (id) do update set
      project_id = excluded.project_id,
      organization_id = excluded.organization_id,
      created_by = excluded.created_by,
      request_id = excluded.request_id,
      run_type = excluded.run_type,
      status = excluded.status,
      prompts_count = excluded.prompts_count,
      models_count = excluded.models_count,
      expected_responses = excluded.expected_responses,
      completed_responses = excluded.completed_responses,
      visibility_score = excluded.visibility_score,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  `).join("\n");

  const promptRunStatements = SEED_RUNS.flatMap((run) =>
    run.promptRuns.map((promptRun) => `
      insert into prompt_runs (id, run_id, prompt_id, prompt_text, created_at)
      values (
        ${quoteLiteral(promptRun.id)},
        ${quoteLiteral(promptRun.runId)},
        ${quoteLiteral(promptRun.promptId)},
        ${quoteLiteral(promptRun.promptText)},
        ${quoteLiteral(promptRun.createdAt)}
      )
      on conflict (id) do update set
        run_id = excluded.run_id,
        prompt_id = excluded.prompt_id,
        prompt_text = excluded.prompt_text,
        created_at = excluded.created_at;
    `),
  ).join("\n");

  const responseStatements = SEED_RUNS.flatMap((run) =>
    run.responses.map((response) => {
      const citedURLs = JSON.stringify(response.citedUrls).replaceAll("'", "''");
      return `
        insert into ai_responses (
          id,
          run_id,
          prompt_run_id,
          model_id,
          raw_response,
          brand_mentioned,
          brand_position,
          citation_found,
          cited_urls,
          sentiment,
          created_at
        )
        values (
          ${quoteLiteral(response.id)},
          ${quoteLiteral(response.runId)},
          ${quoteLiteral(response.promptRunId)},
          ${quoteLiteral(response.modelId)},
          ${quoteLiteral(response.rawResponse)},
          ${response.brandMentioned ? "true" : "false"},
          ${quoteLiteral(response.brandPosition)},
          ${response.citationFound ? "true" : "false"},
          '${citedURLs}'::jsonb,
          ${quoteLiteral(response.sentiment)},
          ${quoteLiteral(response.createdAt)}
        )
        on conflict (id) do update set
          run_id = excluded.run_id,
          prompt_run_id = excluded.prompt_run_id,
          model_id = excluded.model_id,
          raw_response = excluded.raw_response,
          brand_mentioned = excluded.brand_mentioned,
          brand_position = excluded.brand_position,
          citation_found = excluded.citation_found,
          cited_urls = excluded.cited_urls,
          sentiment = excluded.sentiment,
          created_at = excluded.created_at;
      `;
    }),
  ).join("\n");

  const alertStatements = SEED_ALERTS.map((alert) => `
    insert into alerts (
      id,
      project_id,
      alert_type,
      severity,
      title,
      description,
      is_read,
      created_at,
      updated_at
    )
    values (
      ${quoteLiteral(alert.id)},
      ${quoteLiteral(PROJECT_ID)},
      ${quoteLiteral(alert.alertType)},
      ${quoteLiteral(alert.severity)},
      ${quoteLiteral(alert.title)},
      ${quoteLiteral(alert.description)},
      false,
      ${quoteLiteral(alert.createdAt)},
      ${quoteLiteral(alert.createdAt)}
    )
    on conflict (id) do update set
      project_id = excluded.project_id,
      alert_type = excluded.alert_type,
      severity = excluded.severity,
      title = excluded.title,
      description = excluded.description,
      is_read = excluded.is_read,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  `).join("\n");

  await psql(
    "analysissvc",
    `
      insert into analysis_service_meta (id, seq, updated_at)
      values (1, 100, ${quoteLiteral(NOW)})
      on conflict (id) do update set
        seq = greatest(analysis_service_meta.seq, excluded.seq),
        updated_at = excluded.updated_at;

      ${runStatements}
      ${promptRunStatements}
      ${responseStatements}
      ${alertStatements}
    `,
  );
}

async function resetAnalysisDataForProject() {
  await psql(
    "analysissvc",
    `
      delete from brand_canon
      where project_id = ${quoteLiteral(PROJECT_ID)};

      delete from alerts
      where project_id = ${quoteLiteral(PROJECT_ID)};

      delete from analysis_runs
      where project_id = ${quoteLiteral(PROJECT_ID)};
    `,
  );
}

async function ensureIAServiceProviderMode() {
  const apiKey = readSecretFile(SEED_OPENROUTER_API_KEY_FILE, "OpenRouter API key");
  if (looksLikePlaceholderSecret(apiKey)) {
    throw new Error(
      `La clé OpenRouter dans ${path.resolve(SEED_OPENROUTER_API_KEY_FILE)} est encore un placeholder. Remplace-la avant un seed live.`,
    );
  }

  logStep("Ensure ia-service runs in provider mode");
  await runDocker(
    [...COMPOSE_ARGS, "--profile", "backend", "up", "-d", "--build", "ia-service"],
    undefined,
    { IA_EXECUTION_MODE: "provider" },
  );
  await waitForReady("ia-service", SEED_IA_BASE_URL);
}

async function seedAnalysisLive(user: UserRecord, organization: OrganizationSeed): Promise<LiveSeedResult> {
  await waitForReady("analysis-service", SEED_ANALYSIS_BASE_URL);
  await waitForReady("ia-service", SEED_IA_BASE_URL);

  const jwtSecret = readSecretFile(SEED_INTERNAL_JWT_SECRET_FILE, "Internal JWT secret");
  const analysisToken = signInternalJWT({
    secret: jwtSecret,
    issuer: SEED_INTERNAL_JWT_ISSUER,
    audience: "analysis-service",
    subject: SEED_INTERNAL_JWT_SUBJECT,
    organizationId: organization.id,
    userId: user.id,
  });
  const iaToken = signInternalJWT({
    secret: jwtSecret,
    issuer: SEED_INTERNAL_JWT_ISSUER,
    audience: "ia-service",
    subject: SEED_INTERNAL_JWT_SUBJECT,
    organizationId: organization.id,
    userId: user.id,
  });

  const startResult = await postJSON<StartAnalysisResponse>(
    `${SEED_ANALYSIS_BASE_URL.replace(/\/$/, "")}/analysis/projects/${PROJECT_ID}/analyze`,
    {
      requestId: SEED_LIVE_REQUEST_ID,
      promptTexts: PROMPTS.map((prompt) => ({ id: prompt.id, text: prompt.text })),
      modelIds: MODELS.map((model) => model.id),
      runType: "manual",
    },
    analysisToken,
  );

  const promptRunsByPromptId = new Map(startResult.promptRuns.map((item) => [item.promptId, item]));
  let responsesRecorded = 0;

  for (const prompt of PROMPTS) {
    const promptRun = promptRunsByPromptId.get(prompt.id);
    if (!promptRun) {
      throw new Error(`Prompt run manquant pour ${prompt.id}`);
    }

    for (const model of MODELS) {
      const iaResult = await postJSON<IAExecuteResponse>(
        `${SEED_IA_BASE_URL.replace(/\/$/, "")}/ai/execute`,
        {
          promptId: prompt.id,
          promptText: prompt.text,
          modelId: model.id,
          brandName: PROJECT_NAME,
          competitors: COMPETITORS.map((competitor) => competitor.name),
        },
        iaToken,
      );

      await postJSON<{ recorded: boolean }>(
        `${SEED_ANALYSIS_BASE_URL.replace(/\/$/, "")}/analysis/runs/${startResult.analysisRun.id}/responses`,
        {
          promptRunId: promptRun.id,
          modelId: model.id,
          rawResponse: iaResult.rawResponse,
          brandMentioned: iaResult.analysis?.brandMentioned ?? false,
          brandPosition: iaResult.analysis?.brandPosition ?? "unknown",
          citationFound: iaResult.analysis?.citationFound ?? false,
          citedUrls: iaResult.analysis?.citedUrls ?? [],
          sentiment: iaResult.analysis?.sentiment ?? "neutral",
        },
        analysisToken,
      );

      responsesRecorded += 1;
    }
  }

  return {
    runId: startResult.analysisRun.id,
    responsesRecorded,
  };
}

async function main() {
  console.log("Backend seed (organization + project + analysis)");
  console.log(`SEED_COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}`);
  console.log(`SEED_COMPOSE_FILES=${COMPOSE_FILES.join(",")}`);
  console.log(`SEED_ORG_NAME=${ORGANIZATION_NAME}`);
  console.log(`SEED_PROJECT_ID=${PROJECT_ID}`);
  console.log(`SEED_ANALYSIS_MODE=${SEED_ANALYSIS_MODE}`);

  if (SEED_ANALYSIS_MODE === "live") {
    await ensureIAServiceProviderMode();
  }

  logStep("Resolve seed user from usersvc");
  const user = await getSeedUser();
  console.log(`  user.id=${user.id} authIdentityID=${user.authIdentityID} email=${user.email}`);

  logStep("Create or update organization seed in orgsvc");
  const organization = await ensureOrganization(user);
  console.log(`  organization.id=${organization.id} team.id=${organization.teamID}`);

  logStep("Create or update billing subscription seed in billsvc");
  await seedBillingSubscription(organization);

  logStep("Reset existing project seed in projectsvc");
  await resetProjectRelationalData();

  logStep("Create clean relational project seed in projectsvc");
  await seedProjectRelational(user, organization);

  logStep("Reset existing analysis seed in analysissvc");
  await resetAnalysisDataForProject();

  let liveResult: LiveSeedResult | null = null;
  if (SEED_ANALYSIS_MODE === "live") {
    logStep("Create live OpenRouter analysis run");
    liveResult = await seedAnalysisLive(user, organization);
  } else {
    logStep("Create clean relational analysis seed in analysissvc");
    await seedAnalysisRelational(user, organization);
  }

  console.log("\nSeed terminé.");
  console.log(`- organization: ${ORGANIZATION_NAME} (#${organization.id})`);
  console.log(`- team: ${TEAM_NAME} (#${organization.teamID})`);
  console.log(`- billing: ${SEED_BILLING_PLAN} / ${SEED_BILLING_SEATS} seat(s) / ${SEED_BILLING_MONTHLY_QUOTA} quota`);
  console.log(`- projectId: ${PROJECT_ID}`);
  console.log(`- seeded prompts: ${PROMPTS.length}`);
  console.log(`- seeded competitors: ${COMPETITORS.length}`);
  if (SEED_ANALYSIS_MODE === "live" && liveResult) {
    console.log(`- live run id: ${liveResult.runId}`);
    console.log(`- live responses recorded: ${liveResult.responsesRecorded}`);
  } else {
    console.log(`- seeded runs: ${SEED_RUNS.length}`);
    console.log(`- seeded responses: ${SEED_RUNS.reduce((total, run) => total + run.responses.length, 0)}`);
  }
  console.log(`- owner auth identity: ${user.authIdentityID}`);
  console.log(`- dashboard: /dashboard?projectId=${PROJECT_ID}`);
  console.log(`- prompts: /prompts?projectId=${PROJECT_ID}`);
  console.log(`- perception: /perception?projectId=${PROJECT_ID}`);
}

const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] ? path.resolve(process.argv[1]) === currentFilePath : false;

if (isMainModule) {
  main().catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}
