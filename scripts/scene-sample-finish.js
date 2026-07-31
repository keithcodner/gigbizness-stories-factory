const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  REPO_ROOT,
  ensureDir,
  parseArgs,
  readJson,
  resolveFfmpegPath,
  writeJson
} = require("./lib");

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function finishSceneSample(options = {}) {
  const storyId = slugify(options.story || options.topic || "the_great_brick_heist_scene_sample");
  const microSceneId = String(options.microScene || options.microScenes || "SCENE_01_MS_04");
  const packageDir = options.package
    ? path.dirname(path.resolve(options.package))
    : path.join(REPO_ROOT, "output", "story_packages", storyId);
  const proofPath = path.resolve(
    options.motionReport
    || path.join(REPO_ROOT, "reports", "runtime", "gtx1080_fast8_v1_proof.json")
  );
  const voiceManifestPath = path.join(packageDir, "voice_preview", "voice_preview_manifest.json");
  if (!options.motion && !fs.existsSync(proofPath)) {
    throw new Error(`Motion proof report not found: ${proofPath}`);
  }
  if (!fs.existsSync(voiceManifestPath)) {
    throw new Error(`Voice manifest not found: ${voiceManifestPath}`);
  }

  const proof = options.motion ? null : readJson(proofPath);
  const motionAsset = (proof?.report?.downloaded_assets || [])
    .find((asset) => asset.local_path && asset.local_path.toLowerCase().endsWith(".mp4"));
  const motionPath = options.motion ? path.resolve(options.motion) : motionAsset?.local_path;
  if (!motionPath || !fs.existsSync(motionPath)) {
    throw new Error("The motion proof report contains no readable MP4.");
  }
  const voiceManifest = readJson(voiceManifestPath);
  const voiceSegment = (voiceManifest.segments || [])
    .find((segment) => segment.micro_scene_id === microSceneId);
  if (!voiceSegment) {
    throw new Error(`Voice segment not found for ${microSceneId}.`);
  }
  const voicePath = path.join(packageDir, voiceSegment.file);
  if (!fs.existsSync(voicePath)) {
    throw new Error(`Voice WAV not found: ${voicePath}`);
  }

  const outputDir = path.join(packageDir, "scene_sample");
  const outputPath = options.output
    ? path.resolve(options.output)
    : path.join(outputDir, `${microSceneId.toLowerCase()}_voice_sample.mp4`);
  ensureDir(path.dirname(outputPath));
  const pingpong = options.pingpong === true;
  const environmentPath = options.environment ? path.resolve(options.environment) : null;
  const environmentReference = options.environmentReference
    ? path.resolve(options.environmentReference)
    : environmentPath;
  if (environmentPath && !fs.existsSync(environmentPath)) {
    throw new Error(`Environment plate not found: ${environmentPath}`);
  }
  const inputArgs = pingpong
    ? ["-i", motionPath]
    : ["-stream_loop", "-1", "-i", motionPath];
  if (environmentPath) {
    inputArgs.push("-loop", "1", "-i", environmentPath);
  }
  const audioInputIndex = environmentPath ? 2 : 1;
  const width = Number(options.width || 1280);
  const height = Number(options.height || 720);
  const fps = Number(options.fps || 24);
  const videoArgs = environmentPath
    ? (() => {
        const chromaColor = String(options.chromaColor || "0xff00ff");
        const similarity = Number(options.chromaSimilarity || 0.14);
        const blend = Number(options.chromaBlend || 0.06);
        const composite = `[0:v]colorkey=${chromaColor}:${similarity}:${blend},scale=${width}:${height}[character];[1:v]scale=${width}:${height}[environment];[environment][character]overlay=0:0:shortest=1[composite]`;
        const tracking = options.cameraTrack
          ? `;[composite]scale=${width + 64}:${height + 36},crop=${width}:${height}:x='min(n*0.65,64)':y=18,fps=${fps}[video]`
          : `;[composite]fps=${fps}[video]`;
        return ["-filter_complex", `${composite}${tracking}`, "-map", "[video]"];
      })()
    : pingpong
    ? (() => {
        const base = "[0:v]split=2[forward][reverse_input];[reverse_input]reverse[reverse];[forward][reverse]concat=n=2:v=1:a=0[performance]";
        const camera = options.cameraPush
          ? `;[performance]zoompan=z='min(1+0.0012*on,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps}[video]`
          : ";[performance]null[video]";
        return ["-filter_complex", `${base}${camera}`, "-map", "[video]"];
      })()
    : options.cameraTrack
      ? [
          "-filter_complex",
          `[0:v]scale=${Number(options.width || 1280) + 64}:${Number(options.height || 720) + 36},crop=${Number(options.width || 1280)}:${Number(options.height || 720)}:x='min(n*0.65,64)':y=18,fps=${Number(options.fps || 24)}[video]`,
          "-map",
          "[video]"
        ]
      : ["-map", "0:v:0"];
  const result = spawnSync(resolveFfmpegPath(), [
    "-y",
    ...inputArgs,
    "-i",
    voicePath,
    ...videoArgs,
    "-map",
    `${audioInputIndex}:a:0`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "Scene sample assembly failed.");
  }

  const manifestPath = path.join(outputDir, "scene_sample_manifest.json");
  writeJson(manifestPath, {
    story_id: storyId,
    micro_scene_id: microSceneId,
    generated_at: new Date().toISOString(),
    character_frame: proof?.input_path || null,
    motion_clip: motionPath,
    voice_file: voicePath,
    voice_text: voiceSegment.text,
    output_file: outputPath,
    lip_sync: false,
    assembly_mode: pingpong ? "forward_reverse" : "loop",
    camera_push: options.cameraPush === true,
    camera_track: options.cameraTrack === true,
    environment_plate: environmentReference,
    notes: pingpong
      ? "The GTX 1080 motion pass plays forward and backward once under the voice segment."
      : "The short GTX 1080 proof motion is looped to the voice segment duration."
  });
  console.log(`Scene sample created at ${outputPath}`);
  console.log(`Scene sample manifest written to ${manifestPath}`);
  return { outputPath, manifestPath };
}

if (require.main === module) {
  try {
    finishSceneSample(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  finishSceneSample
};
