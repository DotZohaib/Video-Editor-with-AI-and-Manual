/**
 * FFmpeg/WASM rendering engine.
 * Converts the project timeline into actual FFmpeg commands.
 * Runs in-browser; no files are sent to any server.
 */
import {
  Project, VideoClip, AudioClip, ImageClip, Caption,
  ExportSettings, ExportProgress,
} from "@/types/project";
import { loadMediaFile } from "./idb";

export interface IFFmpeg {
  load: (config: { coreURL: string; wasmURL: string }) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
  deleteFile: (path: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  on: (event: string, callback: (data: { progress: number; time: number }) => void) => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface WindowWithFFmpeg extends Window {
  FFmpegWASM?: {
    FFmpeg: new () => IFFmpeg;
  };
}

let _ffmpegInstance: IFFmpeg | null = null;
let _isLoaded = false;

// Helper to convert remote or local URLs to Object URLs with proper MIME types
async function toBlobURL(url: string, mimeType: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
  const buf = await resp.arrayBuffer();
  const blob = new Blob([buf], { type: mimeType });
  return URL.createObjectURL(blob);
}

// Load FFmpeg UMD script dynamically into the browser document
async function ensureFFmpegLoaded(): Promise<IFFmpeg> {
  if (typeof window === "undefined") {
    throw new Error("FFmpeg can only be initialized in the browser");
  }

  const win = window as unknown as WindowWithFFmpeg;
  if (!win.FFmpegWASM?.FFmpeg) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[src="/ffmpeg/ffmpeg.js"]');
      if (existing) {
        if (win.FFmpegWASM?.FFmpeg) {
          resolve();
        } else {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Failed to load FFmpeg script")));
        }
        return;
      }
      const script = document.createElement("script");
      script.src = "/ffmpeg/ffmpeg.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load /ffmpeg/ffmpeg.js"));
      document.head.appendChild(script);
    });
  }

  const FFmpegClass = win.FFmpegWASM?.FFmpeg;
  if (!FFmpegClass) {
    throw new Error("FFmpeg library was not found in browser global scope.");
  }

  if (_ffmpegInstance && _isLoaded) return _ffmpegInstance;

  _ffmpegInstance = new FFmpegClass();

  // Load core files from unpkg or local CDN
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await _ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  _isLoaded = true;
  return _ffmpegInstance;
}

// ---------------------------------------------------------------------------
// Export pipeline
// ---------------------------------------------------------------------------

export type ProgressCallback = (progress: Partial<ExportProgress>) => void;

