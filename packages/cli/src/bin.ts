#!/usr/bin/env node
import { createInterface } from "node:readline/promises";

import { Command } from "commander";

import {
  analyzeOnboardingProfile,
  checkReleaseReadiness,
  compareLocalEvalRuns,
  discoverLocalRunCandidates,
  exportVisualizerOutcomes,
  launchVisualizer,
  onboardProject,
  readBenchmarkLedger,
  recordBenchmarkLedgerEntry,
  runBenchmarkLedgerWizard,
  runLocalEval,
  explainLastRun,
  initProject,
  renderReleaseGuide,
  runLocalWorkflow,
  scanProject,
  packageUserCliCommand,
  startupPresetNames,
  validateControlPlane,
  verifyReleaseArtifacts
} from "./index.js";

function parseJsonOption<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${error instanceof Error ? error.message : "unknown parse error"}`, {
      cause: error
    });
  }
}

function parseBooleanOption(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Boolean options must be 'true' or 'false', received: ${value}`);
}

function parseNonNegativeIntegerOption(value: string | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer, received: ${value}`);
  }

  return parsed;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseDelimitedList(value: string | undefined): string[] | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

async function promptWithDefault(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question(defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `);
    const trimmed = answer.trim();
    return trimmed.length > 0 ? trimmed : (defaultValue ?? "");
  } finally {
    rl.close();
  }
}

function printRunCandidates(label: string, candidates: ReturnType<typeof discoverLocalRunCandidates>): void {
  if (candidates.length === 0) {
    console.log(`${label}: none found`);
    return;
  }

  console.log(`${label}:`);
  for (const candidate of candidates) {
    console.log(
      `- ${candidate.runId} | ${candidate.workflow} | ${candidate.status} | ${candidate.artifactKinds.join(", ") || "no-artifacts"}`
    );
  }
}

