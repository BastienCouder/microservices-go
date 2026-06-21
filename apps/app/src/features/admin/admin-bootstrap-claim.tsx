"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, requireGatewayData } from "@/shared/api/gateway";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type AdminBootstrapClaimProps = {
  apiBaseURL: string;
  compact?: boolean;
};

async function claimSuperAdmin(apiBaseURL: string, code: string) {
  return requireGatewayData(
    gatewayJSON(apiBaseURL, apiRoutes.admin.bootstrapSuperAdmin(), {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
    "Impossible d’activer le super admin.",
  );
}

export function AdminBootstrapClaim({ apiBaseURL, compact = false }: AdminBootstrapClaimProps) {
  const { t } = useScopedI18n("admin-bootstrap");
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");

  const claimMutation = useMutation({
    mutationFn: () => claimSuperAdmin(apiBaseURL, code),
    onSuccess: async () => {
      setCode("");
      await queryClient.invalidateQueries({
        queryKey: ["organizations", apiBaseURL],
      });
      pushSuccessToast(t("success"));
    },
    onError: (error) => {
      pushErrorToast(error, t("error"));
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) return;
    claimMutation.mutate();
  };

  return (
    <form
      onSubmit={submit}
      className={
        compact
          ? "flex w-full flex-col gap-3 rounded-md border border-dashed border-border/70 bg-background px-4 py-4 text-left md:flex-row md:items-end"
          : "mx-auto flex min-h-[260px] w-full max-w-md flex-col justify-center gap-4 rounded-md border border-dashed border-border/70 bg-background px-4 py-6 text-left"
      }
    >
      <div className={compact ? "min-w-0 flex-1 space-y-1" : "space-y-2"}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className={compact ? "w-full space-y-2 md:w-64" : "space-y-2"}>
        <Label htmlFor="admin-bootstrap-code">{t("codeLabel")}</Label>
        <Input
          id="admin-bootstrap-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          type="password"
        />
      </div>
      <Button type="submit" disabled={!code.trim() || claimMutation.isPending}>
        <KeyRound data-icon="inline-start" />
        {claimMutation.isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
