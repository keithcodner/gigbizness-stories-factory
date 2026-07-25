const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { runStoryPackage } = require("../../scripts/story-package");
const { workspaceRoot } = require("../../scripts/story_cli_lib");

test("story package stage creates canonical workspace artifacts", () => {
  const result = runStoryPackage({ topic: "the_great_brick_heist" });
  const packagePath = path.join(workspaceRoot(result.story_id), "01_story_package", "story_package.json");
  assert.equal(fs.existsSync(packagePath), true);
});
