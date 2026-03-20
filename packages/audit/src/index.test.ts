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
    const artifact = cloneFixture(schemaFixtures.qaArtifact) as unknown as QaArtifact;
    artifact.source.scmRefs = [cloneFixture(schemaFixtures.gitlabMergeRequestScmReference)];
    const summary = renderGitHubHandoffSummary(artifact);

    expect(summary.artifactKind).toBe("qa-report");
    expect(summary.sections.some((section) => section.heading === "Findings")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "Coverage Gaps")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "SCM References")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "CI Evidence")).toBe(true);
    expect(summary.body).toContain("gitlab merge_request: gitlab.com/h9-foundry/platform/agentforge!45");
    expect(summary.body).toContain("Buildkite (buildkite) pipeline `qa` run `bk-41` completed from local-export evidence with success.");
  });

  it("renders a bounded incident handoff summary", () => {
    const summary = renderGitHubHandoffSummary(cloneFixture(schemaFixtures.incidentArtifact) as unknown as IncidentArtifact);

    expect(summary.artifactKind).toBe("incident-brief");
    expect(summary.sections.some((section) => section.heading === "Timeline Summary")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "Follow-Up Workflows")).toBe(true);
  });

  it("renders a bounded release handoff summary with overrideable status mapping", () => {
    const artifact = cloneFixture(schemaFixtures.releaseArtifact) as unknown as ReleaseArtifact;
    artifact.source.scmRefs = [cloneFixture(schemaFixtures.gitlabIssueScmReference)];
    const summary = renderGitHubHandoffSummary(artifact, {
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
    expect(summary.sections.some((section) => section.heading === "SCM References")).toBe(true);
    expect(summary.sections.some((section) => section.heading === "CI Evidence")).toBe(true);
    expect(summary.body).toContain("gitlab issue: gitlab.com/h9-foundry/platform/agentforge#123");
    expect(summary.body).toContain("GitHub Actions (github-actions) pipeline `publish` run `321` completed from adapter-read evidence with success.");
  });

  it("renders Jenkins-backed CI summaries through the shared handoff path", () => {
    const artifact = cloneFixture(schemaFixtures.releaseArtifact) as unknown as ReleaseArtifact;
    artifact.payload.ciEvidenceSummary = [
      {
        provider: "Buildkite",
        platform: "buildkite",
        host: "buildkite.com",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "release",
        pipelineRunId: "bk-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "Buildkite (buildkite) pipeline `release` run `bk-42`",
        statusSummary: "Buildkite (buildkite) pipeline `release` run `bk-42` completed from local-export evidence with success."
      },
      {
        provider: "Jenkins",
        platform: "jenkins-ci",
        host: "jenkins.local",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "Jenkins CI",
        pipelineRunId: "jenkins-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42`",
        statusSummary: "Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42` completed from local-export evidence with success."
      },
      {
        provider: "CircleCI",
        platform: "generic-ci",
        host: "circleci.local",
        repository: "H9-Foundry/AgentForge",
        pipelineName: "CircleCI",
        pipelineRunId: "circleci-42",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "abc123",
        failingChecks: [],
        provenanceSource: "local-export",
        displayLabel: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42`",
        statusSummary: "CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42` completed from local-export evidence with success."
      }
    ];

    const summary = renderGitHubHandoffSummary(artifact);

    expect(summary.sections.some((section) => section.heading === "CI Evidence")).toBe(true);
    expect(summary.body).toContain("Buildkite (buildkite) pipeline `release` run `bk-42` completed from local-export evidence with success.");
    expect(summary.body).toContain("Jenkins (jenkins-ci) pipeline `Jenkins CI` run `jenkins-42` completed from local-export evidence with success.");
    expect(summary.body).toContain("CircleCI (generic-ci) pipeline `CircleCI` run `circleci-42` completed from local-export evidence with success.");
  });
});