async function runGuidedLiveBenchmark(
  options: {
    taskId?: string;
    arm?: string;
    source?: string;
    taskType?: string;
    benchmarkCategory?: string;
    prefillRun?: string;
    runId?: string;
    workflow?: string;
    agent?: string;
    json?: boolean;
  },
  defaults?: {
    taskId?: string;
    taskType?: string;
    benchmarkCategory?: string;
    taskIntro?: string;
  }
): Promise<void> {
  if (defaults?.taskIntro) {
    console.log(defaults.taskIntro);
  }

  const recentRuns = discoverLocalRunCandidates(process.cwd(), { category: "workflow", limit: 8 });
  if (!options.prefillRun && process.stdin.isTTY) {
    printRunCandidates("Recent workflow runs", recentRuns);
  }

  const taskId = options.taskId
    ?? defaults?.taskId
    ?? (process.stdin.isTTY ? normalizeOptionalString(await promptWithDefault("Benchmark task id", "repo-pilot-1")) : undefined);
  const arm = options.arm
    ?? (process.stdin.isTTY ? normalizeOptionalString(await promptWithDefault("Benchmark arm (control/agentforge)", "control")) : undefined);
  const source = options.source
    ?? (process.stdin.isTTY ? normalizeOptionalString(await promptWithDefault("Benchmark source (live/replay)", "live")) : undefined);
  const taskType = options.taskType
    ?? defaults?.taskType
    ?? (process.stdin.isTTY ? normalizeOptionalString(await promptWithDefault("Task type", "feature/refactor")) : undefined);
  const benchmarkCategory = options.benchmarkCategory
    ?? defaults?.benchmarkCategory
    ?? (process.stdin.isTTY ? normalizeOptionalString(await promptWithDefault("Benchmark category (general/release)", "general")) : undefined);
  const prefillRun = options.prefillRun
    ?? (process.stdin.isTTY ? normalizeOptionalString(await promptWithDefault("Prefill from run id or bundle path (blank skips)")) : undefined);

  if (!taskId || !arm || !source || !taskType) {
    throw new Error("Live benchmark recording needs task id, arm, source, and task type. Provide flags or run interactively.");
  }

  if (options.json) {
    const result = recordBenchmarkLedgerEntry({
      taskId,
      arm: arm as "control" | "agentforge",
      source: source as "live" | "replay",
      taskType,
      benchmarkCategory: benchmarkCategory as "general" | "release" | undefined,
      prefillRunRef: prefillRun,
      runId: options.runId,
      workflow: options.workflow,
      agent: options.agent
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await runBenchmarkLedgerWizard({
    taskId,
    arm: arm as "control" | "agentforge",
    source: source as "live" | "replay",
    taskType,
    benchmarkCategory: benchmarkCategory as "general" | "release" | undefined,
    prefillRunRef: prefillRun,
    runId: options.runId,
    workflow: options.workflow,
    agent: options.agent
  });

  console.log(`${result.created ? "Created" : "Updated"} benchmark ledger entry for ${result.entry.taskId} [${result.entry.arm}]`);
  console.log(`Ledger: ${result.path}`);
  if (result.prefill) {
    console.log(`Prefilled from run ${result.prefill.runId} (${result.prefill.workflow}/${result.prefill.status})`);
  }
  console.log(`Workflow: ${result.entry.workflow ?? "unresolved"}`);
  console.log(`Decision outcome: ${result.entry.decisionOutcome ?? "unrecorded"}`);
  console.log("Next: open `agentforge visualizer --open` and inspect `/outcomes` for the paired task comparison.");
}

async function runGuidedEvalBenchmark(options: {
  baselineRun?: string;
  candidateRun?: string[];
  json?: boolean;
}): Promise<void> {
  let baselineRun = options.baselineRun;
  let candidateRuns = options.candidateRun ?? [];

  if ((!baselineRun || candidateRuns.length === 0) && process.stdin.isTTY) {
    const evalRuns = discoverLocalRunCandidates(process.cwd(), { category: "eval", limit: 8 });
    printRunCandidates("Recent eval runs", evalRuns);
    baselineRun = baselineRun ?? normalizeOptionalString(await promptWithDefault("Baseline eval run id or bundle path"));
    if (candidateRuns.length === 0) {
      const candidateAnswer = await promptWithDefault("Candidate eval run ids or bundle paths (comma-separated)");
      candidateRuns = candidateAnswer
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
  }

  if (!baselineRun || candidateRuns.length === 0) {
    throw new Error("Eval benchmark compare needs one baseline run and at least one candidate run. Provide flags or run interactively.");
  }

  const result = compareLocalEvalRuns(baselineRun, candidateRuns);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Completed benchmark compare ${result.runId}`);
  console.log(`Baseline eval run: ${result.baselineRunId}`);
  console.log(`Compared runs: ${result.comparedRunIds.join(", ")}`);
  console.log(`Artifacts: ${result.outputDir}`);
  console.log(`Summary: ${result.markdownPath}`);
  console.log(`Regressions: ${result.regressionCount}`);
  console.log(`Improvements: ${result.improvementCount}`);
  console.log("Next: open `agentforge visualizer --open` and inspect `/benchmarks` for deterministic compare output.");
}

async function waitForVisualizerShutdown(close: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let closing = false;

    const shutdown = () => {
      if (closing) {
        return;
      }
      closing = true;
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
      void close().then(resolve).catch(reject);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

const program = new Command();

program
  .name("agentforge")
  .description("Secure-by-default workflow runner for repository-aware SDLC workflows.")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold .agentops configuration and optional starter requests in the current repository.")
  .option("--preset <name>", `Create one starter request preset for a common local-first path. Supported presets: ${startupPresetNames.join(", ")}`)
  .action((options: { preset?: string }) => {
    if (options.preset && !startupPresetNames.includes(options.preset as (typeof startupPresetNames)[number])) {
      throw new Error(`Unsupported startup preset: ${options.preset}. Supported presets: ${startupPresetNames.join(", ")}`);
    }

    const result = initProject(process.cwd(), {
      preset: options.preset as (typeof startupPresetNames)[number] | undefined
    });
    console.log(`Initialized AgentForge in ${result.root}`);
    console.log(result.created.length > 0 ? `Created ${result.created.length} file(s).` : "Configuration already present.");
    if (result.preset) {
      console.log(result.preset.created ? `Created starter request: ${result.preset.requestPath}` : `Starter request already present: ${result.preset.requestPath}`);
      console.log(`Next: inspect or edit ${result.preset.requestPath}`);
      console.log(`Then run: \`${packageUserCliCommand} run ${result.preset.workflow} --json\``);
      console.log(`After the run, inspect \`.agentops/runs/<run-id>/bundle.json\` or run \`${packageUserCliCommand} explain last-run --json\`.`);
    }
  });

program
  .command("onboard")
  .alias("setup")
  .description("Guided first-run setup that fits AgentForge to the current repository and suggests the next workflow or benchmark.")
  .option("--json", "Print machine-readable JSON output.")
  .option("--benchmark", "Immediately hand off into the benchmark flow after the onboarding summary.")
  .option("--no-preset", "Initialize .agentops without applying the recommended starter preset.")
  .action(async (options: { json?: boolean; benchmark?: boolean; preset?: boolean }) => {
    const repoFitAnswers = !options.json && process.stdin.isTTY
      ? (() => {
          const profile = analyzeOnboardingProfile(process.cwd());
          return Promise.resolve(profile);
        })()
      : undefined;
    const initialProfile = repoFitAnswers ? await repoFitAnswers : undefined;
    const answers = initialProfile
      ? {
          architectureStyle: normalizeOptionalString(await promptWithDefault("Architecture style", initialProfile.repoFit.contract.structure.architectureStyle)),
          sourceRoots: parseDelimitedList(await promptWithDefault("Source roots (comma-separated)", initialProfile.repoFit.contract.structure.sourceRoots.join(", "))),
          packageRoots: parseDelimitedList(await promptWithDefault("Package roots (comma-separated)", initialProfile.repoFit.contract.structure.packageRoots.join(", "))),
          ownershipBoundaries: parseDelimitedList(await promptWithDefault("Ownership boundaries (comma-separated)", initialProfile.repoFit.contract.structure.ownershipBoundaries.join(", "))),
          pathConventions: parseDelimitedList(await promptWithDefault("Path conventions (comma-separated)", initialProfile.repoFit.contract.structure.pathConventions.join(", "))),
          validationCommands: parseDelimitedList(await promptWithDefault("Validation commands (comma-separated)", initialProfile.repoFit.contract.expectations.validationCommands.join(", "))),
          evidenceSources: parseDelimitedList(await promptWithDefault("Evidence sources (comma-separated)", initialProfile.repoFit.contract.expectations.evidenceSources.join(", "))),
          testingConventions: parseDelimitedList(await promptWithDefault("Testing conventions (comma-separated)", initialProfile.repoFit.contract.expectations.testingConventions.join(", "))),
          releaseConventions: parseDelimitedList(await promptWithDefault("Release conventions (comma-separated)", initialProfile.repoFit.contract.expectations.releaseConventions.join(", "))),
          securityConventions: parseDelimitedList(await promptWithDefault("Security conventions (comma-separated)", initialProfile.repoFit.contract.expectations.securityConventions.join(", "))),
          documentationConventions: parseDelimitedList(await promptWithDefault("Documentation conventions (comma-separated)", initialProfile.repoFit.contract.expectations.documentationConventions.join(", "))),
          operationsConventions: parseDelimitedList(await promptWithDefault("Operations conventions (comma-separated)", initialProfile.repoFit.contract.expectations.operationsConventions.join(", "))),
          codingConventions: parseDelimitedList(await promptWithDefault("Coding conventions (comma-separated)", initialProfile.repoFit.contract.conventions.coding.join(", "))),
          designPatterns: parseDelimitedList(await promptWithDefault("Design patterns (comma-separated)", initialProfile.repoFit.contract.conventions.designPatterns.join(", "))),
          selectedProfileId: normalizeOptionalString(await promptWithDefault("AgentForge starter profile (none or profile id)", initialProfile.repoFit.recommendedProfileId ?? "none")) as
            | "none"
            | "agentforge-ts-monorepo"
            | "agentforge-ts-package"
            | "agentforge-python-service"
            | "agentforge-rust-crate"
            | undefined,
          adoption: normalizeOptionalString(await promptWithDefault("Starter profile adoption (none/partial/full)", "partial")) as
            | "none"
            | "partial"
            | "full"
            | undefined
        }
      : undefined;

    const result = onboardProject(process.cwd(), {
      applyRecommendedPreset: options.preset,
      repoFitAnswers: answers
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Initialized AgentForge in ${result.root}`);
    console.log(result.created.length > 0 ? `Created ${result.created.length} file(s).` : "Configuration already present.");
    console.log(`Repository fit: ${result.profile.packageManager} | ${result.profile.languages.join(", ") || "unknown language set"}`);
    console.log(`Workflow families: ${result.profile.workflowFamilies.join(", ")}`);
    console.log(
      `Validation surface: ${result.profile.recommendedValidationExpectations.length > 0 ? result.profile.recommendedValidationExpectations.join(", ") : "no package-script validations detected"}`
    );
    console.log(
      `Release evidence: ${result.profile.recommendedEvidenceExpectations.length > 0 ? result.profile.recommendedEvidenceExpectations.join(", ") : "no release/deployment evidence surfaced"}`
    );
    console.log(`Repo-fit contract: ${result.repoFit.contractPath}`);
    console.log(
      `Repo-fit profile: ${result.repoFit.selectedProfileId ?? result.repoFit.recommendedProfileId ?? "none"} (${result.repoFit.contract.starterProfile.adoption})`
    );
    console.log(
      `Repo-fit coverage: inferred=${result.repoFit.inferredFields.length}, confirmed=${result.repoFit.confirmedFields.length}, unresolved=${result.repoFit.unresolvedFields.length}`
    );
    if (result.preset) {
      console.log(result.preset.created ? `Created starter request: ${result.preset.requestPath}` : `Starter request already present: ${result.preset.requestPath}`);
    } else if (result.profile.recommendedStarterPresets.length > 0) {
      console.log(`Recommended starter preset: ${result.profile.recommendedStarterPresets.join(", ")}`);
    }
    console.log(`Recommended first workflow: ${result.profile.recommendedFirstWorkflow}`);
    if (result.preset && result.preset.workflow !== result.profile.recommendedFirstWorkflow) {
      console.log(`Runnable starter workflow: ${result.preset.workflow}`);
    }
    console.log(`Recommended first benchmark: ${result.profile.recommendedBenchmarkMode} ${result.profile.recommendedBenchmarkCategory}`);
    console.log(`Next workflow: ${result.nextSteps.firstWorkflowCommand}`);
    console.log(`Next benchmark: ${result.nextSteps.firstBenchmarkCommand}`);
    console.log("Use `/outcomes` to judge live task value and `/benchmarks` only for deterministic eval comparisons.");

    if (options.benchmark) {
      await runGuidedLiveBenchmark(
        {
          taskId: result.profile.recommendedBenchmarkTaskId,
          taskType: result.profile.recommendedBenchmarkTaskType,
          benchmarkCategory: result.profile.recommendedBenchmarkCategory
        },
        {
          taskId: result.profile.recommendedBenchmarkTaskId,
          taskType: result.profile.recommendedBenchmarkTaskType,
          benchmarkCategory: result.profile.recommendedBenchmarkCategory,
          taskIntro:
            "Benchmarking is optional. The default first proof path is a live control-vs-AgentForge comparison on a real repo task, then `/outcomes` for the value review."
        }
      );
      return;
    }

    if (!process.stdin.isTTY) {
      return;
    }

    const nextStep = normalizeOptionalString(
      await promptWithDefault("Next step (workflow/benchmark/none)", result.profile.recommendedBenchmarkMode === "live" ? "workflow" : "none")
    );
    if (nextStep === "benchmark") {
      await runGuidedLiveBenchmark(
        {
          taskId: result.profile.recommendedBenchmarkTaskId,
          taskType: result.profile.recommendedBenchmarkTaskType,
          benchmarkCategory: result.profile.recommendedBenchmarkCategory
        },
        {
          taskId: result.profile.recommendedBenchmarkTaskId,
          taskType: result.profile.recommendedBenchmarkTaskType,
          benchmarkCategory: result.profile.recommendedBenchmarkCategory,
          taskIntro:
            "Benchmarking is optional. The default first proof path is a live control-vs-AgentForge comparison on a real repo task, then `/outcomes` for the value review."
        }
      );
      return;
    }

    if (nextStep === "workflow") {
      console.log(`Run this next: ${result.nextSteps.firstWorkflowCommand}`);
    }
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

const config = program.command("config").description("Inspect and validate the governed AgentForge control plane.");

config
  .command("validate")
  .description("Validate .agentops/control documents, request meta selections, policy preset narrowing, and agent bindings.")
  .option("--json", "Print machine-readable JSON output.")
  .action(async (options: { json?: boolean }) => {
    const result = await validateControlPlane(process.cwd());
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Root: ${result.root}`);
      console.log(`Valid: ${result.valid ? "yes" : "no"}`);
      for (const workflow of result.workflows) {
        console.log(
          `- ${workflow.workflow}: request=${workflow.requestPath}, profiles=${workflow.profileCount}, variants=${workflow.variantCount}, policy-presets=${workflow.policyPresetCount}, bindings=${workflow.bindingCount}`
        );
      }
      if (result.errors.length > 0) {
        console.log("Errors:");
        for (const error of result.errors) {
          console.log(`- ${error}`);
        }
      }
    }

    process.exitCode = result.valid ? 0 : 1;
  });

program
  .command("benchmark")
  .description("Unified benchmark entrypoint for live task benchmarking and deterministic eval comparisons.")
  .option("--mode <mode>", "Benchmark mode: live or eval.")
  .option("--task-id <taskId>", "Live benchmark task id.")
  .option("--arm <arm>", "Live benchmark arm: control or agentforge.")
  .option("--source <source>", "Live benchmark source: replay or live.")
  .option("--task-type <taskType>", "Live benchmark task type.")
  .option("--benchmark-category <category>", "Live benchmark category: general or release.")
  .option("--prefill-run <runRef>", "Prefill live benchmark fields from a local run id or bundle path.")
  .option("--run-id <runId>", "Explicit run id for live benchmark recording.")
  .option("--workflow <workflow>", "Explicit workflow name for live benchmark recording.")
  .option("--agent <agent>", "Agent or model label for live benchmark recording.")
  .option("--baseline-run <runRef>", "Eval benchmark baseline run id or bundle path.")
  .option("--candidate-run <runRef...>", "Eval benchmark candidate run ids or bundle paths.")
  .option("--json", "Print machine-readable JSON output.")
  .action(async (options: {
    mode?: string;
    taskId?: string;
    arm?: string;
    source?: string;
    taskType?: string;
    benchmarkCategory?: string;
    prefillRun?: string;
    runId?: string;
    workflow?: string;
    agent?: string;
    baselineRun?: string;
    candidateRun?: string[];
    json?: boolean;
  }) => {
    const profile = analyzeOnboardingProfile(process.cwd());
    const mode = options.mode
      ?? (process.stdin.isTTY ? normalizeOptionalString(await promptWithDefault("Benchmark mode (live/eval)", profile.recommendedBenchmarkMode)) : profile.recommendedBenchmarkMode);

    if (mode === "eval") {
      await runGuidedEvalBenchmark({
        baselineRun: options.baselineRun,
        candidateRun: options.candidateRun,
        json: options.json
      });
      return;
    }

    await runGuidedLiveBenchmark(
      {
        taskId: options.taskId,
        arm: options.arm,
        source: options.source,
        taskType: options.taskType,
        benchmarkCategory: options.benchmarkCategory,
        prefillRun: options.prefillRun,
        runId: options.runId,
        workflow: options.workflow,
        agent: options.agent,
        json: options.json
      },
      {
        taskId: profile.recommendedBenchmarkTaskId,
        taskType: profile.recommendedBenchmarkTaskType,
        benchmarkCategory: profile.recommendedBenchmarkCategory,
        taskIntro:
          "Live benchmark mode compares a normal repo task against the AgentForge-gated path. Record both arms, then review `/outcomes` for decision impact, risk, and friction."
      }
    );
  });

program
  .command("run")
  .description("Run an official local workflow wedge in safe mode.")
  .argument(
    "<workflow>",
    "Workflow name. Run an initialized workflow under .agentops/workflows, for example: pr-review, planning-discovery, release-readiness, pipeline-evidence-review, deployment-gate-review, or promotion-approval."
  )
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
    console.log(`Next: run \`${packageUserCliCommand} explain last-run\` for a compact summary of this workflow run.`);
    console.log(`Blocked plugins: ${result.blockedPlugins}`);
  });

