import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@h9-foundry/agentforge-schemas": resolve(__dirname, "packages/schemas/src/index.ts"),
      "@h9-foundry/agentforge-shared-types": resolve(__dirname, "packages/shared-types/src/index.ts"),
      "@h9-foundry/agentforge-sdk": resolve(__dirname, "packages/sdk/src/index.ts"),
      "@h9-foundry/agentforge-context-engine": resolve(__dirname, "packages/context-engine/src/index.ts"),
      "@h9-foundry/agentforge-policy-engine": resolve(__dirname, "packages/policy-engine/src/index.ts"),
      "@h9-foundry/agentforge-audit": resolve(__dirname, "packages/audit/src/index.ts"),
      "@h9-foundry/agentforge-runtime": resolve(__dirname, "packages/runtime/src/index.ts"),
      "@h9-foundry/agentforge-registry-client": resolve(__dirname, "packages/registry-client/src/index.ts"),
      "@h9-foundry/agentforge-cli": resolve(__dirname, "packages/cli/src/index.ts"),
      "@h9-foundry/agentforge-agent-context-collector": resolve(__dirname, "agents/context-collector/src/index.ts"),
      "@h9-foundry/agentforge-agent-code-review": resolve(__dirname, "agents/code-review/src/index.ts"),
      "@h9-foundry/agentforge-agent-security-audit": resolve(__dirname, "agents/security-audit/src/index.ts"),
      "@h9-foundry/agentforge-agent-test-generation": resolve(__dirname, "agents/test-generation/src/index.ts"),
      "@h9-foundry/agentforge-adapters-filesystem": resolve(__dirname, "adapters/filesystem/src/index.ts"),
      "@h9-foundry/agentforge-adapters-git": resolve(__dirname, "adapters/git/src/index.ts"),
      "@h9-foundry/agentforge-adapters-shell": resolve(__dirname, "adapters/shell/src/index.ts"),
      "@h9-foundry/agentforge-adapters-github": resolve(__dirname, "adapters/github/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "agents/**/src/**/*.test.ts", "adapters/**/src/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
