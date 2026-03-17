# Gap Analysis: General SDLC Platform

This document explains the gap between the current AgentForge implementation and the broader SDLC platform direction.

## What Already Exists

- secure-by-default runtime core
- explicit policy engine with read/write/network/tool gating
- context engine for repository-aware workflow state
- schema and type packages for shared contracts
- audit bundle and markdown summary generation
- public CLI and runtime packages
- one official local `pr-review` workflow
- official starter agents for context, security audit, code review, and proposed test generation
- release verification, trusted publishing, and package validation flow
- local plugin registration and trust enforcement baseline

## What Is Partial

- GitHub integration exists but is still narrow
- release automation is mature relative to the rest of the product, but broader CI/CD workflow coverage is not
- security posture is strong, but security-specific workflow coverage is still thin
- internal adapters exist, but they are not yet a documented public integration surface
- the repo has a credible architecture core, but the platform narrative and backlog are still catching up
- several Phase 1 contract docs now exist for runtime interactions, context slices, policy overlays, manifest metadata, and lifecycle artifact families, but those contracts are still largely design-first rather than implemented behavior

## What Is Missing

- official workflows for planning, design, build, operations, and maintenance
- lifecycle-specific agents beyond the PR-review wedge
- official adapter and integration catalog beyond internal starter adapters
- evals and benchmark framework
- compatibility commitments and support matrix discipline
- richer SCM/CI and observability integrations
- enterprise governance and scale surfaces

## What Should Be Phase 2

- broaden from `pr-review` to adjacent SDLC workflow slices
- expand runtime interaction contracts for more workflow shapes
- expand policy and schemas to support lifecycle-specific workflows
- mature GitHub integration and release/CI workflow support
- add explicit support matrix and compatibility work

## What Should Be Postponed

- plugin marketplace or broad registry claims before trust and lifecycle rules are stronger
- enterprise governance features before the workflow/runtime core is proven across more SDLC domains
- broad multi-tenant or hosted claims before lifecycle support and compatibility are clearer

## What Should Not Be Built Yet

- unrestricted shell or network execution paths
- generic “agent can do anything” workflow layers
- broad integrations without policy-aware adapter contracts
- roadmap claims that imply official support where only experiments exist

## Recommended Sequencing

1. finish platform framing, issue taxonomy, and backlog hygiene
2. harden runtime, policy, and schemas for broader workflow classes
3. add the next official workflow slices one domain at a time
4. expand integrations and plugin surfaces only after the workflow core is clearer
5. layer on compatibility, evals, governance, and scale once the platform wedge is broader
