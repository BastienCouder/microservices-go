export type TrafficPeriod = "7d" | "30d" | "90d";

export type TrafficDateRange = {
  startDate: string;
  endDate: string;
};

export type TrafficSummary = {
  totalTrafficSessions: number;
  totalSessions: number;
  trafficShareOfTotal: number;
  trafficEngagedSessions: number;
  trafficEngagementRate: number;
  trafficAvgSessionSeconds: number;
  trafficBounceRate: number;
  trafficConversions: number;
  trafficConversionRate: number;
  trafficPageViews: number;
  topEngine: string;
};

export type TrafficSource = {
  source: string;
  medium: string;
  sourceMedium: string;
  landingPage: string;
  engine: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  bounceRate: number;
  avgSessionSeconds: number;
  conversions: number;
  pageViews: number;
  shareOfTrafficSessions: number;
};

export type TrafficPage = {
  path: string;
  title: string;
  source: string;
  engine: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
  pageViews: number;
};

export type TrafficDailyPoint = {
  date: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
};

export type TrafficQuotaStatus = {
  consumed: number;
  remaining: number;
};

export type TrafficPropertyQuota = {
  tokensPerDay: TrafficQuotaStatus;
  serverErrorsPerProjectPerHour: TrafficQuotaStatus;
};

export type TrafficReport = {
  projectId: string;
  propertyId: string;
  dataSource: "ga4" | "fake" | "";
  dateRange: TrafficDateRange;
  generatedAt: string;
  summary: TrafficSummary;
  bySource: TrafficSource[];
  topPages: TrafficPage[];
  timeseries: TrafficDailyPoint[];
  propertyQuota: TrafficPropertyQuota | null;
};

export type TrafficGA4Integration = {
  propertyId: string;
  authMode: "oauth" | "service_account" | "";
  hasServiceAccount: boolean;
  hasOAuthToken: boolean;
  isConnected: boolean;
  connectedAt: string;
  updatedAt: string;
};

export type TrafficImpactIntegrations = {
  projectId: string;
  ga4: TrafficGA4Integration;
};

export type TrafficPageData = {
  report: TrafficReport;
  integration: TrafficImpactIntegrations;
  projectId: string | null;
  projectName: string;
  organizationId: string;
  period: TrafficPeriod;
  reportError: string | null;
};

export type SaveTrafficGA4IntegrationInput = {
  projectId: string;
  organizationId: string;
  propertyId: string;
  serviceAccountJSON: string;
};

export type SaveTrafficGA4IntegrationResult = {
  integration: TrafficImpactIntegrations;
  llmSetup: TrafficGA4LLMSetupResult | null;
};

export type TrafficGA4OAuthProperty = {
  propertyId: string;
  displayName: string;
  accountName: string;
};

export type StartTrafficGA4OAuthInput = {
  projectId: string;
  organizationId: string;
  redirectUri: string;
};

export type StartTrafficGA4OAuthResult = {
  authorizationUrl: string;
  state: string;
};

export type CompleteTrafficGA4OAuthInput = {
  projectId: string;
  organizationId: string;
  code: string;
  state: string;
  redirectUri: string;
  propertyId?: string;
};

export type CompleteTrafficGA4OAuthResult = {
  integration: TrafficImpactIntegrations;
  properties: TrafficGA4OAuthProperty[];
  llmSetup: TrafficGA4LLMSetupResult | null;
};

export type SelectTrafficGA4OAuthPropertyInput = {
  projectId: string;
  organizationId: string;
  propertyId: string;
};

export type TrafficGA4LLMSetupStatus = "success" | "partial_success" | "failed" | "";

export type TrafficGA4LLMSetupResources = {
  channelGroupName: string;
  customDimensionName: string;
};

export type TrafficGA4LLMSetupError = {
  resource: string;
  message: string;
};

export type TrafficGA4LLMSetupResult = {
  setupStatus: TrafficGA4LLMSetupStatus;
  createdResources: TrafficGA4LLMSetupResources;
  errors: TrafficGA4LLMSetupError[];
};

export type SelectTrafficGA4OAuthPropertyResult = {
  integration: TrafficImpactIntegrations;
  llmSetup: TrafficGA4LLMSetupResult | null;
};
