import process from "node:process";

import { parseVisualizerServerArgs, readVisualizerSummary, startVisualizerServer } from "./index.js";

async function main(): Promise<void> {
  const args = parseVisualizerServerArgs(process.argv.slice(2));
  const workspaceRoot = process.cwd();
  const summary = readVisualizerSummary(workspaceRoot, args.runsRoot);
  const server = await startVisualizerServer({
    workspaceRoot,
    runsRoot: args.runsRoot,
    benchmarkLedgerPath: args.benchmarkLedgerPath,
    host: args.host,
    port: args.port
  });

  console.log(`AgentForge visualizer ready at ${server.serverUrl}`);
  console.log(`Runs root: ${summary.runsRoot}`);
  console.log(`Visible runs: ${summary.runCount}`);
  console.log(`Visible benchmarks: ${summary.benchmarkCount}`);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main();