const evalCommand = program.command("eval").description("Run bounded local eval specs against the official workflow surface.");

evalCommand
  .command("run")
  .description("Execute one built-in local eval spec and emit an eval-result artifact.")
  .argument("<spec-id>", "Eval spec id from the built-in deterministic fixture corpus.")
  .option("--json", "Print machine-readable JSON output.")
  .action(async (specId, options: { json?: boolean }) => {
    const result = await runLocalEval(specId);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Completed eval ${result.runId} for spec ${result.specId}`);
    console.log(`Workflow: ${result.workflow}`);
    console.log(`Artifacts: ${result.outputDir}`);
    console.log(`Audit bundle: ${result.jsonPath}`);
    console.log(`Summary: ${result.markdownPath}`);
    console.log(`Deterministic checks: ${result.deterministicCheckCount}`);
    console.log(`Deterministic failures: ${result.deterministicFailures}`);
    if (result.evaluatedRunId) {
      console.log(`Evaluated run: ${result.evaluatedRunId}`);
    }
    console.log(`Next: run \`${packageUserCliCommand} explain last-run\` for a compact summary of this eval run.`);
  });

evalCommand
  .command("compare")
  .description("Compare one baseline eval result against one or more candidate eval results and emit a benchmark-summary artifact.")
  .argument("<baseline-run>", "Baseline eval run id or bundle path.")
  .argument("<candidate-runs...>", "Candidate eval run ids or bundle paths.")
  .option("--json", "Print machine-readable JSON output.")
  .action((baselineRun, candidateRuns: string[], options: { json?: boolean }) => {
    const result = compareLocalEvalRuns(baselineRun, candidateRuns);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Completed benchmark compare ${result.runId}`);
    console.log(`Baseline eval run: ${result.baselineRunId}`);
    console.log(`Compared runs: ${result.comparedRunIds.join(", ")}`);
    console.log(`Artifacts: ${result.outputDir}`);
    console.log(`Audit bundle: ${result.jsonPath}`);
    console.log(`Summary: ${result.markdownPath}`);
    console.log(`Comparable runs: ${result.comparableRunCount}`);
    console.log(`Regressions: ${result.regressionCount}`);
    console.log(`Improvements: ${result.improvementCount}`);
    console.log(`Non-comparable differences: ${result.nonComparableCount}`);
    console.log(`Next: run \`${packageUserCliCommand} explain last-run\` for a compact summary of this benchmark compare.`);
  });

