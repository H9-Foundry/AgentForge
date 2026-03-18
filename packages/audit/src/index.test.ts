import { describe, expect, it } from "vitest";
import { schemaFixtures } from "@h9-foundry/agentforge-schemas";
import type {
  DesignArtifact,
  IncidentArtifact,
  PlanningArtifact,
  QaArtifact,
  ReleaseArtifact
} from "@h9-foundry/agentforge-shared-types";

import { renderGitHubHandoffSummary } from "./index.js";

function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("renderGitHubHandoffSummary", () => {
  it("renders a bounded planning handoff summary", () => {
    const summary = renderGitHubHandoffSummary(cloneFixture(schemaFixtures.planningArtifact) as unknown as PlanningArtifact);

    expect(summary.artifactKind).toBe("planning-brief");
    expect(summary.githubStatus).toBe("completed");
    expect(summary.issueRefs.map((entry) => entry.canonical)).toContain("H9-Foundry/AgentForge#78");
    expect(summary.sections.some((section) => section.heading === "Recommended Next Steps")).toBe(true);
    expect(summary.body).toContain("Planning And Discovery handoff");
  });

  it("renders a deterministic design handoff summary", () => {
    const summary = renderGitHubHandoffSummary(cloneFixture(schemaFixtures.designArtifact) as unknown as DesignArtifact);

    expect(summary.artifactKind).toBe("design-record");
    expect(summary.sections.some((section) => section.heading === "Chosen Approach")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "Options Considered")).toBe(true);
  });

  it("renders a bounded QA handoff summary", () => {
    const summary = renderGitHubHandoffSummary(cloneFixture(schemaFixtures.qaArtifact) as unknown as QaArtifact);

    expect(summary.artifactKind).toBe("qa-report");
    expect(summary.sections.some((section) => section.heading === "Findings")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "Coverage Gaps")).toBe(true);
  });

  it("renders a bounded incident handoff summary", () => {
    const summary = renderGitHubHandoffSummary(cloneFixture(schemaFixtures.incidentArtifact) as unknown as IncidentArtifact);

    expect(summary.artifactKind).toBe("incident-brief");
    expect(summary.sections.some((section) => section.heading === "Timeline Summary")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "Follow-Up Workflows")).toBe(true);
  });

  it("renders a bounded release handoff summary with overrideable status mapping", () => {
    const summary = renderGitHubHandoffSummary(cloneFixture(schemaFixtures.releaseArtifact) as unknown as ReleaseArtifact, {
      statusMapping: {
        workflow: "release-readiness",
        localRunStatus: "partial",
        githubStatus: "blocked",
        reason: "Release verification is still blocked."
      }
    });

    expect(summary.artifactKind).toBe("release-report");
    expect(summary.githubStatus).toBe("blocked");
    expect(summary.sections.some((section) => section.heading === "Verification Checks")).toBe(true);
  });
});
