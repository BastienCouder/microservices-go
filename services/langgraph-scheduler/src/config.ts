import { readFileSync } from "node:fs";

import type { SchedulerConfig } from "./types.js";

function readEnv(name: string, fallback = ""): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  const filePath = process.env[`${name}_FILE`];
  if (typeof filePath === "string" && filePath.trim() !== "") {
    return readFileSync(filePath.trim(), "utf8").trim();
  }

  return fallback;
}

function readRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (value === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function parsePositiveInteger(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (raw === "") {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer for ${name}`);
  }
  return parsed;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const raw = readEnv(name);
  if (raw === "") {
    return fallback;
  }

  switch (raw.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      throw new Error(`Invalid boolean for ${name}`);
  }
}

export function loadConfig(): SchedulerConfig {
  const pollIntervalMs = parsePositiveInteger("SCHEDULER_POLL_INTERVAL_MS", 30000);
  const lookbackMinutes = parsePositiveInteger(
    "SCHEDULER_LOOKBACK_MINUTES",
    Math.max(1, Math.ceil(pollIntervalMs / 60000) + 1),
  );

  return {
    projectServiceGRPCAddr: readRequiredEnv("PROJECT_SERVICE_GRPC_ADDR"),
    analysisServiceGRPCAddr: readRequiredEnv("ANALYSIS_SERVICE_GRPC_ADDR"),
    iaServiceGRPCAddr: readRequiredEnv("IA_SERVICE_GRPC_ADDR"),
    internalJWTSecret: readRequiredEnv("INTERNAL_JWT_SECRET"),
    internalJWTIssuer: readRequiredEnv("INTERNAL_JWT_ISSUER"),
    internalJWTSubject: readEnv("INTERNAL_SERVICE_SUBJECT", "langgraph-scheduler"),
    grpcAllowInsecure: parseBoolean("GRPC_ALLOW_INSECURE", true),
    grpcTLSCA: readEnv("GRPC_TLS_CA"),
    grpcTLSCert: readEnv("GRPC_TLS_CERT"),
    grpcTLSKey: readEnv("GRPC_TLS_KEY"),
    grpcTLSServerName: readEnv("GRPC_TLS_SERVER_NAME"),
    pollIntervalMs,
    lookbackMinutes,
    recentRunTTLms: parsePositiveInteger("SCHEDULER_RECENT_RUN_TTL_MS", 6 * 60 * 60 * 1000),
  };
}
