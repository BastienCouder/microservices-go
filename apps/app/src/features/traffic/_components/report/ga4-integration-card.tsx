import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  pushErrorToast,
  pushSuccessToast,
  pushWarningToast,
} from "@/components/ui/toast-actions";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getGA4PropertyDisplayLabel,
  getGA4PropertySummary,
} from "../../_lib/report/ga4-property-labels";
import type { TrafficGA4OAuthProperty } from "../../_lib/report/types";
import type { TrafficGA4LLMSetupResult } from "../../_lib/report/types";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type GA4IntegrationCardProps = {
  connected: boolean;
  authMode: "oauth" | "service_account" | "";
  hasOAuthToken: boolean;
  propertyId: string;
  serviceAccountJSON: string;
  oauthProperties: TrafficGA4OAuthProperty[];
  selectedOAuthPropertyId: string;
  llmSetup: TrafficGA4LLMSetupResult | null;
  oauthPropertiesLoading: boolean;
  saving: boolean;
  loading?: boolean;
  canEdit: boolean;
  onPropertyIdChange: (value: string) => void;
  onServiceAccountJSONChange: (value: string) => void;
  onSelectedOAuthPropertyIdChange: (value: string) => void;
  onStartOAuth: () => void;
  onRefreshOAuthProperties: () => void;
  onSelectOAuthProperty: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function GA4IntegrationCard({
  connected,
  authMode,
  hasOAuthToken,
  propertyId,
  serviceAccountJSON,
  oauthProperties,
  selectedOAuthPropertyId,
  llmSetup,
  oauthPropertiesLoading,
  saving,
  loading = false,
  canEdit,
  onPropertyIdChange,
  onServiceAccountJSONChange,
  onSelectedOAuthPropertyIdChange,
  onStartOAuth,
  onRefreshOAuthProperties,
  onSelectOAuthProperty,
  onConnect,
  onDisconnect,
}: GA4IntegrationCardProps) {
  const { t } = useScopedI18n("traffic-report");
  const [isManaging, setIsManaging] = useState(false);
  const statusLabel = connected
    ? t("ga4StatusConnected")
    : hasOAuthToken
      ? t("ga4StatusPropertyToChoose")
      : t("ga4StatusDisconnected");
  const showControls = isManaging || (hasOAuthToken && !connected);
  const propertySummary = getGA4PropertySummary(propertyId, oauthProperties);
  const selectedOAuthPropertySummary = getGA4PropertySummary(
    selectedOAuthPropertyId,
    oauthProperties,
  );
  const llmSetupStatus = getLLMSetupStatus(llmSetup, t, { loading, saving });

  useEffect(() => {
    if (!llmSetupStatus) {
      return;
    }

    if (llmSetupStatus.tone === "success") {
      pushSuccessToast(llmSetupStatus.title, llmSetupStatus.description);
      return;
    }

    if (llmSetupStatus.tone === "warning") {
      pushWarningToast(llmSetupStatus.title, llmSetupStatus.description);
      return;
    }

    pushErrorToast(
      new Error(llmSetupStatus.title),
      llmSetupStatus.title,
      llmSetupStatus.description,
    );
  }, [llmSetupStatus?.description, llmSetupStatus?.title, llmSetupStatus?.tone]);

  function handlePrimaryAction() {
    if (!connected && !hasOAuthToken) {
      onStartOAuth();
      return;
    }
    setIsManaging((current) => !current);
  }

  return (
    <section
      className={cn(
        "group flex w-full flex-col rounded-2xl border bg-card p-4 text-card-foreground transition-all duration-200 sm:p-5 lg:max-w-lg",
        connected || hasOAuthToken ? "border-background bg-background" : "border-background bg-background",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border p-2">
          <img src="/google_analytics.svg" alt="Google Analytics" className="size-8" />
        </div>
        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            connected
              ? "bg-primary/10 text-primary"
              : hasOAuthToken
                ? "bg-amber-500/10 text-amber-700"
                : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              connected
                ? "bg-primary"
                : hasOAuthToken
                  ? "bg-amber-500"
                  : "bg-muted-foreground/60",
            )}
          />
          {loading ? <Skeleton className="h-3 w-20" /> : statusLabel}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="mb-1.5 truncate text-base font-semibold text-foreground">
          Google Analytics 4
        </h2>
        {loading ? (
          <Skeleton className="h-4 w-40" />
        ) : propertySummary ? (
          <p className="break-words text-sm text-muted-foreground">{propertySummary}</p>
        ) : null}

      </div>

      <div className="mt-auto flex flex-col gap-2">
        {canEdit ? (
      <Button
          type="button"
          variant={connected || hasOAuthToken ? "outline" : "default"}
          className="w-full"
          disabled={saving || loading}
          onClick={handlePrimaryAction}
        >
          {connected || hasOAuthToken ? (
            <Settings2 data-icon="inline-start" />
          ) : (
         null
          )}
          {loading
            ? t("loading")
            : connected || hasOAuthToken
              ? t("manage")
              : t("connectGoogleAnalytics")}
        </Button>

        ) : null}
       
        {showControls && canEdit ? (
          <div className="mt-3 rounded-xl border bg-background/70 p-3">
            <Tabs defaultValue="google" className="flex flex-col gap-4">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted p-1">
                <TabsTrigger value="google" className="gap-2 rounded-lg py-2">
                  {t("googleTab")}
                </TabsTrigger>

                <TabsTrigger value="manual" className="gap-2 rounded-lg py-2">
                  {t("manualTab")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="google" className="m-0 space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("googleConnectionTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("googleConnectionDescription")}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onStartOAuth}
                      disabled={saving || oauthPropertiesLoading}
                      className="w-full justify-center"
                    >
                      {hasOAuthToken ? t("reconnectGoogle") : t("connectGoogle")}
                    </Button>

                    {hasOAuthToken ? (
                      <div className="space-y-3 rounded-lg bg-muted/40 p-3">
                        <label className="grid gap-1.5 text-sm font-medium">
                          {t("ga4PropertyLabel")}
                          <Select
                            value={selectedOAuthPropertyId}
                            onValueChange={onSelectedOAuthPropertyIdChange}
                            disabled={saving || oauthPropertiesLoading || oauthProperties.length === 0}
                          >
                            <SelectTrigger className="w-full min-w-0">
                              <SelectValue
                                placeholder={
                                  oauthPropertiesLoading
                                    ? t("loadingProperties")
                                    : t("chooseProperty")
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-2rem)]">
                              {oauthProperties.map((property) => (
                                <SelectItem
                                  key={property.propertyId}
                                  value={property.propertyId}
                                  className="max-w-[calc(100vw-3rem)]"
                                >
                                  <span className="block min-w-0 truncate">
                                    {getGA4PropertyDisplayLabel(property)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>

                        {selectedOAuthPropertySummary ? (
                          <p className="break-words text-xs text-muted-foreground">
                            {t("currentSelection", { value: selectedOAuthPropertySummary })}
                          </p>
                        ) : oauthPropertiesLoading ? (
                          <p className="text-xs text-muted-foreground">
                            {t("loadingAvailableProperties")}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {t("noPropertyLoaded")}
                          </p>
                        )}

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onRefreshOAuthProperties}
                            disabled={saving || oauthPropertiesLoading}
                          >
                            {oauthPropertiesLoading ? t("loading") : t("refresh")}
                          </Button>

                          <Button
                            type="button"
                            onClick={onSelectOAuthProperty}
                            disabled={saving || oauthPropertiesLoading || !selectedOAuthPropertyId}
                          >
                            {t("useThisProperty")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {connected || hasOAuthToken ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onDisconnect}
                    disabled={saving || oauthPropertiesLoading}
                    className="w-full justify-center text-muted-foreground hover:text-destructive"
                  >
                    {t("disconnectGoogleAnalytics")}
                  </Button>
                ) : null}
              </TabsContent>

              <TabsContent value="manual" className="m-0 space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("manualConnectionTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("manualConnectionDescription")}
                    </p>
                  </div>

                  <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>{t("manualStep1")}</li>
                    <li>{t("manualStep2")}</li>
                    <li>{t("manualStep3")}</li>
                    <li>{t("manualStep4")}</li>
                    <li>{t("manualStep5")}</li>
                  </ol>

                  <div className="space-y-3">
                    <label className="grid gap-1.5 text-sm font-medium">
                      {t("propertyIdLabel")}
                      <Input
                        value={propertyId}
                        onChange={(event) => onPropertyIdChange(event.target.value)}
                        placeholder={t("propertyIdPlaceholder")}
                      />
                    </label>

                    <label className="grid gap-1.5 text-sm font-medium">
                      {t("serviceAccountJsonLabel")}
                      <Textarea
                        value={serviceAccountJSON}
                        onChange={(event) =>
                          onServiceAccountJSONChange(event.target.value)
                        }
                        placeholder='{"type":"service_account","client_email":"...","private_key":"..."}'
                        className="min-h-28 resize-none font-mono text-xs"
                      />
                    </label>

                    <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {t("serviceAccountHelpIntro")}
                      {" "}
                      <span className="font-medium text-foreground">
                        {t("serviceAccountHelpSection")}
                      </span>
                      {" "}
                      {t("serviceAccountHelpMiddle")}
                      {" "}
                      <span className="font-medium text-foreground">{t("serviceAccountHelpKeys")}</span>
                      {" "}
                      {t("serviceAccountHelpAfterKeys")}
                      {" "}
                      <span className="font-medium text-foreground">{t("serviceAccountHelpJson")}</span>
                      {t("serviceAccountHelpEnd")}
                    </p>

                    <Button
                      type="button"
                      onClick={onConnect}
                      disabled={saving}
                      className="w-full"
                    >
                      {connected && authMode === "service_account"
                        ? t("updateConnection")
                        : t("connectManually")}
                    </Button>
                  </div>
                </div>

                {connected || hasOAuthToken ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onDisconnect}
                    disabled={saving}
                    className="w-full justify-center text-muted-foreground hover:text-destructive"
                  >
                    {t("disconnectGoogleAnalytics")}
                  </Button>
                ) : null}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getLLMSetupStatus(
  setup: TrafficGA4LLMSetupResult | null,
  t: (key: string, options?: Record<string, unknown>) => string,
  options?: { loading?: boolean; saving?: boolean },
): {
  title: string;
  description: string;
  tone: "success" | "warning" | "error";
} | null {
  if (options?.loading || options?.saving) {
    return null;
  }
  if (!setup) {
    return null;
  }
  if (setup.setupStatus === "success") {
    return {
      title: t("ga4SetupSuccessTitle"),
      description: t("ga4SetupSuccessDescription"),
      tone: "success",
    };
  }
  if (setup.setupStatus === "partial_success") {
    return {
      title: t("ga4SetupPartialTitle"),
      description:
        formatLLMSetupGuidance(setup.errors[0]?.message, t) ||
        t("ga4SetupPartialDescription"),
      tone: "warning",
    };
  }
  return {
    title: t("ga4SetupErrorTitle"),
    description:
      formatLLMSetupGuidance(setup.errors[0]?.message, t) ||
      t("ga4SetupErrorDescription"),
    tone: "error",
  };
}

function formatLLMSetupGuidance(
  message: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const normalized = message?.trim() ?? "";
  if (normalized === "") {
    return "";
  }

  if (
    normalized.includes("unsupported-channel-grouping-field") ||
    normalized.includes("provided channel grouping contained a 'field_name' that is not supported")
  ) {
    return t("ga4SetupGuidanceChannelGroup", { message: normalized });
  }

  return normalized;
}
