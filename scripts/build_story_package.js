const fs = require("fs");
const path = require("path");
const { LAB_ROOT, parseArgs, readJson, writeJson, writeText, ensureDir } = require("./lib");
const { buildStoryPackage, buildPreviewMarkdown, slugify } = require("./story_tools");

function resolveScriptPath(args) {
  if (args.script) {
    return path.resolve(args.script);
  }
  const storySlug = slugify(args.story || args._?.[0] || "the_great_brick_heist_scene_01");
  return path.join(LAB_ROOT, "input", "scripts", `${storySlug}.md`);
}

function buildPackage(options = {}) {
  const scriptPath = resolveScriptPath(options);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script file not found: ${scriptPath}`);
  }

  const voiceConfigPath = path.join(LAB_ROOT, "config", "story_voice_profiles.json");
  const voiceConfig = readJson(voiceConfigPath);
  const markdown = fs.readFileSync(scriptPath, "utf8");
  const storyPackage = buildStoryPackage(markdown, voiceConfig, {
    sceneLimit: options.sceneLimit || options._?.[1] || 0
  });

  const outputDir = path.join(LAB_ROOT, "output", "story_packages", storyPackage.story_id);
  ensureDir(outputDir);

  const packagePath = path.join(outputDir, "story_package.json");
  const previewPath = path.join(outputDir, "story_preview.md");
  const microScenePath = path.join(outputDir, "micro_scenes.json");
  const voiceSegmentsPath = path.join(outputDir, "voice_segments.json");

  writeJson(packagePath, storyPackage);
  writeText(previewPath, buildPreviewMarkdown(storyPackage));
  writeJson(microScenePath, {
    story_id: storyPackage.story_id,
    micro_scenes: storyPackage.micro_scenes
  });
  writeJson(voiceSegmentsPath, {
    story_id: storyPackage.story_id,
    voice_segments: storyPackage.voice_segments,
    voice_cast: storyPackage.voice_cast
  });

  console.log(`Story package created at ${packagePath}`);
  console.log(`Preview markdown created at ${previewPath}`);

  return {
    story_id: storyPackage.story_id,
    package_path: packagePath,
    preview_path: previewPath,
    output_dir: outputDir
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  buildPackage(args);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  buildPackage
};
