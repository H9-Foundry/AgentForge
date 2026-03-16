import test from "node:test";
import assert from "node:assert/strict";

import { formatGreeting } from "../src/service.js";

test("formats a greeting", () => {
  assert.equal(formatGreeting("agentforge"), "hello, agentforge");
});
