import { useEffect, useMemo, useState } from "react";

import {
  readOrganizationIdFromSearch,
  readProjectTokenFromSearch,
  readSelectedOrganizationPublicID,
  readSelectedProjectID,
} from "@/shared/selection";

import {
  DEFAULT_AUDIT_CHECKS,
} from "./audit-config";
import {
  getAgentReadyProjectSummary,
  isValidScanURL,
  pollAgentReadyScan,
  startAgentReadyScan,
} from "./audit-api";
import type {
  AuditCheckID,
  AuditScanResult,
  BackendScanMode,
} from "../shared/types";

type UseAgentReadyAuditViewModelInput = {
  apiBaseURL: string;
  routeSearch: string;
};

export function useAgentReadyAuditViewModel({
  apiBaseURL,
  routeSearch,
}: UseAgentReadyAuditViewModelInput) {
  const projectId = useMemo(
    () => readProjectTokenFromSearch(routeSearch) || readSelectedProjectID(),
    [routeSearch],
  );
  const organizationId = useMemo(
    () => readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationPublicID(),
    [routeSearch],
  );

  const [url, setURL] = useState("");
  const [projectName, setProjectName] = useState("");
  const [loadingProject, setLoadingProject] = useState(false);
  const [selectedChecks] = useState<AuditCheckID[]>(DEFAULT_AUDIT_CHECKS);
  const [result, setResult] = useState<AuditScanResult | null>(null);
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [hasLoadedProject, setHasLoadedProject] = useState(false);

  const urlError = useMemo(() => {
    if (loadingProject || url.trim() === "") return "";
    return isValidScanURL(url) ? "" : "Enter a valid http or https URL.";
  }, [loadingProject, url]);

  useEffect(() => {
    if (
      apiBaseURL.trim() === "" ||
      projectId.trim() === "" ||
      organizationId.trim() === "" ||
      hasLoadedProject
    ) {
      return;
    }

    let cancelled = false;

    async function loadProjectSummary() {
      try {
        setLoadingProject(true);
        const project = await getAgentReadyProjectSummary(
          apiBaseURL,
          { projectId, organizationId },
        );
        if (cancelled) return;
        setProjectName(project.name);
        setURL(project.websiteUrl);
        setHasLoadedProject(true);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the project URL.",
        );
        setHasLoadedProject(true);
      } finally {
        if (!cancelled) {
          setLoadingProject(false);
        }
      }
    }

    void loadProjectSummary();

    return () => {
      cancelled = true;
    };
  }, [apiBaseURL, hasLoadedProject, organizationId, projectId]);

  const canScan =
    apiBaseURL.trim() !== "" &&
    projectId.trim() !== "" &&
    isValidScanURL(url) &&
    !loadingProject &&
    !isScanning;

  const backendMode: BackendScanMode = "content-site";

  const runScan = async () => {
    if (!canScan) {
      setError(urlError || "Project URL unavailable for this scan.");
      return;
    }

    setIsScanning(true);
    setError("");

    try {
      const queued = await startAgentReadyScan(apiBaseURL, {
        url: url.trim(),
        mode: backendMode,
        checks: selectedChecks,
      });
      const completed = await pollAgentReadyScan(apiBaseURL, queued.scan_id);
      if (completed.status === "failed") {
        throw new Error(completed.error || "scan failed");
      }
      setResult(completed);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  return {
    canScan,
    error,
    loadingProject,
    isScanning,
    projectName,
    result,
    selectedChecks,
    url,
    urlError,
    runScan,
  };
}
