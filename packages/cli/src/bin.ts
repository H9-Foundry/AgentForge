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

program.name("agentforge").description("Secure-by-default workflow runner for engineering agents.").version("0.1.0");

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
  .description("Run a starter workflow locally in safe mode.")
  .argument("<workflow>", "Workflow name, for example pr-review")
  .option("--json", "Print machine-readable JSON output.")
  .action(async (workflow, options: { json?: boolean }) => {
    const result = await runLocalWorkflow(workflow);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Completed run ${result.runId}`);
    console.log(`Artifacts: ${result.outputDir}`);
    console.log(`Blocked plugins: ${result.blockedPlugins}`);
  });

program
  .command("explain")
  .description("Explain the latest workflow run.")
  .argument("<target>", "Currently only supports last-run")
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
  .action((options: { json?: boolean; skipNpmAuth?: boolean }) => {
    const result = checkReleaseReadiness(process.cwd(), {
      skipNpmAuth: options.skipNpmAuth
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
