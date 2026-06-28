import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
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
  publicID: string;
  name: string;
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
  runType: "manual" | "perception";
  promptKind: "monitoring" | "perception";
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
type SeedContentCrawlRecord = {
  url: string;
  status: string;
  httpStatus: number;
  title: string;
  markdown?: string;
  html?: string;
};

type RuntimeSeedPlan = {
  cleanupProjectIDs: string[];
  projectId: string;
  liveRequestId: string;
  crawlJobId: string;
  discoveryCrawlJobId: string;
  prompts: PromptSeed[];
  perceptionPrompts: PromptSeed[];
  competitors: CompetitorSeed[];
  runs: SeedRun[];
  alerts: SeedAlert[];
};

type IDAllocator = {
  next: (prefix: string) => string;
  current: () => number;
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
const EXPLICIT_PROJECT_ID = process.env.SEED_PROJECT_ID?.trim() ?? "";
const LEGACY_SEED_PROJECT_IDS = ["nike"] as const;
const PROJECT_NAME = process.env.SEED_PROJECT_NAME ?? "Nike";
const PROJECT_DOMAIN = process.env.SEED_PROJECT_DOMAIN ?? "nike.com";
const PROJECT_WEBSITE = process.env.SEED_PROJECT_WEBSITE ?? "https://www.nike.com";
const PROJECT_BRAND_DESCRIPTION =
  "Marque sport globale utilisee comme dataset de demo pour le monitoring IA, les prompts et la perception.";
const SEED_AUTH_ID = process.env.SEED_AUTH_ID?.trim() ?? "";
const SEED_USER_ID = process.env.SEED_USER_ID?.trim() ?? "";
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL?.trim() || "couderbastien";
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
const SEED_LIVE_REQUEST_ID_OVERRIDE = process.env.SEED_LIVE_REQUEST_ID?.trim() ?? "";

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

const PERCEPTION_PROMPTS: PromptSeed[] = [
  {
    id: "seed-perception-positioning",
    text: "Qu'est-ce que Nike et comment décririez-vous son positionnement dans le sportswear et l'équipement sportif ?",
    intent: "brand_positioning",
    topic: "le positionnement de Nike",
    pagePath: "/",
  },
  {
    id: "seed-perception-audience",
    text: "À qui s'adresse Nike, et quels problèmes ou cas d'usage la marque résout-elle ?",
    intent: "audience_use_cases",
    topic: "les audiences et cas d'usage de Nike",
    pagePath: "/membership",
  },
  {
    id: "seed-perception-trust",
    text: "Comment Nike se compare-t-elle à ses concurrents, et quels sont ses forces, faiblesses et signaux de confiance ?",
    intent: "differentiation_trust",
    topic: "la différenciation et la confiance de Nike",
    pagePath: "/running",
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

export function defaultMonthlyQuotaForPlan(plan: BillingPlan): number {
  if (plan === "starter") return 100;
  if (plan === "growth") return 750;
  return 3_000;
}

export function createIDAllocator(startSeq: number): IDAllocator {
  let seq = Math.max(0, Math.trunc(startSeq));
  return {
    next(prefix: string) {
      seq += 1;
      return createScopedID(prefix);
    },
    current() {
      return seq;
    },
  };
}

export function createScopedID(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function isScopedUUIDID(value: string, prefix: string): boolean {
  return new RegExp(`^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, "i").test(
    value.trim(),
  );
}

function dedupeStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildLiveRequestID(projectID: string): string {
  return SEED_LIVE_REQUEST_ID_OVERRIDE || `${projectID}-live-seed`;
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

function pickCompetitorPair(
  runIndex: number,
  promptIndex: number,
  modelIndex: number,
  competitors: readonly CompetitorSeed[],
): [CompetitorSeed, CompetitorSeed] {
  const first = competitors[(runIndex + promptIndex) % competitors.length]!;
  let second = competitors[(runIndex + promptIndex + modelIndex + 1) % competitors.length]!;
  if (second.id === first.id) {
    second = competitors[(runIndex + promptIndex + modelIndex + 2) % competitors.length]!;
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
        : `where lower(email) = lower(${quoteLiteral(SEED_USER_EMAIL)})
             or lower(split_part(email, '@', 1)) = lower(${quoteLiteral(SEED_USER_EMAIL)})
             or lower(email) like lower(${quoteLiteral(`${SEED_USER_EMAIL}%`)})
           order by case when lower(email) = lower(${quoteLiteral(SEED_USER_EMAIL)}) then 0 else 1 end, id asc
           limit 1`;

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
    throw new Error(
      `Aucun utilisateur trouvé dans usersvc pour SEED_USER_EMAIL=${SEED_USER_EMAIL}. ` +
        "Connecte-toi une fois pour provisionner ce profil ou renseigne SEED_USER_ID/SEED_AUTH_ID.",
    );
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
        and owner_user_id = ${user.id}
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
        insert into organizations (public_id, name, owner_user_id, created_at, deleted_at)
        values (
          'org_' || substring(md5(${quoteLiteral(`${ORGANIZATION_NAME}:${user.id}`)}) for 24),
          ${quoteLiteral(ORGANIZATION_NAME)},
          ${user.id},
          ${quoteLiteral(EARLIER)},
          null
        )
        returning id;
      `,
      { quiet: true },
    );
    orgID = Number(inserted.split("\n").map((item) => item.trim()).find(Boolean) ?? "0");
  }

  const publicIDRaw = await psql(
    "orgsvc",
    `
      update organizations
      set name = ${quoteLiteral(ORGANIZATION_NAME)}, owner_user_id = ${user.id}, deleted_at = null
      where id = ${orgID};
      select public_id from organizations where id = ${orgID};
    `,
    { quiet: true },
  );
  const publicID = publicIDRaw.split("\n").map((item) => item.trim()).find(Boolean) ?? "";
  return { id: orgID, publicID, name: ORGANIZATION_NAME };
}

async function findExistingSeedProjectIDs(user: UserRecord, organization: OrganizationSeed): Promise<string[]> {
  const raw = await psql(
    "projectsvc",
    `
      select id
      from projects
      where organization_id = ${organization.id}
        and created_by = ${user.id}
        and website_url = ${quoteLiteral(PROJECT_WEBSITE)}
        and name = ${quoteLiteral(PROJECT_NAME)}
      order by created_at asc, id asc;
    `,
    { quiet: true },
  );

  return raw
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function resolveRuntimeSeedPlan(user: UserRecord, organization: OrganizationSeed): Promise<RuntimeSeedPlan> {
  const existingSeedProjectIDs = await findExistingSeedProjectIDs(user, organization);
  const reusableProjectID = EXPLICIT_PROJECT_ID
    ? ""
    : existingSeedProjectIDs.find((value) => isScopedUUIDID(value, "prj")) ?? "";

  return buildRuntimeSeedPlan({
    projectSeqStart: 0,
    analysisSeqStart: 0,
    explicitProjectID: EXPLICIT_PROJECT_ID,
    reusableProjectID,
    cleanupProjectIDs: dedupeStrings([
      ...LEGACY_SEED_PROJECT_IDS,
      ...existingSeedProjectIDs,
      EXPLICIT_PROJECT_ID,
    ]),
  });
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

async function seedIAModelCatalog() {
  const statements = MODELS.map(
    (model) => `
      insert into ai_models (
        id, provider, display_name, group_name, icon_key, provider_model_id,
        is_active, supports_live_search, credit_cost, created_at, updated_at
      ) values (
        ${quoteLiteral(model.id)}, ${quoteLiteral(model.provider)}, ${quoteLiteral(model.label)},
        ${quoteLiteral(model.group)}, ${quoteLiteral(model.iconKey)}, ${quoteLiteral(model.modelId)},
        true, ${model.supportsLiveSearch ? "true" : "false"}, 1,
        ${quoteLiteral(EARLIER)}, ${quoteLiteral(NOW)}
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
  await psql("iasvc", statements);
}

async function seedPermissions(user: UserRecord, organization: OrganizationSeed, plan: RuntimeSeedPlan) {
  await psql(
    "permsvc",
    `
      delete from project_members
      where project_id = any(${sqlTextArray(plan.cleanupProjectIDs)});

      insert into member_roles (organization_id, user_id, role)
      values (${organization.id}, ${user.id}, 'editor')
      on conflict (organization_id, user_id, role) do nothing;

      insert into project_members (project_id, organization_id, user_id, role)
      values (${quoteLiteral(plan.projectId)}, ${organization.id}, ${user.id}, 'editor')
      on conflict (project_id, organization_id, user_id) do update set role = excluded.role;
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

function buildSeedRuns(projectID: string, prompts: PromptSeed[], competitors: CompetitorSeed[], allocator: IDAllocator): SeedRun[] {
  return RUN_SNAPSHOTS.map((run, runIndex) => {
    const runID = allocator.next("run");
    const createdAt = isoDaysAgo(run.daysAgo, runIndex * 9);
    const promptRuns = prompts.map((prompt, promptIndex) => ({
      id: allocator.next("prun"),
      runId: runID,
      promptId: prompt.id,
      promptText: prompt.text,
      createdAt: isoDaysAgo(run.daysAgo, runIndex * 9 + promptIndex + 1),
    }));

    const responses = promptRuns.flatMap((promptRun, promptIndex) =>
      MODELS.map((model, modelIndex) => {
        const prompt = prompts[promptIndex]!;
        const [firstCompetitor, secondCompetitor] = pickCompetitorPair(runIndex, promptIndex, modelIndex, competitors);
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
          id: allocator.next("resp"),
          runId: runID,
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
      id: runID,
      requestId: `seed:${projectID}:run:${String(runIndex + 1).padStart(2, "0")}`,
      createdAt,
      visibilityScore: run.visibilityScore,
      runType: "manual",
      promptKind: "monitoring",
      promptRuns,
      responses,
    };
  });
}

function buildPerceptionSeedRun(projectID: string, prompts: PromptSeed[], allocator: IDAllocator): SeedRun {
  const runID = allocator.next("run");
  const createdAt = isoDaysAgo(2, 15);
  const promptRuns = prompts.map((prompt, index) => ({
    id: allocator.next("prun"),
    runId: runID,
    promptId: prompt.id,
    promptText: prompt.text,
    createdAt: isoDaysAgo(2, 16 + index),
  }));
  const responseTexts = [
    "Nike est une marque mondiale de sportswear, chaussures et équipement sportif. Son positionnement associe innovation de performance, design iconique, culture sportive et partenariats avec les athlètes.",
    "Nike s'adresse aux athlètes, runners, amateurs de sneakers et consommateurs au mode de vie actif. La marque couvre le running, le basketball, le training, le lifestyle et le membership.",
    "Face à Adidas, ASICS, Puma et New Balance, Nike se différencie par l'innovation de performance, le design iconique, ses partenariats athlètes et son écosystème mondial de membership. Sa puissance de marque est un signal de confiance, malgré une forte pression concurrentielle.",
  ];
  const responses = promptRuns.flatMap((promptRun, promptIndex) =>
    MODELS.map((model, modelIndex) => ({
      id: allocator.next("resp"),
      runId: runID,
      promptRunId: promptRun.id,
      modelId: model.id,
      rawResponse: responseTexts[promptIndex]!,
      brandMentioned: true,
      brandPosition: (modelIndex === 3 ? "mid" : "top") as SeedResponse["brandPosition"],
      citationFound: modelIndex !== 3,
      citedUrls: modelIndex !== 3 ? [buildProjectURL(prompts[promptIndex]!.pagePath)] : [],
      sentiment: "positive" as const,
      createdAt: isoDaysAgo(2, 20 + promptIndex * MODELS.length + modelIndex),
    })),
  );
  return {
    id: runID,
    requestId: `seed:${projectID}:perception`,
    createdAt,
    visibilityScore: 0,
    runType: "perception",
    promptKind: "perception",
    promptRuns,
    responses,
  };
}
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

export function buildRuntimeSeedPlan({
  projectSeqStart,
  analysisSeqStart,
  explicitProjectID,
  reusableProjectID,
  cleanupProjectIDs = [],
}: {
  projectSeqStart: number;
  analysisSeqStart: number;
  explicitProjectID?: string;
  reusableProjectID?: string;
  cleanupProjectIDs?: string[];
}): RuntimeSeedPlan {
  const explicitProject = explicitProjectID?.trim() ?? "";
  const reusableProject = reusableProjectID?.trim() ?? "";
  const reusableScopedProjectID = isScopedUUIDID(reusableProject, "prj") ? reusableProject : "";
  const projectAllocator = createIDAllocator(projectSeqStart);
  const projectId = explicitProject || reusableScopedProjectID || projectAllocator.next("prj");
  const prompts = PROMPTS.map((prompt) => ({
    ...prompt,
    id: projectAllocator.next("prm"),
  }));
  const perceptionPrompts = PERCEPTION_PROMPTS.map((prompt) => ({
    ...prompt,
    id: projectAllocator.next("prm"),
  }));
  const competitors = COMPETITORS.map((competitor) => ({
    ...competitor,
    id: projectAllocator.next("cmp"),
  }));

  const analysisAllocator = createIDAllocator(analysisSeqStart);
  const runs = buildSeedRuns(projectId, prompts, competitors, analysisAllocator);
  runs.push(buildPerceptionSeedRun(projectId, perceptionPrompts, analysisAllocator));
  const alerts = SEED_ALERTS.map((alert) => ({
    ...alert,
    id: analysisAllocator.next("alt"),
  }));

  return {
    cleanupProjectIDs: dedupeStrings([...cleanupProjectIDs, projectId]),
    projectId,
    liveRequestId: buildLiveRequestID(projectId),
    crawlJobId: randomUUID(),
    discoveryCrawlJobId: randomUUID(),
    prompts,
    perceptionPrompts,
    competitors,
    runs,
    alerts,
  };
}

const SEED_CONTENT_CRAWL_RECORDS: SeedContentCrawlRecord[] = [
  {
    url: "https://www.nike.com",
    status: "completed",
    httpStatus: 200,
    title: "Nike. Just Do It.",
    markdown: "# Nike. Just Do It.\n\nNike presents performance footwear, apparel, and equipment for running, basketball, training, lifestyle, and sport culture.\n\n## Content optimizer notes\n\n- Strong global brand signal on the homepage.\n- Add concise internal links to running, basketball, membership, and sustainability pages.",
  },
  {
    url: "https://www.nike.com/running",
    status: "completed",
    httpStatus: 200,
    title: "Nike Running Shoes and Gear",
    markdown: "# Nike Running\n\nDaily trainers, race shoes, trail running, and running apparel are grouped around comfort, speed, durability, and coaching.\n\n## Optimization opportunities\n\n- Add an answer for best Nike shoes for daily running.\n- Compare Pegasus, Vomero, Structure, and Vaporfly by runner profile.",
  },
  {
    url: "https://www.nike.com/basketball",
    status: "completed",
    httpStatus: 200,
    title: "Nike Basketball",
    markdown: "# Nike Basketball\n\nBasketball content highlights signature athletes, performance cushioning, court traction, and lifestyle crossover.\n\n## Optimization opportunities\n\n- Explain which models fit guards, wings, and centers.\n- Clarify differences between signature lines.",
  },
  {
    url: "https://www.nike.com/membership",
    status: "completed",
    httpStatus: 200,
    title: "Nike Membership",
    markdown: "# Nike Membership\n\nMembership combines product access, experiences, apps, rewards, and personalized services.\n\n## Optimization opportunities\n\n- Make benefits explicit in one scannable section.\n- Connect app experiences to shopping, training, and community outcomes.",
  },
  {
    url: "https://www.nike.com/archive/spring-collection",
    status: "errored",
    httpStatus: 503,
    title: "Archived campaign unavailable",
    html: "<html><body><h1>503 Service Unavailable</h1><p>Seed crawl error example.</p></body></html>",
  },
];

async function resetProjectRelationalData(plan: RuntimeSeedPlan) {
  const projectIDs = sqlTextArray(plan.cleanupProjectIDs);
  await psql(
    "projectsvc",
    `
      delete from outbox_events
      where payload -> 'project' ->> 'id' = any(${projectIDs})
         or payload ->> 'projectId' = any(${projectIDs});

      delete from projects
      where id = any(${projectIDs});
    `,
  );
}

async function seedProjectRelational(user: UserRecord, organization: OrganizationSeed, plan: RuntimeSeedPlan) {
  const allPrompts = [...plan.prompts, ...plan.perceptionPrompts];
  const promptStatements = allPrompts.map(
    (prompt) => `
      insert into prompts (id, project_id, text, intent, language, country, is_active, status, schedule_mode, schedule_cron, schedule_timezone, kind, created_at, updated_at)
      values (
        ${quoteLiteral(prompt.id)},
        ${quoteLiteral(plan.projectId)},
        ${quoteLiteral(prompt.text)},
        ${quoteLiteral(prompt.intent)},
        'fr',
        'FR',
        true,
        'active',
        'global',
        '0 */6 * * *',
        'UTC',
        ${quoteLiteral(plan.perceptionPrompts.some((item) => item.id === prompt.id) ? "perception" : "monitoring")},
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (id) do update set
        project_id = excluded.project_id,
        text = excluded.text,
        intent = excluded.intent,
        is_active = excluded.is_active,
        status = excluded.status,
        schedule_mode = excluded.schedule_mode,
        schedule_cron = excluded.schedule_cron,
        schedule_timezone = excluded.schedule_timezone,
        kind = excluded.kind,
        updated_at = excluded.updated_at;
    `,
  ).join("\n");

  const competitorStatements = plan.competitors.map(
    (competitor) => `
      insert into competitors (id, project_id, name, domain, website_url, is_active, created_at, updated_at)
      values (
        ${quoteLiteral(competitor.id)},
        ${quoteLiteral(plan.projectId)},
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
        ${quoteLiteral(plan.projectId)},
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

  const promptModelStatements = allPrompts.flatMap((prompt) =>
    MODELS.map(
      (model) => `
        insert into prompt_models (prompt_id, model_id, created_at, updated_at)
        values (
          ${quoteLiteral(prompt.id)},
          ${quoteLiteral(model.id)},
          ${quoteLiteral(EARLIER)},
          ${quoteLiteral(NOW)}
        )
        on conflict (prompt_id, model_id) do update set
          updated_at = excluded.updated_at;
      `,
    ),
  ).join("\n");

  await psql(
    "projectsvc",
    `
      insert into projects (
        id,
        organization_id,
        created_by,
        name,
        domain,
        website_url,
        attribution_source,
        primary_language,
        country,
        created_at,
        updated_at
      )
      values (
        ${quoteLiteral(plan.projectId)},
        ${organization.id},
        ${user.id},
        ${quoteLiteral(PROJECT_NAME)},
        ${quoteLiteral(PROJECT_DOMAIN)},
        ${quoteLiteral(PROJECT_WEBSITE)},
        'ga4_seed_demo',
        'fr',
        'FR',
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (id) do update set
        organization_id = excluded.organization_id,
        created_by = excluded.created_by,
        name = excluded.name,
        domain = excluded.domain,
        website_url = excluded.website_url,
        attribution_source = excluded.attribution_source,
        primary_language = excluded.primary_language,
        country = excluded.country,
        updated_at = excluded.updated_at;

      insert into brand_canon (
        project_id, brand_name, category, positioning, audience, use_cases, features, created_at, updated_at
      ) values (
        ${quoteLiteral(plan.projectId)},
        'Nike',
        'Sportswear, chaussures et equipement sportif',
        ${quoteLiteral(PROJECT_BRAND_DESCRIPTION)},
        '["Athletes", "Runners", "Sneaker enthusiasts", "Active lifestyle consumers"]'::jsonb,
        '["Running", "Basketball", "Training", "Lifestyle", "Membership"]'::jsonb,
        '["Performance innovation", "Iconic design", "Athlete partnerships", "Global membership ecosystem"]'::jsonb,
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (project_id) do update set
        brand_name = excluded.brand_name,
        category = excluded.category,
        positioning = excluded.positioning,
        audience = excluded.audience,
        use_cases = excluded.use_cases,
        features = excluded.features,
        updated_at = excluded.updated_at;

      insert into project_model_selection_changes (project_id, usage_month, change_count, created_at, updated_at)
      values (${quoteLiteral(plan.projectId)}, to_char(now(), 'YYYY-MM'), 0, ${quoteLiteral(EARLIER)}, ${quoteLiteral(NOW)})
      on conflict (project_id, usage_month) do update set change_count = 0, updated_at = excluded.updated_at;

      insert into project_impact_integrations (
        project_id, ga4_property_id, ga4_connected_at, ga4_updated_at, created_at, updated_at
      ) values (
        ${quoteLiteral(plan.projectId)}, 'seed_nike_demo', ${quoteLiteral(EARLIER)}, ${quoteLiteral(NOW)},
        ${quoteLiteral(EARLIER)}, ${quoteLiteral(NOW)}
      )
      on conflict (project_id) do update set
        ga4_property_id = excluded.ga4_property_id,
        ga4_service_account_ciphertext = null,
        ga4_oauth_refresh_token_ciphertext = null,
        ga4_connected_at = excluded.ga4_connected_at,
        ga4_updated_at = excluded.ga4_updated_at,
        updated_at = excluded.updated_at;

      ${promptStatements}
      ${competitorStatements}
      ${projectModelStatements}
      ${promptModelStatements}
    `,
  );
}

async function seedAnalysisRelational(user: UserRecord, organization: OrganizationSeed, plan: RuntimeSeedPlan) {
  const runStatements = plan.runs.map((run) => `
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
      credits_count,
      created_at,
      updated_at
    )
    values (
      ${quoteLiteral(run.id)},
      ${quoteLiteral(plan.projectId)},
      ${organization.id},
      ${user.id},
      ${quoteLiteral(run.requestId)},
      ${quoteLiteral(run.runType)},
      'completed',
      ${run.promptRuns.length},
      ${MODELS.length},
      ${run.responses.length},
      ${run.responses.length},
      ${run.visibilityScore},
      ${run.responses.length},
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
      credits_count = excluded.credits_count,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  `).join("\n");

  const promptRunStatements = plan.runs.flatMap((run) =>
    run.promptRuns.map((promptRun) => `
      insert into prompt_runs (id, run_id, prompt_id, prompt_text, kind, created_at)
      values (
        ${quoteLiteral(promptRun.id)},
        ${quoteLiteral(promptRun.runId)},
        ${quoteLiteral(promptRun.promptId)},
        ${quoteLiteral(promptRun.promptText)},
        ${quoteLiteral(run.promptKind)},
        ${quoteLiteral(promptRun.createdAt)}
      )
      on conflict (id) do update set
        run_id = excluded.run_id,
        prompt_id = excluded.prompt_id,
        prompt_text = excluded.prompt_text,
        kind = excluded.kind,
        created_at = excluded.created_at;
    `),
  ).join("\n");

  const responseStatements = plan.runs.flatMap((run) =>
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

  await psql(
    "analysissvc",
    `
      ${runStatements}
      ${promptRunStatements}
      ${responseStatements}

      insert into project_ai_brief_settings (
        project_id, brief_model_id, brief_provider, brief_provider_model_id, created_at, updated_at
      ) values (
        ${quoteLiteral(plan.projectId)},
        ${quoteLiteral(MODELS[0].id)},
        'openrouter',
        ${quoteLiteral(MODELS[0].modelId)},
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (project_id) do update set
        brief_model_id = excluded.brief_model_id,
        brief_provider = excluded.brief_provider,
        brief_provider_model_id = excluded.brief_provider_model_id,
        updated_at = excluded.updated_at;

      insert into optimize_actions (
        id, project_id, priority, type, title, issue, impact,
        generated_content, status, metadata, created_at, updated_at
      ) values
      (
        ${quoteLiteral(`opt_${plan.projectId.slice(4)}`)}, ${quoteLiteral(plan.projectId)}, 'high', 'content',
        'Renforcer la page running',
        'Les reponses IA citent Nike sans toujours pointer vers une page produit precise.',
        'Ameliorer les citations et la conversion sur les requetes running.',
        'Ajouter un comparatif structure des gammes running, des usages et des technologies avec des liens directs.',
        'draft', '{"source":"nike-seed","page":"/running"}'::jsonb,
        ${quoteLiteral(EARLIER)}, ${quoteLiteral(NOW)}
      )
      on conflict (id) do update set
        project_id = excluded.project_id,
        priority = excluded.priority,
        type = excluded.type,
        title = excluded.title,
        issue = excluded.issue,
        impact = excluded.impact,
        generated_content = excluded.generated_content,
        status = excluded.status,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at;
    `,
  );
}

async function seedContentOptimizerCrawl(organization: OrganizationSeed, plan: RuntimeSeedPlan) {
  const completedRecords = SEED_CONTENT_CRAWL_RECORDS.filter((record) => record.status === "completed").length;
  const failedRecords = SEED_CONTENT_CRAWL_RECORDS.length - completedRecords;
  const pageStatements = SEED_CONTENT_CRAWL_RECORDS.map((record, index) => `
    insert into crawler_pages (
      run_id, normalized_url, title, position, status, http_status,
      markdown, markdown_chars, attempts, completed_at
    ) values (
      ${quoteLiteral(plan.crawlJobId)}::uuid,
      ${quoteLiteral(record.url)},
      ${quoteLiteral(record.title)},
      ${index + 1},
      ${quoteLiteral(record.status)},
      ${record.httpStatus},
      ${record.markdown ? quoteLiteral(record.markdown) : "NULL"},
      ${record.markdown?.length ?? 0},
      1,
      ${quoteLiteral(NOW)}
    );
  `).join("\n");
  const discoveryPageStatements = SEED_CONTENT_CRAWL_RECORDS.filter((record) => record.status === "completed").map((record, index) => `
    insert into crawler_pages (
      run_id, normalized_url, source_url, title, position, status, http_status,
      quality_score, quality_status, quality_notes, attempts, completed_at
    ) values (
      ${quoteLiteral(plan.discoveryCrawlJobId)}::uuid,
      ${quoteLiteral(record.url)}, ${quoteLiteral(PROJECT_WEBSITE)}, ${quoteLiteral(record.title)},
      ${index + 1}, 'completed', ${record.httpStatus}, ${88 - index * 6},
      ${quoteLiteral(index < 2 ? "good" : "needs_improvement")},
      ${quoteLiteral(index < 2 ? "Page structurée et découvrable." : "Renforcer les liens internes et les réponses directes.")},
      1, ${quoteLiteral(NOW)}
    );
  `).join("\n");

  await psql(
    "analysissvc",
    `
      insert into crawler_runs (
        id, project_id, organization_id, kind, status, root_url,
        page_limit, depth_limit, total_pages, completed_pages, failed_pages,
        created_at, updated_at, started_at, finished_at
      )
      values (
        ${quoteLiteral(plan.crawlJobId)}::uuid,
        ${quoteLiteral(plan.projectId)},
        ${organization.id},
        'markdown',
        ${quoteLiteral(failedRecords > 0 ? "partially_completed" : "completed")},
        'https://www.nike.com',
        ${SEED_CONTENT_CRAWL_RECORDS.length},
        1,
        ${SEED_CONTENT_CRAWL_RECORDS.length},
        ${completedRecords},
        ${failedRecords},
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)},
        ${quoteLiteral(EARLIER)},
        ${quoteLiteral(NOW)}
      )
      on conflict (id) do nothing;

      ${pageStatements}

      insert into crawler_runs (
        id, project_id, organization_id, kind, status, root_url,
        page_limit, depth_limit, include_urls, total_pages, completed_pages, failed_pages,
        created_at, updated_at, started_at, finished_at
      ) values (
        ${quoteLiteral(plan.discoveryCrawlJobId)}::uuid,
        ${quoteLiteral(plan.projectId)}, ${organization.id}, 'discovery', 'completed', ${quoteLiteral(PROJECT_WEBSITE)},
        25, 2, '["/running","/basketball","/membership"]'::jsonb,
        ${completedRecords}, ${completedRecords}, 0,
        ${quoteLiteral(EARLIER)}, ${quoteLiteral(NOW)}, ${quoteLiteral(EARLIER)}, ${quoteLiteral(NOW)}
      )
      on conflict (id) do nothing;

      ${discoveryPageStatements}
    `,
  );

  console.log(`  content optimizer pages=${SEED_CONTENT_CRAWL_RECORDS.length} completed=${completedRecords}`);
}

async function resetAnalysisDataForProjects(projectIDs: readonly string[]) {
  const projectIDArray = sqlTextArray(projectIDs);
  await psql(
    "analysissvc",
    `
      delete from crawler_runs
      where project_id = any(${projectIDArray});

      delete from optimize_actions
      where project_id = any(${projectIDArray});

      delete from project_ai_brief_settings
      where project_id = any(${projectIDArray});

      delete from analysis_runs
      where project_id = any(${projectIDArray});
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

async function seedAnalysisLive(user: UserRecord, organization: OrganizationSeed, plan: RuntimeSeedPlan): Promise<LiveSeedResult> {
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
    `${SEED_ANALYSIS_BASE_URL.replace(/\/$/, "")}/analysis/projects/${plan.projectId}/analyze`,
    {
      requestId: plan.liveRequestId,
      promptTexts: plan.prompts.map((prompt) => ({ id: prompt.id, text: prompt.text })),
      modelIds: MODELS.map((model) => model.id),
      runType: "manual",
    },
    analysisToken,
  );

  const promptRunsByPromptId = new Map(startResult.promptRuns.map((item) => [item.promptId, item]));
  let responsesRecorded = 0;

  for (const prompt of plan.prompts) {
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
          competitors: plan.competitors.map((competitor) => competitor.name),
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
  console.log(`SEED_PROJECT_ID=${EXPLICIT_PROJECT_ID || "<auto>"}`);
  console.log(`SEED_USER_EMAIL=${SEED_USER_EMAIL}`);
  console.log(`SEED_ANALYSIS_MODE=${SEED_ANALYSIS_MODE}`);

  if (SEED_ANALYSIS_MODE === "live") {
    await ensureIAServiceProviderMode();
  }

  logStep("Resolve seed user from usersvc");
  const user = await getSeedUser();
  console.log(`  user.id=${user.id} authIdentityID=${user.authIdentityID} email=${user.email}`);

  logStep("Create or update organization seed in orgsvc");
  const organization = await ensureOrganization(user);
  console.log(`  organization.id=${organization.id} public_id=${organization.publicID}`);

  logStep("Resolve coherent runtime ids for the seed");
  const seedPlan = await resolveRuntimeSeedPlan(user, organization);
  console.log(`  project.id=${seedPlan.projectId} cleanup=${seedPlan.cleanupProjectIDs.join(", ")}`);

  logStep("Create or update billing subscription seed in billsvc");
  await seedBillingSubscription(organization);

  logStep("Create or update model catalog seed in iasvc");
  await seedIAModelCatalog();

  logStep("Reset existing project seed in projectsvc");
  await resetProjectRelationalData(seedPlan);

  logStep("Create clean relational project seed in projectsvc");
  await seedProjectRelational(user, organization, seedPlan);

  logStep("Create organization and project memberships in permsvc");
  await seedPermissions(user, organization, seedPlan);

  logStep("Reset existing analysis seed in analysissvc");
  await resetAnalysisDataForProjects(seedPlan.cleanupProjectIDs);

  logStep("Create clean monitoring and perception history in analysissvc");
  await seedAnalysisRelational(user, organization, seedPlan);

  let liveResult: LiveSeedResult | null = null;
  if (SEED_ANALYSIS_MODE === "live") {
    logStep("Create additional live OpenRouter monitoring run");
    liveResult = await seedAnalysisLive(user, organization, seedPlan);
  }

  logStep("Create content optimizer crawl seed in analysissvc");
  await seedContentOptimizerCrawl(organization, seedPlan);

  console.log("\nSeed terminé.");
  console.log(`- organization: ${ORGANIZATION_NAME} (#${organization.id})`);
  console.log(`- organization public id: ${organization.publicID}`);
  console.log(`- billing: ${SEED_BILLING_PLAN} / ${SEED_BILLING_SEATS} seat(s) / ${SEED_BILLING_MONTHLY_QUOTA} quota`);
  console.log(`- projectId: ${seedPlan.projectId}`);
  console.log(`- seeded prompts: ${seedPlan.prompts.length}`);
  console.log(`- seeded perception prompts: ${seedPlan.perceptionPrompts.length}`);
  console.log(`- seeded competitors: ${seedPlan.competitors.length}`);
  console.log(`- seeded content optimizer pages: ${SEED_CONTENT_CRAWL_RECORDS.length}`);
  if (SEED_ANALYSIS_MODE === "live" && liveResult) {
    console.log(`- live run id: ${liveResult.runId}`);
    console.log(`- live responses recorded: ${liveResult.responsesRecorded}`);
  }
  console.log(`- seeded historical runs: ${seedPlan.runs.length}`);
  console.log(`- seeded historical responses: ${seedPlan.runs.reduce((total, run) => total + run.responses.length, 0)}`);
  console.log("- traffic: seeded attribution demo (ChatGPT, Perplexity, Gemini, Claude, Copilot, etc.)");
  console.log(`- owner auth identity: ${user.authIdentityID}`);
  console.log(`- dashboard: /dashboard?projectId=${seedPlan.projectId}`);
  console.log(`- prompts: /prompts?projectId=${seedPlan.projectId}`);
  console.log(`- perception: /perception?projectId=${seedPlan.projectId}`);
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
