# CLI First-Run UX Review

This review captures the current first-run command-line experience for the shipped AgentForge wedge:

- `init`
- `scan`
- `run pr-review`
- `explain last-run`

It is intentionally scoped to the current official workflow surface and does not propose broader CLI expansion for planned SDLC workflows.

## Review Method

The review is based on:

- the current `--help` output for `agentforge`, `init`, `scan`, `run`, and `explain`
- a plain-text evaluator run in a disposable repository copied from `examples/sample-repo`
- comparison against the current README, quickstart, sample repo, and contributor docs

The disposable evaluator flow used:

```bash
npx @h9-foundry/agentforge-cli --help
npx @h9-foundry/agentforge-cli init
npx @h9-foundry/agentforge-cli scan
npx @h9-foundry/agentforge-cli run pr-review
npx @h9-foundry/agentforge-cli explain last-run
```

## Current Strengths

- the command surface is small and easy to scan
- the current wedge is discoverable from the command names alone
- plain-text `scan`, `run`, and `explain` outputs are readable without forcing JSON
- the CLI-first evaluator path documented in the README works with the published package
- the first-run flow stays consistent with the secure local `pr-review` wedge

## Verified Friction Points

| Area | Verified behavior | Impact on a new evaluator | Fix type | Follow-up |
| --- | --- | --- | --- | --- |
| Top-level help framing | `agentforge --help` still describes the product as a workflow runner for engineering agents. | The wording underplays the workflow-first platform framing now used across the repo docs. | Code-level CLI help update | See follow-up issue. |
| `run` and `explain` discoverability | `run --help` and `explain --help` require the user to infer the currently supported values from argument text. | A new evaluator can succeed, but the CLI does not make the current wedge as explicit as it could. | Code-level CLI help update | See follow-up issue. |
| First-run plain-text guidance | `run pr-review` prints the run id, artifact directory, and blocked plugin count, but does not explicitly point the user to the next command or the two key artifact files. | Users can complete the flow, but the success path is clearer in docs than in the CLI itself. | Code-level CLI output improvement | See follow-up issue. |
| Sample repo initialization path | `examples/sample-repo` currently tells users to run `init` even though the copied sample already includes `.agentops`. The command succeeds but prints `Configuration already present.` immediately after initialization. | The evaluator path still works, but the message is confusing and makes the sample repo feel less polished than the blank-repo flow. | Docs-only fix | See follow-up issue. |

## What Does Not Need Immediate Change

- the command count is still appropriately small for the current wedge
- JSON output is already available for scripting and deeper inspection
- the CLI does not need new top-level commands before broader workflow support exists
- the existing docs already do the right thing by distinguishing available-now capability from planned platform scope

## Doc Fixes Versus Code Fixes

### Docs-only fixes

- align `examples/sample-repo/README.md` with the fact that the sample ships with `.agentops`
- keep the canonical blank-repo evaluator path in `README.md` and `docs/quickstart.md` as the default first-use path

### Code-level fixes

- update the top-level help description to reflect workflow-first SDLC positioning
- improve `run --help` and `explain --help` so the currently supported wedge is more explicit
- improve the plain-text success output after `run pr-review` so it points users to the next useful inspection steps

## Bounded Follow-Up Work

This review should lead to bounded follow-up issues, not a broad CLI redesign:

1. improve top-level CLI help and command descriptions for the current wedge
2. improve plain-text first-run guidance after `run pr-review`
3. align sample repo evaluator instructions with its preconfigured `.agentops` state

## Recommendation

Treat the CLI as the primary public entry point for the current wedge. Near-term work should prioritize:

1. fixing the sample repo evaluator path so it feels intentional
2. tightening top-level help and command help text
3. making successful plain-text `run pr-review` output more self-guiding

That keeps the first-run experience aligned with the current platform maturity without implying broader workflow support than the product actually ships today.
