import { execFileSync } from "node:child_process";

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

type ProjectState = {
  seq?: number;
  projects?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  competitors?: Record<string, unknown>;
  models?: Record<string, unknown>;
  projectModels?: Record<string, Record<string, boolean>>;
  outbox?: Record<string, unknown>;
  outboxOrder?: string[];
};

type AnalysisState = {
  seq?: number;
  runs?: Record<string, unknown>;
  runsByProject?: Record<string, string[]>;
  promptRuns?: Record<string, unknown>;
  promptRunsByRun?: Record<string, string[]>;
  responses?: Record<string, unknown>;
  responsesByRun?: Record<string, string[]>;
  responseIndexByRun?: Record<string, Record<string, string>>;
  runByRequest?: Record<string, string>;
  alerts?: Record<string, unknown>;
  alertsByProject?: Record<string, string[]>;
};

const COMPOSE_ARGS = ["compose", "-p", "microservices-go-prod", "-f", "docker-compose.yml"];
const POSTGRES_EXEC = [...COMPOSE_ARGS, "exec", "-T", "postgres"];

const ORGANIZATION_NAME = process.env.SEED_ORG_NAME ?? "Seed Demo Organization";
const TEAM_NAME = process.env.SEED_TEAM_NAME ?? "Core Team";
const PROJECT_ID = process.env.SEED_PROJECT_ID ?? "seed-demo-project";
const PROJECT_NAME = process.env.SEED_PROJECT_NAME ?? "Seed Demo Project";
const PROJECT_DOMAIN = process.env.SEED_PROJECT_DOMAIN ?? "seed-demo.local";
const PROJECT_WEBSITE = process.env.SEED_PROJECT_WEBSITE ?? "https://seed-demo.local";
const SEED_AUTH_ID = process.env.SEED_AUTH_ID?.trim() ?? "";
const SEED_USER_ID = process.env.SEED_USER_ID?.trim() ?? "";

const NOW = new Date().toISOString();
const EARLIER = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

const PROMPTS = [
  {
    id: "seed-prompt-01",
    text: "Quelle solution recommander pour centraliser des analytics marketing B2B ?",
    intent: "commercial",
  },
  {
    id: "seed-prompt-02",
    text: "Quels outils concurrencent le mieux une plateforme de visibilité IA pour les équipes growth ?",
    intent: "comparison",
  },
  {
    id: "seed-prompt-03",
    text: "Comment améliorer la présence d'une marque dans les réponses générées par les IA ?",
    intent: "awareness",
  },
] as const;

const COMPETITORS = [
  {
    id: "seed-comp-01",
    name: "HubSpot",
    domain: "hubspot.com",
    websiteUrl: "https://www.hubspot.com",
  },
  {
    id: "seed-comp-02",
    name: "Semrush",
    domain: "semrush.com",
    websiteUrl: "https://www.semrush.com",
  },
] as const;

const RESPONSES = [
  {
    promptRunID: "seed-prun-01",
    modelID: "gpt-4o",
    rawResponse:
      "Seed Demo Project est pertinent pour centraliser des analytics marketing et améliorer la visibilité IA des équipes growth.",
    brandMentioned: true,
    brandPosition: "top",
    citationFound: true,
    citedUrls: [PROJECT_WEBSITE],
    sentiment: "positive",
  },
  {
    promptRunID: "seed-prun-01",
    modelID: "sonar",
    rawResponse:
      "La solution Seed Demo Project ressort comme un bon candidat, avec un focus sur la mesure et l'analyse des réponses IA.",
    brandMentioned: true,
    brandPosition: "top",
    citationFound: true,
    citedUrls: [PROJECT_WEBSITE],
    sentiment: "positive",
  },
  {
    promptRunID: "seed-prun-02",
    modelID: "gpt-4o",
    rawResponse:
      "Parmi les concurrents visibles, HubSpot et Semrush restent présents, mais Seed Demo Project se différencie sur l'analyse des réponses IA.",
    brandMentioned: true,
    brandPosition: "mid",
    citationFound: false,
    citedUrls: [],
    sentiment: "neutral",
  },
  {
    promptRunID: "seed-prun-02",
    modelID: "gemini-2.0-flash",
    rawResponse:
      "Les équipes growth peuvent comparer Seed Demo Project à HubSpot ou Semrush selon leur besoin de visibilité IA.",
    brandMentioned: true,
    brandPosition: "mid",
    citationFound: true,
    citedUrls: [PROJECT_WEBSITE],
    sentiment: "neutral",
  },
  {
    promptRunID: "seed-prun-03",
    modelID: "gpt-4o-mini",
    rawResponse:
      "Pour améliorer la présence dans les réponses IA, il faut structurer les contenus, clarifier le positionnement et suivre les prompts stratégiques.",
    brandMentioned: false,
    brandPosition: "unknown",
    citationFound: false,
    citedUrls: [],
    sentiment: "neutral",
  },
  {
    promptRunID: "seed-prun-03",
    modelID: "sonar",
    rawResponse:
      "Seed Demo Project peut aider à suivre les prompts et les citations nécessaires pour augmenter la présence dans les réponses générées.",
    brandMentioned: true,
    brandPosition: "top",
    citationFound: true,
    citedUrls: [PROJECT_WEBSITE],
    sentiment: "positive",
  },
] as const;

