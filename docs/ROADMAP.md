# Roadmap

This roadmap separates current implementation from near-term platform work and longer-term expansion.

## Roadmap Structure

- **Platform Phase 1: Platform Foundation**
  - clarify product framing
  - harden runtime, policy, schemas, and interaction contracts
  - establish planning taxonomy, support matrix, and contribution scaffolding
- **Platform Phase 2: General SDLC Expansion**
  - add official workflow support across more lifecycle domains
  - expand policy and manifest/schema capabilities to support those workflows
  - mature GitHub and release-oriented automation
- **Platform Phase 3: Ecosystem And Plugins**
  - broaden adapters and integration points
  - strengthen plugin and registry-facing surfaces
  - add evals and compatibility scaffolding
- **Platform Phase 4: Enterprise / Governance / Scale**
  - governance, compatibility, tenancy, observability, and scale-oriented controls

## Current Baseline

The current shipped baseline is:

- secure runtime, policy, context, schema, audit, and CLI core
- one official local `pr-review` workflow
- one set of official starter agents
- internal starter adapters
- release, package verification, and trusted publishing automation

## Phase 1: Platform Foundation

### Target Outcomes

- AgentForge docs and backlog reflect the broader SDLC platform direction honestly
- runtime interaction model is ready for broader workflow classes
- policy and schemas are prepared for lifecycle expansion without relaxing defaults
- issue taxonomy, milestones, and contributor workflow are coherent

### Major Workstreams

- product and documentation repositioning
- runtime interaction model hardening
- policy engine expansion
- manifest and schema expansion
- CLI-first onboarding and newcomer usability
- support matrix and compatibility framing
- contributor and community scaffolding

### Dependencies

- roadmap docs and issue taxonomy should land before broad backlog growth
- runtime and policy hardening should precede broad new workflow claims

### Current Foundation Design Work

- [docs/RUNTIME_INTERACTION_HARDENING.md](RUNTIME_INTERACTION_HARDENING.md)
  - capability envelopes
  - side-effect classes
  - context-slice contracts
  - runtime/policy/audit handoff
- [docs/CONTEXT_SLICE_CONTRACTS.md](CONTEXT_SLICE_CONTRACTS.md)
  - slice categories
  - budget and truncation rules
  - requested versus provided slice reporting
  - context-engine/runtime/policy enforcement points
- [docs/POLICY_LIFECYCLE_OVERLAYS.md](POLICY_LIFECYCLE_OVERLAYS.md)
  - lifecycle-domain overlays
  - approval classes
  - precedence and narrowing semantics
  - policy-to-audit expectations
- [docs/MANIFEST_METADATA.md](MANIFEST_METADATA.md)
  - workflow and agent catalog metadata
  - SDLC domain classification
  - support level, maturity, and trust-scope semantics
  - schema and CLI follow-up boundaries
- [docs/ARTIFACT_SCHEMAS.md](ARTIFACT_SCHEMAS.md)
  - shared lifecycle artifact envelope
  - planning, design, review, release, and maintenance artifact families
  - audit-bundle and markdown-summary boundaries
  - schema/runtime/CLI follow-up boundaries

## Execution Flow

The backlog execution model is documented in [docs/QUEUE_EXECUTION_FLOW.md](QUEUE_EXECUTION_FLOW.md).

Use [#83](https://github.com/H9-Foundry/AgentForge/issues/83) as the live execution tracker for:

- active versus ready versus mapped versus deferred queue lanes
- dependency ordering across the next slices
- dogfooding and validation gates for each slice

Use [#97](https://github.com/H9-Foundry/AgentForge/issues/97) as the parallel Phase 1 newcomer-usability track for:

- CLI-first first-run evaluation
- concrete output examples and artifact walkthroughs
- quickstart and sample-repo usability
- newcomer versus maintainer contribution paths

## Phase 2: General SDLC Expansion

### Target Outcomes

- official workflow coverage exists beyond PR review
- lifecycle-specific agents and deterministic nodes start to emerge
- GitHub integration matures beyond the current narrow reporting/release path

### Major Workstreams

- planning and discovery workflows
- architecture and design workflows
- build and implementation workflows
- test and QA workflows
- security and DevSecOps workflows
- release and CI/CD workflows
- operations and incident handoff workflows
- maintenance and dependency/docs workflows

### Dependencies

- relies on Phase 1 schema, runtime, and policy expansion
- requires clearer support boundaries for official vs planned workflows

### Current Workflow Design Work

- [docs/PLANNING_DISCOVERY_WORKFLOW.md](PLANNING_DISCOVERY_WORKFLOW.md)
  - workflow identity and evaluator path
  - request contract and workflow stages
  - deterministic vs agentic boundaries
  - planning artifact and follow-on implementation slices

## Phase 3: Ecosystem And Plugins

### Target Outcomes

- plugin story becomes more usable without weakening trust enforcement
- adapters and registry-facing surfaces become more explicit
- eval and benchmark infrastructure exists to compare workflow quality

### Major Workstreams

- plugin and registry roadmap
- additional SCM/CI integrations
- evals and benchmarks
- compatibility and support matrix expansion

## Phase 4: Enterprise / Governance / Scale

### Target Outcomes

- policy, release trust, compatibility, and observability work support larger organizations
- governance and operational scale concerns are first-class

### Major Workstreams

- supply-chain and release trust hardening
- governance and scale controls
- compatibility commitments
- observability and operational maturity

## Major Risks

- broadening the platform narrative faster than the implementation
- weakening security posture in the name of feature coverage
- creating too many loosely specified workflow promises
- plugin and integration growth outpacing policy and trust controls
- roadmap sprawl without a consistent issue taxonomy

## Dependency Map

| Workstream | Depends On |
| --- | --- |
| Product repositioning | none |
| README and docs overhaul | product repositioning |
| Runtime interaction model hardening | current runtime baseline |
| Policy engine expansion | current policy baseline |
| Manifest/schema expansion | runtime and policy direction |
| Planning/discovery workflows | runtime + policy + schema expansion |
| Architecture/design workflows | runtime + policy + schema expansion |
| Build/implementation workflows | runtime + policy + schema expansion |
| Test/QA workflows | runtime + schema expansion |
| Security/DevSecOps workflows | policy + audit + adapter expansion |
| Release/CI-CD workflows | GitHub maturity + trust hardening |
| Operations/incident workflows | context + adapters + audit maturity |
| Maintenance workflows | GitHub maturity + workflow catalog growth |
| Plugin/registry roadmap | trust model + schema expansion |
| Evals and benchmarks | workflow catalog + support matrix |
| Additional SCM/CI integrations | adapter model + policy gates |
| Support matrix and compatibility | roadmap taxonomy + integration visibility |

## Source Of Truth

The roadmap phases are represented in GitHub milestones and issues. The docs in this directory describe intent; GitHub Issues remain the execution source of truth.
