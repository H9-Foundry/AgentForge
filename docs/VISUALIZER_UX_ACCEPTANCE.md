# Visualizer UX Acceptance

This checklist is the reusable UX verification gate for the local AgentForge visualizer.

Primary audience:

- external evaluators verifying value after a first run

Secondary audiences:

- operators investigating specific runs
- maintainers managing request and control YAML

## Expected Journey

1. launch `agentforge visualizer --open`
2. land on `/outcomes`
3. understand value, risk, and evidence before touching raw run detail
4. move into `/runs` only when a specific run needs deeper inspection
5. use `/runs/compare` only after two concrete runs are already known
6. use `/benchmarks` only for deterministic `eval compare` evidence
7. use `/configure` as the supported browser authoring layer over canonical repo YAML; repo YAML plus `agentforge config validate` remains canonical

## Page Intent Matrix

| Surface | Primary audience | Required answer | Expected next step |
| --- | --- | --- | --- |
| `/outcomes` | External evaluator | "Did AgentForge add value or change the decision?" | Open filtered run detail or export the summary |
| `/runs` | Operator | "Which exact run produced this outcome?" | Open a run detail page or move into comparison |
| `/runs/compare` | Operator / maintainer | "What changed between these two runs?" | Decide whether the delta came from configuration, evidence, or workflow behavior |
| `/benchmarks` | Evaluator / maintainer | "What does deterministic `eval compare` evidence say?" | Review benchmark artifacts without confusing them with normal workflow outcomes |
| `/configure` | Maintainer | "How do I inspect or safely edit config without hand-authoring YAML?" | Use the structured editor for supported changes or edit YAML directly and run `agentforge config validate` |

## Acceptance Checks

### Evaluator-first path

- `agentforge visualizer --open` opens the outcomes-first journey
- `/` redirects to `/outcomes`
- `/outcomes` explains that it is the starting page after a first run
- `/outcomes` clearly points users toward `/runs`, `/runs/compare`, `/benchmarks`, and `/configure` in that priority order

### Drill-down and comparison

- `/runs` is clearly presented as drill-down, not the primary landing page
- `/runs` provides an obvious route back to `/outcomes`
- `/runs/compare` is clearly labeled as secondary analysis after two runs are already known
- run detail pages link back into outcomes-led exploration and into `/configure` when configuration provenance matters

### Benchmark clarity

- `/benchmarks` is explicitly framed as deterministic eval evidence
- `/benchmarks` does not read like the general onboarding or value page

### Requirements management

- `/configure` says repo YAML is canonical
- `/configure` says `agentforge config validate` is the safety path
- `/configure` is presented as supported by default, not experimental
- the compatibility-disable state remains visible and accurate when `visualizer.experimental_config_editing: false` is set
- configuration hotspots explain missing snapshot data without implying a broken system

### Copy and terminology

- docs and UI agree on `available in the published CLI` vs `source-build only`
- docs and UI agree that `/outcomes` is the primary value dashboard
- docs and UI agree that `/configure` is supported by default while YAML remains canonical

## Verification Method

Use both:

- docs review against [README.md](/Users/ethan/Repo/AgentOps/README.md), [docs/quickstart.md](/Users/ethan/Repo/AgentOps/docs/quickstart.md), and [docs/VISUALIZER.md](/Users/ethan/Repo/AgentOps/docs/VISUALIZER.md)
- live UI review of `/outcomes`, `/runs`, `/runs/compare`, `/benchmarks`, and `/configure`

If any acceptance check fails, record it under one of these buckets:

- journey mismatch
- copy inconsistency
- navigation or hierarchy problem
- density or progressive-disclosure problem
- requirements-management ambiguity
