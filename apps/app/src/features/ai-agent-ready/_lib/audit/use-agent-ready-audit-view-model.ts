import { useMemo, useState } from "react";

import {
  DEFAULT_AUDIT_CHECKS,
  SCAN_MODES,
} from "./audit-config";
import {
  isValidScanURL,
  pollAgentReadyScan,
  startAgentReadyScan,
} from "./audit-api";
import type {
  AuditCheckID,
  AuditScanResult,
  BackendScanMode,
  ScanMode,
} from "../shared/types";

type UseAgentReadyAuditViewModelInput = {
  apiBaseURL: string;
};

export function useAgentReadyAuditViewModel({
  apiBaseURL,
}: UseAgentReadyAuditViewModelInput) {
  const [url, setURL] = useState("");
  const [mode, setMode] = useState<ScanMode>("content-site");
  const [selectedChecks, setSelectedChecks] = useState<AuditCheckID[]>(
    DEFAULT_AUDIT_CHECKS,
  );
  const [customizeOpen, setCustomizeOpen] = useState(true);
  const [result, setResult] = useState<AuditScanResult | null>(null);
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const urlError = useMemo(() => {
    if (url.trim() === "") return "";
    return isValidScanURL(url) ? "" : "Enter a valid http or https URL.";
  }, [url]);

  const canScan =
    apiBaseURL.trim() !== "" &&
    isValidScanURL(url) &&
    selectedChecks.length > 0 &&
    !isScanning;

  const backendMode: BackendScanMode = "content-site";
  const activeModeDescription =
    SCAN_MODES.find((item) => item.id === mode)?.description ?? SCAN_MODES[1].description;

  const toggleCheck = (checkID: AuditCheckID) => {
    setSelectedChecks((current) =>
      current.includes(checkID)
        ? current.filter((item) => item !== checkID)
        : [...current, checkID],
    );
  };

  const selectMode = (nextMode: ScanMode) => {
    if (nextMode === "api-application") return;
    setMode(nextMode);
    setSelectedChecks(DEFAULT_AUDIT_CHECKS);
  };

  const runScan = async () => {
    if (!canScan) {
      setError(urlError || "Select at least one check before scanning.");
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
    activeModeDescription,
    canScan,
    customizeOpen,
    error,
    isScanning,
    mode,
    result,
    selectedChecks,
    url,
    urlError,
    runScan,
    selectMode,
    setCustomizeOpen,
    setResult,
    setURL,
    toggleCheck,
  };
}
