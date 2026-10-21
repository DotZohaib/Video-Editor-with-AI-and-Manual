/**
 * Media import service ï¿½ handles file reading, thumbnail generation,
 * waveform extraction, and IndexedDB persistence.
 * All media stays local; nothing is uploaded to external services.
 */
import { MediaAsset, MediaKind, MediaMeta } from "@/types/project";
import { generateId } from "./ids";
import { saveMediaFile } from "./idb";
import { registerMediaBlob } from "./media-cache";

// ---------------------------------------------------------------------------
// Type detection
// ---------------------------------------------------------------------------

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/avi"];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/aac", "audio/flac", "audio/x-wav"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
const SUBTITLE_TYPES = ["text/plain", "application/x-subrip"];

const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"];
const AUDIO_EXTS = [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"];
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
const SUBTITLE_EXTS = [".srt", ".vtt", ".ass"];

function detectMediaKind(file: File): MediaKind {
  const mt = file.type.toLowerCase();
  const ext = ("." + file.name.split(".").pop()).toLowerCase();

  if (VIDEO_TYPES.includes(mt) || VIDEO_EXTS.includes(ext)) return "video";
  if (AUDIO_TYPES.includes(mt) || AUDIO_EXTS.includes(ext)) return "audio";
  if (IMAGE_TYPES.includes(mt) || IMAGE_EXTS.includes(ext)) return "image";
  if (SUBTITLE_TYPES.includes(mt) || SUBTITLE_EXTS.includes(ext)) return "subtitle";

  throw new Error(`Unsupported file type: ${file.type || ext}`);
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

async function getVideoMeta(file: File): Promise<{ meta: MediaMeta; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      // Seek to 10% for thumbnail
      video.currentTime = Math.min(video.duration * 0.1, 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const w = Math.min(video.videoWidth || 320, 320);
      const h = video.videoHeight ? Math.round(w * (video.videoHeight / video.videoWidth)) : 180;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(video, 0, 0, w, h);
      const thumbnail = canvas.toDataURL("image/jpeg", 0.7);

      cleanup();
      resolve({
        meta: {
          duration: video.duration,
          width: video.videoWidth || undefined,
          height: video.videoHeight || undefined,
          size: file.size,
        },
        thumbnail,
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video metadata"));
    };

    setTimeout(() => {
      cleanup();
      reject(new Error("Video metadata load timeout"));
    }, 15000);
  });
}

async function getAudioMeta(file: File): Promise<{ meta: MediaMeta; waveformPeaks: number[] }> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.preload = "metadata";

    audio.onloadedmetadata = async () => {
      URL.revokeObjectURL(url);
      const meta: MediaMeta = {
        duration: audio.duration,
        size: file.size,
      };

      // Generate simple waveform peaks from audio data
      let peaks: number[] = [];
      try {
        peaks = await generateWaveformPeaks(file, 100);
      } catch {
        peaks = new Array(100).fill(0).map(() => Math.random());
      }

      resolve({ meta, waveformPeaks: peaks });
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load audio metadata"));
    };

    setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Audio metadata load timeout"));
    }, 10000);
  });
}

async function generateWaveformPeaks(file: File, numPeaks: number): Promise<number[]> {
  const audioCtx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(channelData[start + j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  return peaks;
}

async function getImageMeta(file: File): Promise<{ meta: MediaMeta; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = Math.min(img.width, 320);
      const h = Math.round(w * (img.height / img.width));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, w, h);
      const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
      URL.revokeObjectURL(url);
      resolve({
        meta: { width: img.width, height: img.height, size: file.size },
        thumbnail,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
  });
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

export interface ImportResult {
  asset: MediaAsset;
  objectUrl?: string;
}

export async function importMediaFile(file: File): Promise<ImportResult> {
  const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
  if (file.size > MAX_SIZE) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024 / 1024).toFixed(1)}GB (max 2GB)`);
  }

  const kind = detectMediaKind(file);
  const assetId = generateId("asset");

  // Cache blob directly in memory for instantaneous zero-latency playback & preview
  const objectUrl = registerMediaBlob(assetId, file);

  // Save blob to IndexedDB for offline persistence across refreshes
  const idbKey = await saveMediaFile(assetId, file);

  let meta: MediaMeta = { size: file.size };
  let thumbnailDataUrl: string | undefined;
  let waveformPeaks: number[] | undefined;

  if (kind === "video") {
    try {
      const result = await getVideoMeta(file);
      meta = result.meta;
      thumbnailDataUrl = result.thumbnail;
    } catch (e) {
      console.warn("Could not extract video metadata:", e);
      meta = { size: file.size };
    }
  } else if (kind === "audio") {
    try {
      const result = await getAudioMeta(file);
      meta = result.meta;
      waveformPeaks = result.waveformPeaks;
    } catch (e) {
      console.warn("Could not extract audio metadata:", e);
    }
  } else if (kind === "image") {
    try {
      const result = await getImageMeta(file);
      meta = result.meta;
      thumbnailDataUrl = result.thumbnail;
    } catch (e) {
      console.warn("Could not extract image metadata:", e);
    }
  }

  const asset: MediaAsset = {
    id: assetId,
    name: file.name.replace(/\.[^.]+$/, ""),
    kind,
    idbKey,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    thumbnailDataUrl,
    waveformPeaks,
    meta,
    importedAt: Date.now(),
  };

  return { asset, objectUrl };
}

// ---------------------------------------------------------------------------
// Restore a media file blob URL from IDB
// ---------------------------------------------------------------------------

import { loadMediaFile } from "./idb";

export async function getMediaObjectUrl(idbKey: string): Promise<string | null> {
  const blob = await loadMediaFile(idbKey);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export function releaseObjectUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {}
}