evalCommand
  .command("benchmark-ledger")
  .description("Print the local benchmark-ledger document used by the outcomes visualizer.")
  .option("--json", "Print machine-readable JSON output.")
  .action((options: { json?: boolean }) => {
    const result = readBenchmarkLedger();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Ledger: ${result.path}`);
    console.log(`Entries: ${result.document.entries.length}`);
    for (const entry of result.document.entries) {
      console.log(`- ${entry.taskId} [${entry.arm}] ${entry.workflow ?? "unknown-workflow"}`);
    }
  });

evalCommand
  .command("benchmark-record")
  .description("Create or update one local benchmark-ledger entry for dogfood adjudication.")
  .argument("<task-id>", "Benchmark task id.")
  .argument("<arm>", "Benchmark arm: control or agentforge.")
  .requiredOption("--source <source>", "Benchmark source: replay or live.")
  .requiredOption("--task-type <taskType>", "Benchmark task type, for example feature/refactor or release/deployment.")
  .option("--benchmark-category <category>", "Benchmark category: general or release.")
  .option("--task-link <taskLink>", "Optional issue, PR, or comment link for this benchmarked task.")
  .option("--run-id <runId>", "Explicit run id to record.")
  .option("--workflow <workflow>", "Explicit workflow name to record.")
  .option("--agent <agent>", "Agent or model label for the benchmark entry.")
  .option("--started-at <iso>", "Optional ISO timestamp for task start.")
  .option("--finished-at <iso>", "Optional ISO timestamp for task end.")
  .option("--cycle-time-seconds <seconds>", "Optional explicit cycle time in seconds.")
  .option("--summary <summary>", "Short human summary for the benchmarked outcome.")
  .option("--decision-outcome <outcome>", "Decision outcome classification.")
  .option("--changed-decision <boolean>", "Whether AgentForge changed the decision: true or false.")
  .option("--decision-impact-reason <reason>", "Reason why the decision outcome was recorded.")
  .option("--release-decision <decision>", "Release decision: go, no-go, conditional, or unclear.")
  .option("--decision-clarity <clarity>", "Decision clarity: clear, mixed, or ambiguous.")
  .option("--final-recommendation-summary <summary>", "Final go/no-go recommendation summary.")
  .option("--rerun-count <count>", "Number of reruns in the benchmarked cycle.")
  .option("--blocked-state-count <count>", "Number of blocked or partial states before the final recommendation.")
  .option("--token-usage <json>", "JSON object with provider, model, token counts, requestCount, and optional estimatedCostUsd.")
  .option("--prefill-run <runRef>", "Prefill obvious fields from an existing local run id or bundle path.")
  .option("--trigger-ref <json...>", "Repeatable JSON objects for trigger refs.")
  .option("--confirmed-risks <json>", "JSON object with high, medium, low, noisy, and unresolved counts.")
  .option("--confirmed-risk <json...>", "Repeatable JSON objects for confirmed risk refs.")
  .option("--evidence-present <value...>", "Repeatable artifact/evidence kinds judged present.")
  .option("--evidence-missing <value...>", "Repeatable artifact/evidence kinds judged missing.")
  .option("--evidence-partial <value...>", "Repeatable artifact/evidence kinds judged partial.")
  .option("--evidence-gap-ref <json...>", "Repeatable JSON objects for evidence gap refs.")
  .option("--workflow-status <json...>", "Repeatable JSON objects with workflow and status.")
  .option("--override <boolean>", "Whether the task overrode a blocked/partial result: true or false.")
  .option("--override-reason <reason>", "Reason for any override.")
  .option("--false-positive-pattern <value...>", "Repeatable false-positive pattern labels.")
  .option("--false-positive-ref <json...>", "Repeatable JSON objects for false-positive refs.")
  .option("--manual-step <value...>", "Repeatable manual-step notes.")
  .option("--request-friction <value...>", "Repeatable request-friction notes.")
  .option("--note <value...>", "Repeatable free-form notes.")
  .option("--json", "Print machine-readable JSON output.")
  .action((taskId, arm, options: {
    source: string;
    taskType: string;
    benchmarkCategory?: string;
    taskLink?: string;
    runId?: string;
    workflow?: string;
    agent?: string;
    startedAt?: string;
    finishedAt?: string;
    cycleTimeSeconds?: string;
    summary?: string;
    decisionOutcome?: string;
    changedDecision?: string;
    decisionImpactReason?: string;
    releaseDecision?: string;
    decisionClarity?: string;
    finalRecommendationSummary?: string;
    rerunCount?: string;
    blockedStateCount?: string;
    tokenUsage?: string;
    prefillRun?: string;
    triggerRef?: string[];
    confirmedRisks?: string;
    confirmedRisk?: string[];
    evidencePresent?: string[];
    evidenceMissing?: string[];
    evidencePartial?: string[];
    evidenceGapRef?: string[];
    workflowStatus?: string[];
    override?: string;
    overrideReason?: string;
    falsePositivePattern?: string[];
    falsePositiveRef?: string[];
    manualStep?: string[];
    requestFriction?: string[];
    note?: string[];
    json?: boolean;
  }) => {
    const result = recordBenchmarkLedgerEntry({
      taskId,
      arm: arm as "control" | "agentforge",
      source: options.source as "replay" | "live",
      taskType: options.taskType,
      benchmarkCategory: options.benchmarkCategory as "general" | "release" | undefined,
      taskLink: options.taskLink,
      runId: options.runId,
      workflow: options.workflow,
      agent: options.agent,
      startedAt: options.startedAt,
      finishedAt: options.finishedAt,
      cycleTimeSeconds: parseNonNegativeIntegerOption(options.cycleTimeSeconds, "cycle-time-seconds"),
      summary: options.summary,
      decisionOutcome: options.decisionOutcome as undefined,
      agentforgeChangedDecision: parseBooleanOption(options.changedDecision),
      decisionImpactReason: options.decisionImpactReason,
      releaseDecision: options.releaseDecision as "go" | "no-go" | "conditional" | "unclear" | undefined,
      decisionClarity: options.decisionClarity as "clear" | "mixed" | "ambiguous" | undefined,
      finalRecommendationSummary: options.finalRecommendationSummary,
      rerunCount: parseNonNegativeIntegerOption(options.rerunCount, "rerun-count"),
      blockedStateCount: parseNonNegativeIntegerOption(options.blockedStateCount, "blocked-state-count"),
      tokenUsage: options.tokenUsage ? parseJsonOption(options.tokenUsage, "token-usage") : undefined,
      prefillRunRef: options.prefillRun,
      triggerRefs: options.triggerRef?.map((value) => parseJsonOption(value, "trigger-ref")),
      confirmedRisks: options.confirmedRisks ? parseJsonOption(options.confirmedRisks, "confirmed-risks") : undefined,
      confirmedRiskRefs: options.confirmedRisk?.map((value) => parseJsonOption(value, "confirmed-risk")),
      evidence: options.evidencePresent || options.evidenceMissing || options.evidencePartial
        ? {
            present: options.evidencePresent ?? [],
            missing: options.evidenceMissing ?? [],
            partial: options.evidencePartial ?? []
          }
        : undefined,
      evidenceGapRefs: options.evidenceGapRef?.map((value) => parseJsonOption(value, "evidence-gap-ref")),
      workflowStatuses: options.workflowStatus?.map((value) => parseJsonOption(value, "workflow-status")),
      friction:
        options.override !== undefined ||
        options.overrideReason !== undefined ||
        (options.falsePositivePattern?.length ?? 0) > 0 ||
        (options.falsePositiveRef?.length ?? 0) > 0 ||
        (options.manualStep?.length ?? 0) > 0 ||
        (options.requestFriction?.length ?? 0) > 0
          ? {
              override: parseBooleanOption(options.override),
              overrideReason: options.overrideReason,
              falsePositivePatterns: options.falsePositivePattern,
              falsePositiveRefs: options.falsePositiveRef?.map((value) => parseJsonOption(value, "false-positive-ref")),
              manualSteps: options.manualStep,
              requestFriction: options.requestFriction
            }
          : undefined,
      notes: options.note
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${result.created ? "Created" : "Updated"} benchmark ledger entry for ${result.entry.taskId} [${result.entry.arm}]`);
    console.log(`Ledger: ${result.path}`);
    if (result.prefill) {
      console.log(`Prefilled from run ${result.prefill.runId} (${result.prefill.workflow}/${result.prefill.status})`);
    }
    console.log(`Workflow: ${result.entry.workflow ?? "unresolved"}`);
    console.log(`Decision outcome: ${result.entry.decisionOutcome ?? "unrecorded"}`);
  });

