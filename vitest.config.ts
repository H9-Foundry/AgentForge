import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentops/schemas": resolve(__dirname, "packages/schemas/src/index.ts"),
      "@agentops/shared-types": resolve(__dirname, "packages/shared-types/src/index.ts"),
      "@agentops/sdk": resolve(__dirname, "packages/sdk/src/index.ts"),
      "@agentops/context-engine": resolve(__dirname, "packages/context-engine/src/index.ts"),
      "@agentops/policy-engine": resolve(__dirname, "packages/policy-engine/src/index.ts"),
      "@agentops/audit": resolve(__dirname, "packages/audit/src/index.ts"),
      "@agentops/runtime": resolve(__dirname, "packages/runtime/src/index.ts"),
      "@agentops/registry-client": resolve(__dirname, "packages/registry-client/src/index.ts"),
      "@agentops/cli": resolve(__dirname, "packages/cli/src/index.ts"),
      "@agentops/agent-context-collector": resolve(__dirname, "agents/context-collector/src/index.ts"),
      "@agentops/agent-code-review": resolve(__dirname, "agents/code-review/src/index.ts"),
      "@agentops/agent-security-audit": resolve(__dirname, "agents/security-audit/src/index.ts"),
      "@agentops/agent-test-generation": resolve(__dirname, "agents/test-generation/src/index.ts"),
      "@agentops/adapters-filesystem": resolve(__dirname, "adapters/filesystem/src/index.ts"),
      "@agentops/adapters-git": resolve(__dirname, "adapters/git/src/index.ts"),
      "@agentops/adapters-shell": resolve(__dirname, "adapters/shell/src/index.ts"),
      "@agentops/adapters-github": resolve(__dirname, "adapters/github/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "agents/**/src/**/*.test.ts", "adapters/**/src/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
