export type GeoPeriod = "7d" | "30d" | "90d";

export type GeoTrafficDateRange = {
  startDate: string;
  endDate: string;
};

export type GeoTrafficSummary = {
  totalGeoSessions: number;
  totalSessions: number;
  geoShareOfTotal: number;
  geoEngagedSessions: number;
  geoEngagementRate: number;
  geoAvgSessionSeconds: number;
  geoBounceRate: number;
  geoConversions: number;
  geoConversionRate: number;
  geoPageViews: number;
  topEngine: string;
};

export type GeoTrafficSource = {
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
  shareOfGeoSessions: number;
};

export type GeoTrafficPage = {
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

export type GeoTrafficDailyPoint = {
  date: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
};

export type GeoQuotaStatus = {
  consumed: number;
  remaining: number;
};

export type GeoPropertyQuota = {
  tokensPerDay: GeoQuotaStatus;
  serverErrorsPerProjectPerHour: GeoQuotaStatus;
};

export type GeoTrafficReport = {
  projectId: string;
  propertyId: string;
  dataSource: "ga4" | "fake" | "";
  dateRange: GeoTrafficDateRange;
  generatedAt: string;
  summary: GeoTrafficSummary;
  bySource: GeoTrafficSource[];
  topPages: GeoTrafficPage[];
  timeseries: GeoTrafficDailyPoint[];
  propertyQuota: GeoPropertyQuota | null;
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
  report: GeoTrafficReport;
  integration: TrafficImpactIntegrations;
  projectId: string | null;
  projectName: string;
  organizationId: string;
  period: GeoPeriod;
  reportError: string | null;
};

export type SaveTrafficGA4IntegrationInput = {
  projectId: string;
  organizationId: string;
  propertyId: string;
  serviceAccountJSON: string;
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
};

export type SelectTrafficGA4OAuthPropertyInput = {
  projectId: string;
  organizationId: string;
  propertyId: string;
};
