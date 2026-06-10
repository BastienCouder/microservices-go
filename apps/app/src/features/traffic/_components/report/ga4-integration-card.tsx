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
  const [isManaging, setIsManaging] = useState(false);
  const statusLabel = connected
    ? authMode === "oauth"
      ? "Connecté"
      : "Connecté"
    : hasOAuthToken
      ? "Propriété à choisir"
      : "Non connecté";
  const showControls = isManaging || (hasOAuthToken && !connected);
  const propertySummary = getGA4PropertySummary(propertyId, oauthProperties);
  const selectedOAuthPropertySummary = getGA4PropertySummary(
    selectedOAuthPropertyId,
    oauthProperties,
  );
  const llmSetupStatus = getLLMSetupStatus(llmSetup, { loading, saving });

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
              ? "Chargement..."
              : connected || hasOAuthToken
                ? "Gérer"
                : "Connecter Google Analytics"}
          </Button>
        ) : null}

        {showControls && canEdit ? (
          <div className="mt-3 rounded-xl border bg-background/70 p-3">
            <Tabs defaultValue="google" className="flex flex-col gap-4">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted p-1">
                <TabsTrigger value="google" className="gap-2 rounded-lg py-2">
                  Google
                </TabsTrigger>

                <TabsTrigger value="manual" className="gap-2 rounded-lg py-2">
                  Manuel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="google" className="m-0 space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      Connexion via Google
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Connecte ton compte Google, puis sélectionne la propriété GA4 à utiliser.
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
                      {hasOAuthToken ? "Reconnecter Google" : "Connecter Google"}
                    </Button>

                    {hasOAuthToken ? (
                      <div className="space-y-3 rounded-lg bg-muted/40 p-3">
                        <label className="grid gap-1.5 text-sm font-medium">
                          Propriété GA4
                          <Select
                            value={selectedOAuthPropertyId}
                            onValueChange={onSelectedOAuthPropertyIdChange}
                            disabled={saving || oauthPropertiesLoading || oauthProperties.length === 0}
                          >
                            <SelectTrigger className="w-full min-w-0">
                              <SelectValue
                                placeholder={
                                  oauthPropertiesLoading
                                    ? "Chargement des propriétés..."
                                    : "Choisir une propriété GA4"
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
                            Sélection actuelle : {selectedOAuthPropertySummary}
                          </p>
                        ) : oauthPropertiesLoading ? (
                          <p className="text-xs text-muted-foreground">
                            Chargement des propriétés disponibles dans ton compte Google...
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Aucune propriété chargée. Actualise la liste après la connexion Google.
                          </p>
                        )}

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onRefreshOAuthProperties}
                            disabled={saving || oauthPropertiesLoading}
                          >
                            {oauthPropertiesLoading ? "Chargement" : "Actualiser"}
                          </Button>

                          <Button
                            type="button"
                            onClick={onSelectOAuthProperty}
                            disabled={saving || oauthPropertiesLoading || !selectedOAuthPropertyId}
                          >
                            Utiliser cette propriété
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
                    Déconnecter Google Analytics
                  </Button>
                ) : null}
              </TabsContent>

              <TabsContent value="manual" className="m-0 space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      Connexion manuelle
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Utilise cette option si tu veux connecter GA4 avec un Service Account JSON.
                    </p>
                  </div>

                  <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>Dans Google Cloud, crée ou ouvre un projet et active Google Analytics Data API.</li>
                    <li>Crée un Service Account, puis génère une clé JSON.</li>
                    <li>Dans GA4, ouvre Admin, Property access management, puis ajoute l’email du Service Account avec le rôle Editor.</li>
                    <li>Copie l’ID numérique de la propriété GA4 depuis Property details.</li>
                    <li>Colle cet ID et le JSON complet ci-dessous, puis connecte.</li>
                  </ol>

                  <div className="space-y-3">
                    <label className="grid gap-1.5 text-sm font-medium">
                      Property ID GA4
                      <Input
                        value={propertyId}
                        onChange={(event) => onPropertyIdChange(event.target.value)}
                        placeholder="Ex : 123456789"
                      />
                    </label>

                    <label className="grid gap-1.5 text-sm font-medium">
                      Service Account JSON
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
                      Service Account JSON introuvable ? Dans Google Cloud, ouvre
                      {" "}
                      <span className="font-medium text-foreground">
                        IAM & Admin &gt; Service Accounts
                      </span>
                      , choisis le service account, puis va dans
                      {" "}
                      <span className="font-medium text-foreground">Keys</span>
                      . Crée une nouvelle clé
                      {" "}
                      <span className="font-medium text-foreground">JSON</span>
                      , puis reconnecte GA4 avec ce fichier.
                    </p>

                    <Button
                      type="button"
                      onClick={onConnect}
                      disabled={saving}
                      className="w-full"
                    >
                      {connected && authMode === "service_account"
                        ? "Mettre à jour la connexion"
                        : "Connecter manuellement"}
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
                    Déconnecter Google Analytics
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
      title: "Tracking AI Traffic GA4 activé",
      description: "Channel group Default + AI et canal AI prêts.",
      tone: "success",
    };
  }
  if (setup.setupStatus === "partial_success") {
    return {
      title: "Tracking AI Traffic GA4 partiel",
      description:
        formatLLMSetupGuidance(setup.errors[0]?.message) ||
        "Une ressource GA4 reste à vérifier.",
      tone: "warning",
    };
  }
  return {
    title: "Tracking AI Traffic GA4 non configuré",
    description:
      formatLLMSetupGuidance(setup.errors[0]?.message) ||
      "Google Analytics a refusé la configuration automatique.",
    tone: "error",
  };
}

function formatLLMSetupGuidance(message?: string): string {
  const normalized = message?.trim() ?? "";
  if (normalized === "") {
    return "";
  }

  if (
    normalized.includes("unsupported-channel-grouping-field") ||
    normalized.includes("provided channel grouping contained a 'field_name' that is not supported")
  ) {
    return `GA4 a refusé la création automatique du channel group Default + AI. On tente plusieurs noms de champ via l'Admin API; si le refus persiste, créez le channel group manuellement dans Admin > Channel groups avec le canal AI avant Referral. Détail technique: ${normalized}`;
  }

  return normalized;
}
