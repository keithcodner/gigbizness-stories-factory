const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadVisualGenerationConfig } = require("./workflowContracts");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createPlaceholderImage(outputPath, width, height, label) {
  ensureDir(path.dirname(outputPath));
  const filter = [
    `color=c=0xD9E6F2:s=${width}x${height}`,
    `drawbox=x=20:y=20:w=${Math.max(120, width - 40)}:h=${Math.max(120, height - 40)}:color=0x2D4F6C:t=8`,
    `drawtext=text='${String(label || "preview").replace(/[:'\\]/g, "")}':fontcolor=0x2D4F6C:fontsize=${Math.max(24, Math.round(width / 24))}:x=(w-text_w)/2:y=(h-text_h)/2`
  ].join(",");
  const result = spawnSync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    filter,
    "-frames:v",
    "1",
    outputPath
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to create placeholder image at ${outputPath}`);
  }
}

function buildProviderResult(outputPath) {
  return {
    promptId: `local_${Date.now()}`,
    passResults: [
      {
        output_file: outputPath,
        status: "completed"
      }
    ],
    metrics: {
      fallback: true
    }
  };
}

function createProvider(providerName, providerConfig) {
  return {
    async renderCharacterReference({ outputPath, width, height }) {
      createPlaceholderImage(outputPath, width, height, "character ref");
      return buildProviderResult(outputPath);
    },
    async renderShotKeyframe({ outputPath, width, height, shotId }) {
      createPlaceholderImage(outputPath, width, height, shotId || "story frame");
      return buildProviderResult(outputPath);
    },
    providerName,
    providerConfig
  };
}

async function withImageProvider(_label, handler) {
  const config = loadVisualGenerationConfig();
  const providerName = process.env.BRICKTOON_IMAGE_PROVIDER || config.default_image_provider || "comfyui";
  const provider = createProvider(providerName, config);
  return handler(provider, providerName, config);
}

module.exports = {
  withImageProvider
};
