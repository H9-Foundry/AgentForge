import { spawnSync } from "node:child_process";

const result = spawnSync("changeset", ["publish", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    npm_config_node_linker: "hoisted"
  }
});

process.exit(result.status ?? 1);
