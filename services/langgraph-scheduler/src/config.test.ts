import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { loadConfig } from "./config.js";

const ENV_KEYS = [
  "PROJECT_SERVICE_GRPC_ADDR",
  "ANALYSIS_SERVICE_GRPC_ADDR",
  "IA_SERVICE_GRPC_ADDR",
  "INTERNAL_JWT_SECRET",
  "INTERNAL_JWT_ISSUER",
  "INTERNAL_SERVICE_SUBJECT",
  "GRPC_ALLOW_INSECURE",
  "GRPC_TLS_CA_FILE",
  "GRPC_TLS_CERT_FILE",
  "GRPC_TLS_KEY_FILE",
  "GRPC_TLS_SERVER_NAME",
  "SCHEDULER_POLL_INTERVAL_MS",
  "SCHEDULER_LOOKBACK_MINUTES",
  "SCHEDULER_RECENT_RUN_TTL_MS",
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

const tempDirs: string[] = [];

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function writeSecretFiles(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "langgraph-scheduler-"));
  tempDirs.push(dir);

  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), contents, "utf8");
  }

  return dir;
}

describe("loadConfig", () => {
  test("reads grpc tls materials from *_FILE environment variables", () => {
    const dir = writeSecretFiles({
      "ca.pem": "ca-pem",
      "client.crt": "cert-pem",
      "client.key": "key-pem",
    });

    process.env.PROJECT_SERVICE_GRPC_ADDR = "project-service:9088";
    process.env.ANALYSIS_SERVICE_GRPC_ADDR = "analysis-service:9089";
    process.env.IA_SERVICE_GRPC_ADDR = "ia-service:9091";
    process.env.INTERNAL_JWT_SECRET = "secret";
    process.env.INTERNAL_JWT_ISSUER = "issuer";
    process.env.GRPC_ALLOW_INSECURE = "false";
    process.env.GRPC_TLS_CA_FILE = path.join(dir, "ca.pem");
    process.env.GRPC_TLS_CERT_FILE = path.join(dir, "client.crt");
    process.env.GRPC_TLS_KEY_FILE = path.join(dir, "client.key");
    process.env.GRPC_TLS_SERVER_NAME = "project.internal";

    const config = loadConfig();

    expect(config.grpcAllowInsecure).toBe(false);
    expect(config.grpcTLSCA).toBe("ca-pem");
    expect(config.grpcTLSCert).toBe("cert-pem");
    expect(config.grpcTLSKey).toBe("key-pem");
    expect(config.grpcTLSServerName).toBe("project.internal");
  });
});
