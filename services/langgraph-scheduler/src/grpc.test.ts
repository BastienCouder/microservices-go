import { describe, expect, test } from "bun:test";

import { createGRPCTransport } from "./grpc.js";
import type { SchedulerConfig } from "./types.js";

const baseConfig: SchedulerConfig = {
  projectServiceGRPCAddr: "project-service:9088",
  analysisServiceGRPCAddr: "analysis-service:9089",
  iaServiceGRPCAddr: "ia-service:9091",
  internalJWTSecret: "secret",
  internalJWTIssuer: "issuer",
  internalJWTSubject: "langgraph-scheduler",
  grpcAllowInsecure: false,
  grpcTLSCA: "ca-pem",
  grpcTLSCert: "cert-pem",
  grpcTLSKey: "key-pem",
  grpcTLSServerName: "project.internal",
  pollIntervalMs: 30000,
  lookbackMinutes: 2,
  recentRunTTLms: 60000,
};

describe("createGRPCTransport", () => {
  test("adds tls target overrides when a server name is configured", () => {
    const transport = createGRPCTransport(baseConfig);

    expect(transport.channelOptions["grpc.ssl_target_name_override"]).toBe("project.internal");
    expect(transport.channelOptions["grpc.default_authority"]).toBe("project.internal");
  });

  test("throws when only one client credential artifact is provided", () => {
    expect(() =>
      createGRPCTransport({
        ...baseConfig,
        grpcTLSKey: "",
      }),
    ).toThrow("GRPC_TLS_CERT and GRPC_TLS_KEY must be provided together");
  });
});
