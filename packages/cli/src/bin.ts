#!/usr/bin/env node
import { Command } from "commander";

import { explainLastRun, initProject, runLocalWorkflow, scanProject } from "./index.js";

const program = new Command();

program.name("agentops").description("Secure-by-default workflow runner for engineering agents.").version("0.1.0");

program
  .command("init")
  .description("Scaffold .agentops configuration in the current repository.")
  .action(() => {
    const result = initProject();
    console.log(`Initialized AgentOps in ${result.root}`);
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
  });

program.parseAsync(process.argv);
