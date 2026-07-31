const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { finishSceneSample } = require("./scene-sample-finish");
const { runWorkflow } = require("./run_workflow");
const {
  REPO_ROOT,
  ensureDir,
  parseArgs,
  readJson,
  resolveFfmpegPath
} = require("./lib");

function firstVideo(report) {
  const asset = (report.downloaded_assets || [])
    .find((item) => item.local_path && item.local_path.toLowerCase().endsWith(".mp4"));
  if (!asset) {
    throw new Error("Interpolation workflow produced no MP4.");
  }
  return asset.local_path;
}

async function runSceneKeyposePerformance(options = {}) {
  if (!options.start || !options.end) {
    throw new Error("Both --start and --end key-pose images are required.");
  }
  const startPath = path.resolve(options.start || "");
  const endPath = path.resolve(options.end || "");
  if (!fs.existsSync(startPath) || !fs.existsSync(endPath)) {
    throw new Error("Both --start and --end key-pose images are required.");
  }
  const storyId = String(options.story || "the_great_brick_heist_scene_sample");
  const microSceneId = String(options.microScene || "SCENE_01_MS_04");
  const packageDir = path.join(REPO_ROOT, "output", "story_packages", storyId);
  const outputDir = path.join(packageDir, "scene_sample");
  ensureDir(outputDir);
  const profile = readJson(path.join(REPO_ROOT, "config", "motion_profiles", "gtx1080_keypose_performance.json"));
  const sourcePath = path.join(outputDir, `${microSceneId.toLowerCase()}_keyposes.mp4`);
  const sourceResult = spawnSync(resolveFfmpegPath(), [
    "-y",
    "-loop", "1", "-t", "1", "-i", startPath,
    "-loop", "1", "-t", "1", "-i", endPath,
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0,fps=1,format=yuv420p[video]",
    "-map", "[video]",
    "-frames:v", "2",
    sourcePath
  ], { encoding: "utf8" });
  if (sourceResult.status !== 0) {
    throw new Error(sourceResult.stderr || "Failed to build key-pose source video.");
  }

  const transition = await runWorkflow({
    workflow: path.join(REPO_ROOT, "templates", "video_interpolate_api.json"),
    patch: path.join(REPO_ROOT, "config", "video_interpolate_patch_rules.json"),
    videoPath: sourcePath.replaceAll("\\", "/"),
    sourceFps: profile.transition.source_fps,
    multiplier: profile.transition.multiplier,
    outputFps: profile.transition.output_fps,
    filenamePrefix: `${microSceneId.toLowerCase()}_performance`,
    label: `${microSceneId.toLowerCase()}_performance`
  });
  const transitionPath = firstVideo(transition);
  const smoothing = await runWorkflow({
    workflow: path.join(REPO_ROOT, "templates", "video_interpolate_api.json"),
    patch: path.join(REPO_ROOT, "config", "video_interpolate_patch_rules.json"),
    videoPath: transitionPath.replaceAll("\\", "/"),
    sourceFps: profile.smoothing.source_fps,
    multiplier: profile.smoothing.multiplier,
    outputFps: profile.smoothing.output_fps,
    filenamePrefix: `${microSceneId.toLowerCase()}_performance_smooth`,
    label: `${microSceneId.toLowerCase()}_performance_smooth`
  });
  const smoothPath = firstVideo(smoothing);
  return finishSceneSample({
    story: storyId,
    microScene: microSceneId,
    motion: smoothPath,
    pingpong: profile.assembly.pingpong,
    cameraPush: profile.assembly.camera_push,
    fps: profile.assembly.fps,
    width: profile.assembly.width,
    height: profile.assembly.height,
    output: options.output
  });
}

if (require.main === module) {
  runSceneKeyposePerformance(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runSceneKeyposePerformance
};
