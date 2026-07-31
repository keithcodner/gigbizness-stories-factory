const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { LAB_ROOT, ensureDir, parseArgs, readJson, resolveFfmpegPath, writeJson, writeText } = require("./lib");

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "item";
}

function resolvePackagePath(args) {
  if (args.package) {
    return path.resolve(args.package);
  }
  const storyId = slugify(args.story || args._?.[0] || "the_great_brick_heist");
  return path.join(LAB_ROOT, "output", "story_packages", storyId, "story_package.json");
}

function parseMicroSceneIds(value) {
  if (!value) {
    return null;
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSceneIds(value) {
  if (!value) {
    return null;
  }
  return new Set(
    String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function runCommand(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

function loadMotionBlueprints(visualDir) {
  const motionPath = path.join(visualDir, "motion_blueprints.json");
  if (!fs.existsSync(motionPath)) {
    throw new Error(`Motion blueprint file not found: ${motionPath}`);
  }
  const data = readJson(motionPath);
  return new Map((data.motion_blueprints || []).map((item) => [item.micro_scene_id, item]));
}

function loadVoiceManifest(packageDir) {
  const manifestPath = path.join(packageDir, "voice_preview", "voice_preview_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return readJson(manifestPath);
}

function framesForAnimatic(visualDir, selectedIds = null) {
  const framesDir = path.join(visualDir, "generated_frames");
  if (!fs.existsSync(framesDir)) {
    throw new Error(`Generated frames directory not found: ${framesDir}`);
  }
  return fs.readdirSync(framesDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort(naturalSort)
    .filter((name) => !selectedIds || selectedIds.includes(path.basename(name, ".png")))
    .map((name) => ({
      micro_scene_id: path.basename(name, ".png"),
      filePath: path.join(framesDir, name)
    }));
}

function selectionSuffix(sceneIds, microSceneIds) {
  if (sceneIds && sceneIds.size > 0) {
    return [...sceneIds].map((item) => item.toLowerCase()).join("_");
  }
  if (microSceneIds && microSceneIds.length > 0) {
    return microSceneIds.map((item) => item.toLowerCase()).join("_");
  }
  return "";
}

function zoompanFilter(motion, width, height, fps, durationFrames) {
  const camera = new Set(motion.camera_motion || []);
  const centerX = "iw/2-(iw/zoom/2)";
  const centerY = "ih/2-(ih/zoom/2)";

  if (camera.has("insert_push") || camera.has("push_in")) {
    return `zoompan=z='min(1.0+0.0025*on,1.18)':x='${centerX}':y='${centerY}':d=${durationFrames}:s=${width}x${height}:fps=${fps},format=yuv420p`;
  }
  if (camera.has("over_shoulder_insert")) {
    return `zoompan=z='min(1.0+0.0018*on,1.12)':x='(iw-iw/zoom)*(on/${durationFrames})':y='${centerY}':d=${durationFrames}:s=${width}x${height}:fps=${fps},format=yuv420p`;
  }
  if (camera.has("wide_pan") || camera.has("slow_pan")) {
    return `zoompan=z='1.03':x='(iw-iw/zoom)*(on/${durationFrames})':y='${centerY}':d=${durationFrames}:s=${width}x${height}:fps=${fps},format=yuv420p`;
  }
  return `zoompan=z='min(1.0+0.0015*on,1.08)':x='${centerX}':y='${centerY}':d=${durationFrames}:s=${width}x${height}:fps=${fps},format=yuv420p`;
}

function renderClip(frame, motion, clipsDir, width, height, fps) {
  const durationSeconds = Number(motion.target_duration_seconds || 2.5);
  const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
  const clipPath = path.join(clipsDir, `${frame.micro_scene_id}.mp4`);
  const vf = zoompanFilter(motion, width, height, fps, durationFrames);
  runCommand(resolveFfmpegPath(), [
    "-y",
    "-loop",
    "1",
    "-i",
    frame.filePath,
    "-vf",
    vf,
    "-t",
    durationSeconds.toFixed(2),
    "-r",
    String(fps),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    clipPath
  ], `render animatic clip ${frame.micro_scene_id}`);
  return {
    micro_scene_id: frame.micro_scene_id,
    clipPath,
    duration_seconds: durationSeconds
  };
}

function concatClips(clips, outputPath) {
  const concatPath = path.join(os.tmpdir(), `story_animatic_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  const lines = clips.map((clip) => `file '${clip.clipPath.replaceAll("\\", "/").replace(/'/g, "'\\''")}'`);
  fs.writeFileSync(concatPath, `${lines.join("\n")}\n`, "utf8");
  try {
    runCommand(resolveFfmpegPath(), [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c",
      "copy",
      outputPath
    ], `concat animatic clips ${outputPath}`);
  } finally {
    if (fs.existsSync(concatPath)) {
      fs.unlinkSync(concatPath);
    }
  }
}

function attachAudio(baseVideoPath, audioPath, outputPath) {
  if (!audioPath || !fs.existsSync(audioPath)) {
    fs.copyFileSync(baseVideoPath, outputPath);
    return false;
  }
  runCommand(resolveFfmpegPath(), [
    "-y",
    "-i",
    baseVideoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-shortest",
    outputPath
  ], `attach animatic audio ${outputPath}`);
  return true;
}

function summaryMarkdown(summary) {
  const lines = [
    `# ${summary.story_id} Animatic Summary`,
    "",
    `- Clips: ${summary.clip_count}`,
    `- Audio attached: ${summary.audio_attached}`,
    `- Final output: ${summary.output_file}`,
    "",
    "## Clip Order",
    ""
  ];
  for (const clip of summary.clips) {
    lines.push(`- ${clip.micro_scene_id}: ${clip.duration_seconds}s`);
  }
  return `${lines.join("\n")}\n`;
}

function buildStoryAnimatic(options = {}) {
  const packagePath = resolvePackagePath(options);
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Story package not found: ${packagePath}`);
  }
  const packageDir = path.dirname(packagePath);
  const pkg = readJson(packagePath);
  const visualDir = path.join(packageDir, "visual_package");
  const animaticDir = path.join(visualDir, "animatic");
  const clipsDir = path.join(animaticDir, "clips");
  ensureDir(animaticDir);
  ensureDir(clipsDir);

  const selectedIds = parseMicroSceneIds(options.microScenes || options["micro-scenes"]);
  const selectedSceneIds = parseSceneIds(options.scene || options.scenes || options["scene-id"] || options["scene-ids"]);
  const limit = Number(options.limit || 0);
  const width = Number(options.width || 1280);
  const height = Number(options.height || 720);
  const fps = Number(options.fps || 24);
  const motionMap = loadMotionBlueprints(visualDir);
  const selectedByScene = selectedSceneIds
    ? (pkg.micro_scenes || [])
      .filter((item) => selectedSceneIds.has(item.scene_id))
      .map((item) => item.micro_scene_id)
    : null;
  const frameIds = selectedIds || selectedByScene;
  const allFrames = framesForAnimatic(visualDir, frameIds);
  const frames = allFrames.slice(0, limit > 0 ? limit : undefined);
  if (frames.length === 0) {
    throw new Error("No generated frames available for the current animatic filter.");
  }

  const clips = frames.map((frame) => renderClip(
    frame,
    motionMap.get(frame.micro_scene_id) || { target_duration_seconds: 2.5, camera_motion: [] },
    clipsDir,
    width,
    height,
    fps
  ));

  const suffix = selectionSuffix(selectedSceneIds, selectedIds);
  const silentPath = path.join(animaticDir, suffix ? `story_animatic_${suffix}_silent.mp4` : "story_animatic_silent.mp4");
  const finalPath = path.join(animaticDir, suffix ? `story_animatic_${suffix}.mp4` : "story_animatic.mp4");
  concatClips(clips, silentPath);

  const voiceManifest = loadVoiceManifest(packageDir);
  const audioPath = voiceManifest ? path.join(packageDir, voiceManifest.clean_output) : null;
  const audioAttached = attachAudio(silentPath, audioPath, finalPath);

  const summary = {
    story_id: pkg.story_id,
    created_at: new Date().toISOString(),
    scene_filter: selectedSceneIds ? [...selectedSceneIds] : null,
    micro_scene_filter: selectedIds || null,
    clip_count: clips.length,
    clips: clips.map((clip) => ({
      micro_scene_id: clip.micro_scene_id,
      duration_seconds: clip.duration_seconds,
      clip_file: path.relative(packageDir, clip.clipPath).replaceAll("\\", "/")
    })),
    audio_attached: audioAttached,
    output_file: path.relative(packageDir, finalPath).replaceAll("\\", "/")
  };

  const summaryPath = path.join(animaticDir, suffix ? `animatic_summary_${suffix}.json` : "animatic_summary.json");
  const summaryMarkdownPath = path.join(animaticDir, suffix ? `animatic_summary_${suffix}.md` : "animatic_summary.md");
  writeJson(summaryPath, summary);
  writeText(summaryMarkdownPath, summaryMarkdown(summary));

  console.log(`Story animatic created at ${finalPath}`);
  console.log(`Animatic summary written to ${summaryPath}`);
  return summary;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  buildStoryAnimatic(args);
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
  buildStoryAnimatic
};
