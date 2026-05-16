export type AuditCheckStatus =
  | "pass"
  | "fail"
  | "warning"
  | "skipped"
  | "not_applicable";

export type ScanMode = "all-checks" | "content-site" | "api-application";

export type BackendScanMode = "content-site";

export type AuditCheckID =
  | "robots_txt"
  | "sitemap"
  | "link_headers"
  | "markdown_negotiation"
  | "ai_bot_rules"
  | "content_signals";

export type AuditCategoryID = "discoverability" | "content" | "bot_access";

export type AuditResource = {
  label: string;
  url: string;
};

export type AuditCheckResult = {
  id: AuditCheckID;
  label: string;
  category_id: AuditCategoryID;
  category_label: string;
  status: AuditCheckStatus;
  score: number;
  max_score: number;
  goal: string;
  issue: string;
  how_to_implement: string;
  resources: AuditResource[];
  prompt: string;
  evidence?: string[];
  optional?: boolean;
  excluded_from_base?: boolean;
};

export type AuditCategoryScore = {
  id: AuditCategoryID;
  label: string;
  score: number;
  max_score: number;
};

export type AuditSummary = {
  passed: number;
  failed: number;
  warning: number;
  skipped: number;
};

export type AuditScanResult = {
  scan_id: string;
  status: "queued" | "running" | "done" | "failed";
  url: string;
  mode: BackendScanMode;
  score: number;
  level: "Not Ready" | "Partially Ready" | "Ready";
  summary: AuditSummary;
  categories: AuditCategoryScore[];
  checks: AuditCheckResult[];
  error?: string;
};

export type AuditQueuedResponse = {
  scan_id: string;
  status: "queued";
};

export type AuditScanInput = {
  url: string;
  mode: BackendScanMode;
  checks: AuditCheckID[];
};

export type CheckOption = {
  id: AuditCheckID | "web_bot_auth";
  label: string;
  description: string;
  disabled?: boolean;
};

export type CheckGroup = {
  id: AuditCategoryID;
  label: string;
  description: string;
  checks: CheckOption[];
};