evalCommand
  .command("benchmark-wizard")
  .description("Interactively create or update one local benchmark-ledger entry with run-prefill support.")
  .argument("<task-id>", "Benchmark task id.")
  .argument("<arm>", "Benchmark arm: control or agentforge.")
  .option("--source <source>", "Initial benchmark source: replay or live.")
  .option("--task-type <taskType>", "Initial benchmark task type.")
  .option("--benchmark-category <category>", "Initial benchmark category: general or release.")
  .option("--prefill-run <runRef>", "Prefill measurable fields from an existing local run id or bundle path.")
  .option("--run-id <runId>", "Explicit run id to seed the wizard.")
  .option("--workflow <workflow>", "Explicit workflow name to seed the wizard.")
  .option("--agent <agent>", "Agent or model label to seed the wizard.")
  .option("--json", "Print machine-readable JSON output.")
  .action(async (taskId, arm, options: {
    source?: string;
    taskType?: string;
    benchmarkCategory?: string;
    prefillRun?: string;
    runId?: string;
    workflow?: string;
    agent?: string;
    json?: boolean;
  }) => {
    const result = await runBenchmarkLedgerWizard({
      taskId,
      arm: arm as "control" | "agentforge",
      source: options.source as "replay" | "live" | undefined,
      taskType: options.taskType,
      benchmarkCategory: options.benchmarkCategory as "general" | "release" | undefined,
      prefillRunRef: options.prefillRun,
      runId: options.runId,
      workflow: options.workflow,
      agent: options.agent
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${result.created ? "Created" : "Updated"} benchmark ledger entry for ${result.entry.taskId} [${result.entry.arm}]`);
    console.log(`Ledger: ${result.path}`);
    if (result.prefill) {
      console.log(`Prefilled from run ${result.prefill.runId} (${result.prefill.workflow}/${result.prefill.status})`);
    }
    console.log(`Workflow: ${result.entry.workflow ?? "unresolved"}`);
    console.log(`Decision outcome: ${result.entry.decisionOutcome ?? "unrecorded"}`);
  });

const visualizer = program
  .command("visualizer")
  .alias("ui")
  .description("Launch or export the official local AgentForge visualizer.");

visualizer
  .option("--runs-root <path>", "Use an explicit runs root instead of .agentops/runs under the current workspace.")
  .option("--benchmark-ledger <path>", "Use an explicit benchmark-ledger JSON path.")
  .option("--host <host>", "Bind the local visualizer server to a specific host.")
  .option("--port <port>", "Bind the local visualizer server to a specific port. Use 0 for an ephemeral port.")
  .option("--open", "Open the local /outcomes page in the default browser after launch.")
  .action(async (options: {
    runsRoot?: string;
    benchmarkLedger?: string;
    host?: string;
    port?: string;
    open?: boolean;
  }) => {
    const result = await launchVisualizer({
      runsRoot: options.runsRoot,
      benchmarkLedgerPath: options.benchmarkLedger,
      host: options.host,
      port: parseNonNegativeIntegerOption(options.port, "port"),
      open: options.open
    });

    console.log(`AgentForge visualizer ready at ${result.serverUrl}`);
    console.log(`Runs root: ${result.runsRoot}`);
    console.log(`Benchmark ledger: ${result.benchmarkLedgerPath}`);
    console.log(`Visible runs: ${result.runCount}`);
    console.log(`Visible benchmarks: ${result.benchmarkCount}`);
    console.log("Press Ctrl+C to stop the local visualizer.");

    await waitForVisualizerShutdown(result.close);
  });

visualizer
  .command("export")
  .description("Export a normalized outcomes snapshot from local runs and the optional benchmark ledger.")
  .option("--runs-root <path>", "Use an explicit runs root instead of .agentops/runs under the current workspace.")
  .option("--benchmark-ledger <path>", "Use an explicit benchmark-ledger JSON path.")
  .option("--format <format>", "Export format: json or markdown.", "json")
  .option("--output <path>", "Write the export to a file instead of stdout.")
  .action(async (options: {
    runsRoot?: string;
    benchmarkLedger?: string;
    format?: string;
    output?: string;
  }) => {
    if (options.format !== "json" && options.format !== "markdown") {
      throw new Error(`Unsupported visualizer export format: ${options.format}. Supported formats: json, markdown`);
    }

    const result = await exportVisualizerOutcomes({
      runsRoot: options.runsRoot,
      benchmarkLedgerPath: options.benchmarkLedger,
      format: options.format,
      outputPath: options.output
    });

    if (options.output) {
      console.log(`Wrote ${result.format} outcomes export to ${result.outputPath}`);
      return;
    }

    process.stdout.write(result.contents);
    if (!result.contents.endsWith("\n")) {
      process.stdout.write("\n");
    }
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
