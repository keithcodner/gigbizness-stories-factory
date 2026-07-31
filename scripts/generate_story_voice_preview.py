import argparse
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path
from xml.sax.saxutils import escape


def load_json(path_value: str):
    with open(path_value, "r", encoding="utf8") as handle:
        return json.load(handle)


def run_command(command, label):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.stdout:
        sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stderr.write(result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"{label} failed")


def create_silent_wav(output_path: Path, duration_seconds: float, sample_rate: int = 48000):
    frame_count = max(1, int(sample_rate * duration_seconds))
    silence = b"\x00\x00" * frame_count
    with wave.open(str(output_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(silence)


def wav_duration_seconds(file_path: Path) -> float:
    with wave.open(str(file_path), "rb") as wav_file:
        return wav_file.getnframes() / float(wav_file.getframerate())


def query_selectable_voices():
    command = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        r"""
$names = @()
$probe = New-Object -ComObject SAPI.SpVoice
foreach ($voice in $probe.GetVoices()) {
  $names += $voice.GetDescription()
}
$names | ConvertTo-Json
"""
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        return []
    try:
        parsed = json.loads(result.stdout.strip() or "[]")
        if isinstance(parsed, list):
          return parsed
        if isinstance(parsed, str):
          return [parsed]
    except json.JSONDecodeError:
        return []
    return []


def select_voice(profile: dict, installed_voices: list[str]) -> str | None:
    for voice_name in profile.get("voice_preferences", []):
        match = next((installed for installed in installed_voices if installed.startswith(voice_name)), None)
        if match:
            return match
    return installed_voices[0] if installed_voices else None


def build_ssml(voice_name: str | None, profile: dict, text: str) -> str:
    safe_text = escape(text)
    rate = profile.get("rate", "0%")
    pitch = profile.get("pitch", "0%")
    voice_open = f"<voice name='{escape(voice_name)}'>" if voice_name else ""
    voice_close = "</voice>" if voice_name else ""
    return (
        "<speak version='1.0' xml:lang='en-US'>"
        f"{voice_open}<prosody rate='{escape(str(rate))}' pitch='{escape(str(pitch))}'>{safe_text}</prosody>{voice_close}"
        "</speak>"
    )

def build_sapi_xml(profile: dict, text: str) -> str:
    rate_percent = float(str(profile.get("rate", "0%")).replace("%", ""))
    pitch_percent = float(str(profile.get("pitch", "0%")).replace("%", ""))
    rate = max(-10, min(10, round(rate_percent / 10)))
    pitch = max(-10, min(10, round(pitch_percent / 5)))
    phrased = escape(text)
    phrased = phrased.replace("! ", "!<silence msec='170'/>")
    phrased = phrased.replace("? ", "?<silence msec='150'/>")
    phrased = phrased.replace(", ", ",<silence msec='75'/>")
    phrased = phrased.replace(". ", ".<silence msec='130'/>")
    return (
        "<sapi version='1.0'>"
        f"<pitch middle='{pitch:+d}'><rate speed='{rate:+d}'>{phrased}</rate></pitch>"
        "</sapi>"
    )


def synthesize_segments(jobs_path: Path):
    script = r"""
$ErrorActionPreference = 'Stop'
$jobs = Get-Content -LiteralPath $args[0] -Raw | ConvertFrom-Json
foreach ($job in $jobs) {
  $synth = New-Object -ComObject SAPI.SpVoice
  $stream = New-Object -ComObject SAPI.SpFileStream
  try {
    if ($job.voice_name) {
      $token = $synth.GetVoices() | Where-Object { $_.GetDescription() -eq $job.voice_name } | Select-Object -First 1
      if ($token) {
        $synth.Voice = $token
      }
    }
    $synth.Volume = [int]$job.volume
    $synth.Rate = [int]$job.rate
    $stream.Open($job.output_path, 3, $false)
    $synth.AudioOutputStream = $stream
    [void]$synth.Speak($job.sapi_xml, 8)
  } finally {
    try { $stream.Close() } catch {}
  }
}
"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ps1", mode="w", encoding="utf8") as handle:
        handle.write(script)
        script_path = Path(handle.name)
    try:
        run_command([
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_path),
            str(jobs_path)
        ], "powershell multi-voice synthesis")
    finally:
        if script_path.exists():
            script_path.unlink()


def concat_audio(files: list[Path], output_path: Path):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt", mode="w", encoding="utf8") as handle:
        for file_path in files:
            normalized = str(file_path).replace("\\", "/").replace("'", "'\\''")
            handle.write(f"file '{normalized}'\n")
        concat_path = Path(handle.name)
    try:
        run_command([
            os.environ.get("FFMPEG_PATH", "ffmpeg"),
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
            str(output_path)
        ], "ffmpeg concat voice preview")
    finally:
        if concat_path.exists():
            concat_path.unlink()

def polish_voice_segment(file_path: Path):
    polished_path = file_path.with_name(f"{file_path.stem}_polished.wav")
    run_command([
        os.environ.get("FFMPEG_PATH", "ffmpeg"),
        "-y",
        "-i",
        str(file_path),
        "-af",
        "highpass=f=90,lowpass=f=10000,equalizer=f=2400:t=q:w=1:g=1.5,acompressor=threshold=-18dB:ratio=2:attack=15:release=120,alimiter=limit=0.95",
        "-ar",
        "48000",
        str(polished_path)
    ], f"polish voice segment {file_path.name}")
    os.replace(polished_path, file_path)


def normalize_audio(input_path: Path, output_path: Path):
    run_command([
        os.environ.get("FFMPEG_PATH", "ffmpeg"),
        "-y",
        "-i",
        str(input_path),
        "-af",
        "loudnorm=I=-14:LRA=7:TP=-1.5",
        "-ar",
        "48000",
        str(output_path)
    ], "ffmpeg normalize voice preview")


def main():
    parser = argparse.ArgumentParser(description="Generate a multi-voice preview package for a story package.")
    parser.add_argument("--package", required=True)
    args = parser.parse_args()

    package_path = Path(args.package).resolve()
    package_data = load_json(str(package_path))
    output_dir = package_path.parent
    voice_dir = output_dir / "voice_preview"
    segments_dir = voice_dir / "segments"
    os.makedirs(segments_dir, exist_ok=True)

    config_path = package_path.parents[3] / "config" / "story_voice_profiles.json"
    voice_config = load_json(str(config_path))
    installed_voices = query_selectable_voices()
    profiles = voice_config.get("profiles", {})

    jobs = []
    manifest_segments = []
    ordered_files: list[Path] = []
    current_start = 0.0

    for index, segment in enumerate(package_data.get("voice_segments", []), start=1):
        speaker = segment.get("speaker", "NARRATOR")
        cast_entry = package_data.get("voice_cast", {}).get(speaker, package_data.get("voice_cast", {}).get("NARRATOR", {}))
        profile_id = cast_entry.get("profile_id", voice_config.get("default_profile_id", "narrator_editorial"))
        profile = profiles.get(profile_id, profiles.get(voice_config.get("default_profile_id", "narrator_editorial"), {}))
        voice_name = select_voice(profile, installed_voices)
        file_path = segments_dir / f"{index:03d}_{speaker.lower().replace(' ', '_')}.wav"
        jobs.append({
            "voice_name": voice_name,
            "volume": int(profile.get("volume", 100)),
            "rate": max(-10, min(10, round(float(str(profile.get("rate", "0%")).replace("%", "")) / 10))),
            "output_path": str(file_path),
            "text": segment.get("text", ""),
            "sapi_xml": build_sapi_xml(profile, segment.get("text", ""))
        })

    jobs_path = voice_dir / "tts_jobs.json"
    with open(jobs_path, "w", encoding="utf8") as handle:
        json.dump(jobs, handle, indent=2)

    if jobs:
        synthesize_segments(jobs_path)
        for job in jobs:
            polish_voice_segment(Path(job["output_path"]))

    for index, segment in enumerate(package_data.get("voice_segments", []), start=1):
        speaker = segment.get("speaker", "NARRATOR")
        cast_entry = package_data.get("voice_cast", {}).get(speaker, package_data.get("voice_cast", {}).get("NARRATOR", {}))
        profile_id = cast_entry.get("profile_id", voice_config.get("default_profile_id", "narrator_editorial"))
        profile = profiles.get(profile_id, profiles.get(voice_config.get("default_profile_id", "narrator_editorial"), {}))
        voice_name = select_voice(profile, installed_voices)
        segment_path = segments_dir / f"{index:03d}_{speaker.lower().replace(' ', '_')}.wav"
        pause_path = segments_dir / f"{index:03d}_pause.wav"
        pause_seconds = 0.28 if segment.get("type") == "character_dialogue" else 0.36
        create_silent_wav(pause_path, pause_seconds)
        ordered_files.extend([segment_path, pause_path])
        duration = wav_duration_seconds(segment_path) if segment_path.exists() else 0.0
        manifest_segments.append({
            **segment,
            "voice_name": voice_name,
            "profile_id": profile_id,
            "file": str(segment_path.relative_to(output_dir)).replace("\\", "/"),
            "start_seconds": round(current_start, 2),
            "end_seconds": round(current_start + duration, 2),
            "actual_seconds": round(duration, 2)
        })
        current_start += duration + pause_seconds

    raw_output = voice_dir / "voice_preview_raw.wav"
    clean_output = voice_dir / "voice_preview_clean.wav"
    concat_audio(ordered_files, raw_output)
    normalize_audio(raw_output, clean_output)

    manifest = {
        "generated_at": package_data.get("generated_at"),
        "story_id": package_data.get("story_id"),
        "selectable_voices": installed_voices,
        "raw_output": str(raw_output.relative_to(output_dir)).replace("\\", "/"),
        "clean_output": str(clean_output.relative_to(output_dir)).replace("\\", "/"),
        "segments": manifest_segments
    }
    manifest_path = voice_dir / "voice_preview_manifest.json"
    with open(manifest_path, "w", encoding="utf8") as handle:
        json.dump(manifest, handle, indent=2)

    print(f"Voice preview created at {clean_output}")
    print(f"Voice preview manifest written to {manifest_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
