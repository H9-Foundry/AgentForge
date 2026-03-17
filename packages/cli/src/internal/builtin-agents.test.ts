import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createBuiltinAgentRegistry } from "./builtin-agents.js";

describe("builtin implementation inventory agent", () => {
  it("collects deterministic inventory and allowlisted validation commands", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentforge-inventory-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture-root",
          scripts: {
            test: "vitest run",
            "release:publish": "changeset publish"
          }
        },
        null,
        2
      )
    );
    mkdirSync(join(root, "packages", "app", "src"), { recursive: true });
    writeFileSync(
      join(root, "packages", "app", "package.json"),
      JSON.stringify(
        {
          name: "@fixture/app",
          scripts: {
            build: "tsc -p tsconfig.json",
            test: "vitest run"
          }
        },
        null,
        2
      )
    );
    writeFileSync(join(root, "packages", "app", "src", "index.ts"), "export const value = 1;\n");
    writeFileSync(join(root, "packages", "app", "agent.manifest.json"), "{\"name\":\"fixture\"}\n");

    const agent = createBuiltinAgentRegistry().get("implementation-inventory");
    expect(agent).toBeDefined();

    const output = await agent!.execute({
      state: {} as never,
      stateSlice: {
        repo: {
          root,
          name: "fixture-root",
          branch: "main",
          packageManager: "pnpm",
          languages: ["typescript"],
          ci: false,
          detectedFiles: []
        },
        workflowInputs: {
          implementationRequest: {
            designRecordRef: ".agentops/runs/run-2/bundle.json",
            implementationGoal: "Prepare the next bounded implementation proposal",
            targetPaths: ["packages/app", "packages/missing"],
            validationCommands: ["pnpm test"],
            constraints: [],
            approvalMode: "proposal-only"
          },
          designRecord: {
            schemaVersion: "1.0.0",
            artifactKind: "design-record",
            lifecycleDomain: "design",
            workflow: {
              name: "architecture-design-review",
              displayName: "Architecture And Design Review"
            },
            source: {
              sourceType: "workflow-run",
              runId: "run-2",
              inputRefs: [".agentops/requests/design.yaml"],
              issueRefs: ["#132"]
            },
            status: "complete",
            generatedAt: new Date().toISOString(),
            repo: {
              root,
              name: "fixture-root",
              branch: "main"
            },
            provenance: {
              generatedBy: "agentforge-runtime",
              schemaVersion: "1.0.0",
              executionEnvironment: "local",
              repoRoot: root
            },
            redaction: {
              applied: true,
              strategyVersion: "1.0.0",
              categories: ["secrets"]
            },
            auditLink: {
              entryIds: [],
              findingIds: [],
              proposedActionIds: []
            },
            summary: "Design record ready.",
            payload: {
              decisionSummary: "Choose the implementation workflow shape.",
              context: "Planning brief summary: Planning brief ready.",
              optionsConsidered: [{ option: "single-workflow-pass", summary: "Keep the workflow narrow." }],
              chosenApproach: "single-workflow-pass",
              tradeOffs: [],
              risks: [],
              followUpWork: [],
              interfacesImpacted: ["packages/app/src/index.ts"],
              schemaChangesNeeded: [],
              policyChangesNeeded: [],
              migrationNotes: [],
              compatibilityNotes: []
            }
          }
        }
      } as never,
      policy: {} as never,
      invokeTool: async () => ({}) as never
    });

    expect(output.metadata?.resolvedAffectedPaths).toContain("packages/app");
    expect(output.metadata?.resolvedAffectedPaths).toContain("packages/app/src/index.ts");
    expect(output.metadata?.resolvedAffectedPaths).not.toContain("packages/missing");
    expect(output.metadata?.affectedPackages).toContain("packages/app");
    expect(output.metadata?.entrypoints).toContain("packages/app/src/index.ts");
    expect(output.metadata?.discoveredValidationCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "pnpm test", source: "request", classification: "approval_required" }),
        expect.objectContaining({ command: "pnpm release:publish", classification: "deny" }),
        expect.objectContaining({ command: "pnpm --filter @fixture/app test", classification: "approval_required" })
      ])
    );
  });
});
