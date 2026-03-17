#!/usr/bin/env node
import { Command } from "commander";

import {
  checkReleaseReadiness,
  explainLastRun,
  initProject,
  renderReleaseGuide,
  runLocalWorkflow,
  scanProject,
  verifyReleaseArtifacts
} from "./index.js";

const program = new Command();

program
  .name("agentforge")
  .description("Secure-by-default workflow runner for repository-aware SDLC workflows.")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold .agentops configuration in the current repository.")
  .action(() => {
    const result = initProject();
    console.log(`Initialized AgentForge in ${result.root}`);
    console.log(result.created.length > 0 ? `Created ${result.created.length} file(s).` : "Configuration already present.");
  });

program
  .command("scan")
  .description("Inspect the repository and recommend starter agents.")
  .option("--json", "Print machine-readable JSON output.")
  .action((options: { json?: boolean }) => {
    const scan = scanProject();
    if (options.json) {
      console.log(JSON.stringify(scan, null, 2));
      return;
    }
    console.log(`Repository: ${scan.root}`);
    console.log(`Package manager: ${scan.packageManager}`);
    console.log(`Languages: ${scan.languages.join(", ") || "unknown"}`);
    console.log(`Changed files: ${scan.changedFiles.length}`);
    console.log(`Recommended agents: ${scan.recommendations.join(", ")}`);
    console.log(`Risks: ${scan.risks.length > 0 ? scan.risks.join(", ") : "none detected"}`);
  });

program
  .command("run")
  .description("Run an official local workflow wedge in safe mode.")
  .argument("<workflow>", "Workflow name. Official workflows: pr-review, planning-discovery, architecture-design-review")
  .option("--json", "Print machine-readable JSON output.")
  .action(async (workflow, options: { json?: boolean }) => {
    const result = await runLocalWorkflow(workflow);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Completed run ${result.runId}`);
    console.log(`Artifacts: ${result.outputDir}`);
    console.log(`Audit bundle: ${result.jsonPath}`);
    console.log(`Summary: ${result.markdownPath}`);
    if (result.artifactCount > 0) {
      console.log(`Lifecycle artifacts: ${result.artifactKinds.join(", ")}`);
    }
    console.log("Next: run `agentforge explain last-run` for a compact summary of this workflow run.");
    console.log(`Blocked plugins: ${result.blockedPlugins}`);
  });

program
  .command("explain")
  .description("Explain the latest run from the current official local workflow wedges.")
  .argument("<target>", "Target to explain. Phase 1 currently supports: last-run")
  .option("--json", "Print machine-readable JSON output.")
  .action((target, options: { json?: boolean }) => {
    if (target !== "last-run") {
      throw new Error("Only 'last-run' is supported in Phase 1.");
    }
    const explanation = explainLastRun();
    if (options.json) {
      console.log(JSON.stringify(explanation, null, 2));
      return;
    }
    console.log(`Run: ${explanation.runId}`);
    console.log(`Status: ${explanation.status}`);
    console.log(`Findings: ${explanation.findings}`);
    console.log(`Blocked actions: ${explanation.blockedActions}`);
    console.log(`Blocked plugins: ${explanation.blockedPlugins}`);
    console.log(`Lifecycle artifacts: ${explanation.artifactKinds.join(", ") || "none"}`);
  });

const release = program.command("release").description("Guide and validate npm release bootstrap for AgentForge.");

release
  .command("guide")
  .description("Print the external npm bootstrap steps and reference URLs.")
  .action(() => {
    console.log(renderReleaseGuide());
  });

release
  .command("check")
  .description("Run read-only release preflight checks for npm publishing.")
  .option("--json", "Print machine-readable JSON output.")
  .option("--skip-npm-auth", "Skip npm auth and npm whoami checks for CI-hosted validation.")
  .option("--skip-local-commands", "Skip local command replay for CI-hosted validation.")
  .action((options: { json?: boolean; skipNpmAuth?: boolean; skipLocalCommands?: boolean }) => {
    const result = checkReleaseReadiness(process.cwd(), {
      skipNpmAuth: options.skipNpmAuth,
      skipLocalCommands: options.skipLocalCommands
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Target scope: ${result.targetScope}`);
      console.log(`Ready: ${result.ready ? "yes" : "no"}`);
      console.log(`npm auth: ${result.npmAuth.present && result.npmAuth.readable ? "configured" : "missing"}`);
      console.log(`npm user: ${result.npmUser.value ?? "unresolved"}`);
      for (const check of result.checks) {
        console.log(`[${check.status}] ${check.label}: ${check.detail}`);
      }
    }

    process.exitCode = result.ready ? 0 : 1;
  });

release
  .command("verify")
  .description("Verify packed public packages from a clean-room consumer install.")
  .option("--json", "Print machine-readable JSON output.")
  .action((options: { json?: boolean }) => {
    const result = verifyReleaseArtifacts();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Workspace root: ${result.workspaceRoot}`);
      console.log(`Target scope: ${result.targetScope}`);
      console.log(`Ready: ${result.ready ? "yes" : "no"}`);
      console.log(`Temp dir: ${result.tempDir}`);
      for (const check of result.checks) {
        console.log(`[${check.status}] ${check.label}: ${check.detail}`);
      }
    }

    process.exitCode = result.ready ? 0 : 1;
  });

program.parseAsync(process.argv);