function logStep(message: string) {
  console.log(`- ${message}`);
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function runDocker(args: string[], stdin?: string): Promise<string> {
  try {
    const output = execFileSync("docker", args, {
      cwd: process.cwd(),
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

function ensureArrayUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function seedProjectState(user: UserRecord, state: ProjectState): ProjectState {
  const nextState: ProjectState = {
    seq: state.seq ?? 0,
    projects: { ...(state.projects ?? {}) },
    prompts: { ...(state.prompts ?? {}) },
    competitors: { ...(state.competitors ?? {}) },
    models: { ...(state.models ?? {}) },
    projectModels: { ...(state.projectModels ?? {}) },
    outbox: { ...(state.outbox ?? {}) },
    outboxOrder: [...(state.outboxOrder ?? [])],
  };

  if (Object.keys(nextState.models ?? {}).length === 0) {
    nextState.models = {
      "gpt-4o-mini": {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        label: "GPT-4o Mini",
        provider: "openai",
        modelId: "gpt-4o-mini",
        isActive: true,
      },
      "gpt-4o": {
        id: "gpt-4o",
        name: "gpt-4o",
        label: "GPT-4o",
        provider: "openai",
        modelId: "gpt-4o",
        isActive: true,
      },
      "gemini-2.0-flash": {
        id: "gemini-2.0-flash",
        name: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        provider: "google",
        modelId: "gemini-2.0-flash",
        isActive: true,
      },
      sonar: {
        id: "sonar",
        name: "sonar",
        label: "Perplexity Sonar",
        provider: "perplexity",
        modelId: "sonar",
        isActive: true,
        supportsLiveSearch: true,
      },
    };
  }

  nextState.projects![PROJECT_ID] = {
    id: PROJECT_ID,
    userId: user.authIdentityID,
    name: PROJECT_NAME,
    domain: PROJECT_DOMAIN,
    websiteUrl: PROJECT_WEBSITE,
    brandName: PROJECT_NAME,
    brandDescription: "Projet seed pour dashboard, prompts et perception.",
    industry: "SaaS / AI analytics",
    primaryLanguage: "fr",
    country: "FR",
    status: "active",
    createdAt: EARLIER,
    updatedAt: NOW,
  };

  for (const prompt of PROMPTS) {
    nextState.prompts![prompt.id] = {
      id: prompt.id,
      projectId: PROJECT_ID,
      text: prompt.text,
      intent: prompt.intent,
      isActive: true,
      createdAt: EARLIER,
      updatedAt: NOW,
    };
  }

  for (const competitor of COMPETITORS) {
    nextState.competitors![competitor.id] = {
      id: competitor.id,
      projectId: PROJECT_ID,
      name: competitor.name,
      domain: competitor.domain,
      websiteUrl: competitor.websiteUrl,
      isActive: true,
      createdAt: EARLIER,
      updatedAt: NOW,
    };
  }

  const enabledModelIDs = Object.keys(nextState.models ?? {});
  nextState.projectModels![PROJECT_ID] = Object.fromEntries(enabledModelIDs.map((id) => [id, true]));

  return nextState;
}

function seedAnalysisState(state: AnalysisState): AnalysisState {
  const nextState: AnalysisState = {
    seq: state.seq ?? 0,
    runs: { ...(state.runs ?? {}) },
    runsByProject: { ...(state.runsByProject ?? {}) },
    promptRuns: { ...(state.promptRuns ?? {}) },
    promptRunsByRun: { ...(state.promptRunsByRun ?? {}) },
    responses: { ...(state.responses ?? {}) },
    responsesByRun: { ...(state.responsesByRun ?? {}) },
    responseIndexByRun: { ...(state.responseIndexByRun ?? {}) },
    runByRequest: { ...(state.runByRequest ?? {}) },
    alerts: { ...(state.alerts ?? {}) },
    alertsByProject: { ...(state.alertsByProject ?? {}) },
  };

  const runID = "seed-run-01";
  const promptRunIDs = ["seed-prun-01", "seed-prun-02", "seed-prun-03"];
  const responseIDs = RESPONSES.map((_, index) => `seed-resp-${String(index + 1).padStart(2, "0")}`);
  const alertID = "seed-alert-01";

  nextState.runs![runID] = {
    id: runID,
    projectId: PROJECT_ID,
    runType: "manual",
    status: "completed",
    promptsCount: PROMPTS.length,
    modelsCount: 4,
    expectedResponses: RESPONSES.length,
    completedResponses: RESPONSES.length,
    visibilityScore: 78,
    createdAt: EARLIER,
    updatedAt: NOW,
  };
  nextState.runsByProject![PROJECT_ID] = ensureArrayUnique(nextState.runsByProject![PROJECT_ID] ?? [], runID);

  for (const [index, prompt] of PROMPTS.entries()) {
    const promptRunID = promptRunIDs[index];
    nextState.promptRuns![promptRunID] = {
      id: promptRunID,
      runId: runID,
      promptId: prompt.id,
      promptText: prompt.text,
      createdAt: EARLIER,
    };
  }
  nextState.promptRunsByRun![runID] = promptRunIDs;

  const responseIndex: Record<string, string> = {};
  RESPONSES.forEach((response, index) => {
    const responseID = responseIDs[index];
    nextState.responses![responseID] = {
      id: responseID,
      runId: runID,
      promptRunId: response.promptRunID,
      modelId: response.modelID,
      rawResponse: response.rawResponse,
      brandMentioned: response.brandMentioned,
      brandPosition: response.brandPosition,
      citationFound: response.citationFound,
      citedUrls: response.citedUrls,
      sentiment: response.sentiment,
      createdAt: NOW,
    };
    responseIndex[`${response.promptRunID}|${response.modelID}`] = responseID;
  });
  nextState.responsesByRun![runID] = responseIDs;
  nextState.responseIndexByRun![runID] = responseIndex;

  nextState.alerts![alertID] = {
    id: alertID,
    projectId: PROJECT_ID,
    alertType: "visibility_drop",
    severity: "medium",
    title: "Variations de visibilité détectées",
    description: "Le seed ajoute une alerte de démonstration pour valider le flux dashboard/activity.",
    isRead: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  nextState.alertsByProject![PROJECT_ID] = ensureArrayUnique(nextState.alertsByProject![PROJECT_ID] ?? [], alertID);

  nextState.runByRequest![`${PROJECT_ID}|seed-demo-request`] = runID;
  return nextState;
}

async function main() {
  console.log("Backend seed (organization + project + analysis)");
  console.log(`SEED_ORG_NAME=${ORGANIZATION_NAME}`);
  console.log(`SEED_PROJECT_ID=${PROJECT_ID}`);

  logStep("Resolve seed user from usersvc");
  const user = await getSeedUser();
  console.log(`  user.id=${user.id} authIdentityID=${user.authIdentityID} email=${user.email}`);

  logStep("Create or update organization seed in orgsvc");
  const organization = await ensureOrganization(user);
  console.log(`  organization.id=${organization.id} team.id=${organization.teamID}`);

  logStep("Create or update project-service JSON state");
  const projectState = await loadJSONState<ProjectState>("projectsvc", "project_service_state");
  await saveJSONState("projectsvc", "project_service_state", seedProjectState(user, projectState));

  logStep("Create or update analysis-service JSON state");
  const analysisState = await loadJSONState<AnalysisState>("analysissvc", "analysis_service_state");
  await saveJSONState("analysissvc", "analysis_service_state", seedAnalysisState(analysisState));

  console.log("\nSeed terminé.");
  console.log(`- organization: ${ORGANIZATION_NAME} (#${organization.id})`);
  console.log(`- team: ${TEAM_NAME} (#${organization.teamID})`);
  console.log(`- projectId: ${PROJECT_ID}`);
  console.log(`- owner auth identity: ${user.authIdentityID}`);
  console.log(`- dashboard: /dashboard?projectId=${PROJECT_ID}`);
  console.log(`- prompts: /prompts?projectId=${PROJECT_ID}`);
  console.log(`- perception: /perception?projectId=${PROJECT_ID}`);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