export async function renderProject(
  project: Project,
  exportSettings: ExportSettings,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<Blob> {
  onProgress({ status: "preparing", progress: 0, message: "Loading media processing engine..." });

  let ffmpeg: IFFmpeg;
  try {
    ffmpeg = await ensureFFmpegLoaded();
  } catch (e) {
    throw new Error(
      `Failed to load FFmpeg WASM: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (signal?.aborted) throw new Error("Export cancelled");
  onProgress({ status: "preparing", progress: 5, message: "Loading media files..." });

  const { clips, captions } = project;
  const videoClips = clips.filter((c): c is VideoClip => c.kind === "video")
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const audioClips = clips.filter((c): c is AudioClip => c.kind === "audio")
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const imageClips = clips.filter((c): c is ImageClip => c.kind === "image");

  const assetMap = new Map(project.assets.map((a) => [a.id, a]));

  // Write all needed media to FFmpeg virtual FS
  let fileCount = 0;
  const totalFiles = Math.max(videoClips.length + audioClips.length + imageClips.length, 1);

  async function writeAsset(assetId: string, filename: string): Promise<boolean> {
    const asset = assetMap.get(assetId);
    if (!asset) return false;
    const blob = await loadMediaFile(asset.idbKey);
    if (!blob) return false;
    const data = await blob.arrayBuffer();
    await ffmpeg.writeFile(filename, new Uint8Array(data));
    fileCount++;
    onProgress({
      progress: 5 + Math.round((fileCount / totalFiles) * 20),
      message: `Loading media: ${asset.name}`,
    });
    return true;
  }

  // Write video files
  for (let i = 0; i < videoClips.length; i++) {
    if (signal?.aborted) throw new Error("Export cancelled");
    await writeAsset(videoClips[i].assetId, `video_${i}.mp4`);
  }

  // Write audio files
  for (let i = 0; i < audioClips.length; i++) {
    if (signal?.aborted) throw new Error("Export cancelled");
    await writeAsset(audioClips[i].assetId, `audio_${i}.mp3`);
  }

  onProgress({ status: "processing", progress: 30, message: "Building filter graph..." });

  if (signal?.aborted) throw new Error("Export cancelled");

  const w = exportSettings.width;
  const h = exportSettings.height;
  const fps = exportSettings.frameRate;
  const projectDuration = Math.max(project.settings.duration, 1);

  // Build FFmpeg filter complex
  const filterParts: string[] = [];
  const inputs: string[] = [];

  let inputIdx = 0;

  // Video clips
  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    inputs.push(`-i video_${i}.mp4`);
    const vIdx = inputIdx++;
    const startOffset = clip.sourceStart;
    const dur = clip.timelineDuration;
    const speed = clip.speed !== 1 ? `,setpts=${1/clip.speed}*PTS` : "";
    const vol = clip.audio.volume !== 1 ? `,volume=${clip.audio.volume}` : "";
    const opacity = clip.transform.opacity !== 1 ? `,colorchannelmixer=aa=${clip.transform.opacity}` : "";

    filterParts.push(
      `[${vIdx}:v]trim=start=${startOffset}:duration=${dur},setpts=PTS-STARTPTS${speed}` +
      `,scale=${w}:${h}:force_original_aspect_ratio=decrease` +
      `,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2${opacity}[v${i}]`
    );
    if (!clip.audio.muted) {
      filterParts.push(`[${vIdx}:a]atrim=start=${startOffset}:duration=${dur},asetpts=PTS-STARTPTS${vol}[va${i}]`);
    }
  }

  // Audio clips
  for (let i = 0; i < audioClips.length; i++) {
    const clip = audioClips[i];
    inputs.push(`-i audio_${i}.mp3`);
    const aIdx = inputIdx++;
    const dur = clip.timelineDuration;
    const vol = clip.audio.volume !== 1 ? `,volume=${clip.audio.volume}` : "";
    filterParts.push(`[${aIdx}:a]atrim=duration=${dur},asetpts=PTS-STARTPTS${vol}[a${i}]`);
  }

  // Black background for timeline base
  filterParts.push(
    `color=c=black:size=${w}x${h}:rate=${fps}:duration=${projectDuration}[bg]`
  );

  // Overlay video clips onto timeline
  let currentOverlay = "bg";
  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const nextLabel = i < videoClips.length - 1 ? `ov${i}` : "vout";
    filterParts.push(
      `[${currentOverlay}][v${i}]overlay=x=(W-w)/2:y=(H-h)/2:enable='between(t,${clip.timelineStart},${clip.timelineStart + clip.timelineDuration})'[${nextLabel}]`
    );
    currentOverlay = nextLabel;
  }

  if (videoClips.length === 0) {
    filterParts.push(`[bg]copy[vout]`);
  }

  // Mix audio streams
  const audioSources: string[] = [];
  for (let i = 0; i < videoClips.length; i++) {
    if (!videoClips[i].audio.muted) {
      const delay = Math.round(videoClips[i].timelineStart * 1000);
      filterParts.push(`[va${i}]adelay=${delay}|${delay}[vad${i}]`);
      audioSources.push(`[vad${i}]`);
    }
  }
  for (let i = 0; i < audioClips.length; i++) {
    const delay = Math.round(audioClips[i].timelineStart * 1000);
    filterParts.push(`[a${i}]adelay=${delay}|${delay}[ad${i}]`);
    audioSources.push(`[ad${i}]`);
  }

  const audioFilterResult = "aout";
  if (audioSources.length > 0) {
    filterParts.push(`${audioSources.join("")}amix=inputs=${audioSources.length}:normalize=0[aout]`);
  } else {
    filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100[aout]`);
  }

  // Subtitles (burn-in via drawtext or SRT)
  let videoOutput = "vout";
  if (exportSettings.burnSubtitles && captions.length > 0) {
    const srtContent = generateSRT(captions);
    const srtBytes = new TextEncoder().encode(srtContent);
    await ffmpeg.writeFile("subs.srt", srtBytes);
    filterParts.push(`[vout]subtitles=subs.srt[vfinal]`);
    videoOutput = "vfinal";
  }

  onProgress({ status: "encoding", progress: 50, message: "Encoding video..." });

  // Build FFmpeg command
  const filterComplex = filterParts.join(";");
  const outputFile = `output.${exportSettings.format}`;

  const qualityMap = {
    low: "28", medium: "23", high: "18", lossless: "0",
  };
  const crf = qualityMap[exportSettings.quality];

  const cmd = [
    ...inputs.flatMap((i) => i.split(" ")),
    "-filter_complex", filterComplex,
    "-map", `[${videoOutput}]`,
    "-map", `[${audioFilterResult}]`,
    "-c:v", exportSettings.videoCodec === "h264" ? "libx264" : exportSettings.videoCodec === "vp9" ? "libvpx-vp9" : "libx264",
    "-crf", crf,
    "-c:a", exportSettings.audioCodec === "aac" ? "aac" : "libmp3lame",
    "-b:a", exportSettings.audioBitrate,
    "-t", projectDuration.toString(),
    "-movflags", "+faststart",
    outputFile,
  ];

  // Progress listener
  ffmpeg.on("progress", ({ progress }: { progress: number; time: number }) => {
    const pct = 50 + Math.round(progress * 45);
    onProgress({
      progress: Math.min(95, pct),
      message: `Encoding: ${Math.round(progress * 100)}%`,
    });
  });

  try {
    await ffmpeg.exec(cmd);
  } catch (e) {
    throw new Error(`FFmpeg encoding failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  onProgress({ progress: 97, message: "Reading output file..." });

  const data = await ffmpeg.readFile(outputFile);
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  };
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeTypes[exportSettings.format] ?? "video/mp4" });

  // Cleanup temporary files
  try { await ffmpeg.deleteFile(outputFile); } catch {}
  for (let i = 0; i < videoClips.length; i++) {
    try { await ffmpeg.deleteFile(`video_${i}.mp4`); } catch {}
  }
  for (let i = 0; i < audioClips.length; i++) {
    try { await ffmpeg.deleteFile(`audio_${i}.mp3`); } catch {}
  }

  onProgress({ status: "done", progress: 100, message: "Export complete!" });

  return blob;
}

function generateSRT(captions: Caption[]): string {
  function tc(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
  }
  return captions
    .sort((a, b) => a.startTime - b.startTime)
    .map((c, i) => `${i+1}\n${tc(c.startTime)} --> ${tc(c.endTime)}\n${c.text}`)
    .join("\n\n");
}

