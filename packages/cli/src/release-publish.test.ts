import { describe, expect, it, vi } from "vitest";

type SpawnResult = { status?: number | null; stdout?: string; stderr?: string };
type FixedPackageVersion = { packageName: string; targetVersion: string };
type FixedPackageReconciliation = { allPublished: boolean; packageStatuses: Array<{ status: "published" | "missing" }> };
type ReleasePublishModule = {
  loadFixedPackageVersions: () => FixedPackageVersion[];
  reconcilePublishedFixedPackages: (packageVersions: FixedPackageVersion[], spawn?: never) => FixedPackageReconciliation;
  runChangesetPublish: (argv?: string[], spawn?: never, log?: (...args: unknown[]) => void, errorLog?: (...args: unknown[]) => void) => number;
};

async function loadReleasePublishModule(): Promise<ReleasePublishModule> {
  const modulePath = "../../../scripts/release/run-changeset-publish.mjs";
  return await import(modulePath) as ReleasePublishModule;
}

function createSpawnStub(overrides: {
  changesetStatus?: number;
  publishedVersions?: Record<string, string | undefined>;
}) {
  return vi.fn((command: string, args: string[]) => {
    if (command === "changeset") {
      return {
        status: overrides.changesetStatus ?? 0,
        stdout: "",
        stderr: ""
      } satisfies SpawnResult;
    }

    if (command === "npm" && args[0] === "view") {
      const packageName = args[1];
      const publishedVersion = overrides.publishedVersions?.[packageName];
      if (!publishedVersion) {
        return {
          status: 1,
          stdout: "",
          stderr: "E404"
        } satisfies SpawnResult;
      }

      return {
        status: 0,
        stdout: JSON.stringify(publishedVersion),
        stderr: ""
      } satisfies SpawnResult;
    }

    return {
      status: 1,
      stdout: "",
      stderr: `unexpected command: ${command} ${args.join(" ")}`
    } satisfies SpawnResult;
  });
}

describe("release publish reconciliation", () => {
  it("passes through successful changeset publishes", async () => {
    const { runChangesetPublish } = await loadReleasePublishModule();
    const spawn = createSpawnStub({ changesetStatus: 0 });

    expect(runChangesetPublish([], spawn as never, vi.fn(), vi.fn())).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      "changeset",
      ["publish"],
      expect.objectContaining({
        stdio: "inherit"
      })
    );
  });

  it("reconciles a nonzero publish exit when all fixed packages are already published", async () => {
    const { loadFixedPackageVersions, runChangesetPublish } = await loadReleasePublishModule();
    const publishedVersions = Object.fromEntries(
      loadFixedPackageVersions().map(({ packageName, targetVersion }) => [packageName, targetVersion])
    );
    const spawn = createSpawnStub({
      changesetStatus: 1,
      publishedVersions
    });
    const log = vi.fn();

    expect(runChangesetPublish([], spawn as never, log, vi.fn())).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Treating this as reconciled success"));
  });

  it("keeps the release failed when some fixed packages are still missing", async () => {
    const { loadFixedPackageVersions, runChangesetPublish } = await loadReleasePublishModule();
    const fixedPackages = loadFixedPackageVersions();
    const publishedVersions = Object.fromEntries(
      fixedPackages.slice(0, -1).map(({ packageName, targetVersion }) => [packageName, targetVersion])
    );
    const spawn = createSpawnStub({
      changesetStatus: 1,
      publishedVersions
    });
    const errorLog = vi.fn();

    expect(runChangesetPublish([], spawn as never, vi.fn(), errorLog)).toBe(1);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining(`${fixedPackages.at(-1)?.packageName}@${fixedPackages.at(-1)?.targetVersion}`)
    );
  });

  it("reports reconciliation status for the full fixed package set", async () => {
    const { loadFixedPackageVersions, reconcilePublishedFixedPackages } = await loadReleasePublishModule();
    const fixedPackages = loadFixedPackageVersions();
    const publishedVersions = Object.fromEntries(
      fixedPackages.map(({ packageName, targetVersion }) => [packageName, targetVersion])
    );
    const spawn = createSpawnStub({
      changesetStatus: 1,
      publishedVersions
    });

    const reconciliation = reconcilePublishedFixedPackages(fixedPackages, spawn as never) as FixedPackageReconciliation;

    expect(reconciliation.allPublished).toBe(true);
    expect(reconciliation.packageStatuses).toHaveLength(fixedPackages.length);
    expect(reconciliation.packageStatuses.every((entry: { status: "published" | "missing" }) => entry.status === "published")).toBe(true);
  });
});
