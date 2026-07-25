const test = require("node:test");
const assert = require("node:assert/strict");
const { repoRoot, workspacesDir, libraryDir } = require("../../src/paths");

test("core repository paths resolve inside the repo", () => {
  assert.match(repoRoot, /gigbizness-stories-factory$/i);
  assert.match(workspacesDir, /workspaces$/i);
  assert.match(libraryDir, /library$/i);
});
