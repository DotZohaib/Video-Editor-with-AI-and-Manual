export * from "./time";
/**
 * Pure utility functions for project operations.
 * No side effects ï¿½ all functions return new objects.
 */
import {
  Project, Track, Clip, VideoClip, AudioClip, ImageClip, TextClip,
  MediaAsset, Caption, ID, Seconds,
  DEFAULT_TRANSFORM, DEFAULT_AUDIO, DEFAULT_COLOR, DEFAULT_CAPTION_STYLE,
  PROJECT_SCHEMA_VERSION, DEFAULT_EXPORT_SETTINGS, TrackKind,
} from "@/types/project";
import { generateId } from "./ids";
// ---------------------------------------------------------------------------
// Project Factory
// ---------------------------------------------------------------------------

export function createProject(name: string): Project {
  const now = Date.now();
  const id = generateId("proj");

  const videoTrack: Track = {
    id: generateId("track"),
    kind: "video", name: "Video 1",
    order: 0, locked: false, visible: true,
    muted: false, solo: false, height: 80,
  };
  const audioTrack: Track = {
    id: generateId("track"),
    kind: "audio", name: "Audio 1",
    order: 1, locked: false, visible: true,
    muted: false, solo: false, height: 60,
  };
  const textTrack: Track = {
    id: generateId("track"),
    kind: "text", name: "Captions",
    order: 2, locked: false, visible: true,
    muted: false, solo: false, height: 40,
  };

  return {
    id,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    settings: {
      name, frameRate: 30, width: 1920, height: 1080,
      aspectRatio: "16:9", backgroundColor: "#000000", duration: 0,
    },
    tracks: [videoTrack, audioTrack, textTrack],
    clips: [],
    captions: [],
    transitions: [],
    assets: [],
    exportSettings: { ...DEFAULT_EXPORT_SETTINGS, fileName: name },
    createdAt: now, updatedAt: now,
  };
}

export function addTrack(project: Project, kind: TrackKind, name: string): Project {
  const order = project.tracks.length;
  const track: Track = {
    id: generateId("track"),
    kind, name, order,
    locked: false, visible: true, muted: false, solo: false,
    height: kind === "video" ? 80 : kind === "audio" ? 60 : 40,
  };
  return { ...project, tracks: [...project.tracks, track], updatedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Project Duration
// ---------------------------------------------------------------------------

export function computeProjectDuration(clips: Clip[]): Seconds {
  if (clips.length === 0) return 0;
  return Math.max(...clips.map((c) => c.timelineStart + c.timelineDuration));
}

// ---------------------------------------------------------------------------
// Clip Creation
// ---------------------------------------------------------------------------

export function createVideoClip(
  asset: MediaAsset,
  trackId: ID,
  timelineStart: Seconds,
): VideoClip {
  const duration = asset.meta.duration ?? 5;
  return {
    id: generateId("clip"),
    kind: "video",
    trackId,
    assetId: asset.id,
    timelineStart,
    timelineDuration: duration,
    speed: 1,
    sourceStart: 0,
    sourceEnd: duration,
    transform: { ...DEFAULT_TRANSFORM },
    audio: { ...DEFAULT_AUDIO },
    color: { ...DEFAULT_COLOR },
    label: asset.name,
  };
}

export function createAudioClip(
  asset: MediaAsset,
  trackId: ID,
  timelineStart: Seconds,
): AudioClip {
  const duration = asset.meta.duration ?? 5;
  return {
    id: generateId("clip"),
    kind: "audio",
    trackId,
    assetId: asset.id,
    timelineStart,
    timelineDuration: duration,
    speed: 1,
    sourceStart: 0,
    sourceEnd: duration,
    audio: { ...DEFAULT_AUDIO },
    label: asset.name,
  };
}

export function createImageClip(
  asset: MediaAsset,
  trackId: ID,
  timelineStart: Seconds,
): ImageClip {
  return {
    id: generateId("clip"),
    kind: "image",
    trackId,
    assetId: asset.id,
    timelineStart,
    timelineDuration: 5,
    speed: 1,
    transform: { ...DEFAULT_TRANSFORM },
    label: asset.name,
  };
}

export function createTextClip(trackId: ID, timelineStart: Seconds): TextClip {
  return {
    id: generateId("clip"),
    kind: "text",
    trackId,
    timelineStart,
    timelineDuration: 5,
    speed: 1,
    text: "New Text",
    style: { ...DEFAULT_CAPTION_STYLE },
    transform: { ...DEFAULT_TRANSFORM },
    entranceAnimation: "fadeIn",
    exitAnimation: "fadeOut",
  };
}

// ---------------------------------------------------------------------------
// Clip Operations
// ---------------------------------------------------------------------------

export function splitClip(clips: Clip[], clipId: ID, splitTime: Seconds): Clip[] {
  const idx = clips.findIndex((c) => c.id === clipId);
  if (idx === -1) return clips;
  const clip = clips[idx];

  const splitPoint = splitTime - clip.timelineStart;
  if (splitPoint <= 0 || splitPoint >= clip.timelineDuration) return clips;

  const leftDuration = splitPoint;
  const rightDuration = clip.timelineDuration - splitPoint;

  const left: Clip = {
    ...clip,
    timelineDuration: leftDuration,
    // adjust source end for media clips
    ...(() => {
      if (clip.kind === "video" || clip.kind === "audio") {
        return { sourceEnd: clip.sourceStart + leftDuration * clip.speed };
      }
      return {};
    })(),
  } as Clip;

  const right: Clip = {
    ...clip,
    id: generateId("clip"),
    timelineStart: splitTime,
    timelineDuration: rightDuration,
    ...(() => {
      if (clip.kind === "video" || clip.kind === "audio") {
        const leftEnd = clip.sourceStart + leftDuration * clip.speed;
        return { sourceStart: leftEnd, sourceEnd: clip.sourceStart + clip.timelineDuration * clip.speed };
      }
      return {};
    })(),
  } as Clip;

  const newClips = [...clips];
  newClips.splice(idx, 1, left, right);
  return newClips;
}

export function trimClip(
  clip: Clip,
  edge: "start" | "end",
  newTime: Seconds,
): Clip {
  if (edge === "start") {
    const delta = newTime - clip.timelineStart;
    const newDuration = clip.timelineDuration - delta;
    if (newDuration <= 0.1) return clip;
    const updated: Clip = {
      ...clip,
      timelineStart: newTime,
      timelineDuration: newDuration,
    };
    if (updated.kind === "video" || updated.kind === "audio") {
      (updated as VideoClip | AudioClip).sourceStart =
        (clip as VideoClip | AudioClip).sourceStart + delta * clip.speed;
    }
    return updated;
  } else {
    const newDuration = newTime - clip.timelineStart;
    if (newDuration <= 0.1) return clip;
    const updated: Clip = { ...clip, timelineDuration: newDuration };
    if (updated.kind === "video" || updated.kind === "audio") {
      (updated as VideoClip | AudioClip).sourceEnd =
        (clip as VideoClip | AudioClip).sourceStart + newDuration * clip.speed;
    }
    return updated;
  }
}

export function moveClip(clip: Clip, newStart: Seconds): Clip {
  return { ...clip, timelineStart: Math.max(0, newStart) };
}

export function deleteClip(clips: Clip[], clipId: ID): Clip[] {
  return clips.filter((c) => c.id !== clipId);
}

export function duplicateClip(clips: Clip[], clipId: ID): Clip[] {
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return clips;
  const copy: Clip = {
    ...clip,
    id: generateId("clip"),
    timelineStart: clip.timelineStart + clip.timelineDuration + 0.1,
  } as Clip;
  return [...clips, copy];
}

// ---------------------------------------------------------------------------
// Clip sorting helpers
// ---------------------------------------------------------------------------

export function getClipsForTrack(clips: Clip[], trackId: ID): Clip[] {
  return clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.timelineStart - b.timelineStart);
}

export function detectClipOverlap(clips: Clip[]): boolean {
  const trackGroups = new Map<string, Clip[]>();
  for (const clip of clips) {
    const g = trackGroups.get(clip.trackId) ?? [];
    g.push(clip);
    trackGroups.set(clip.trackId, g);
  }
  for (const group of trackGroups.values()) {
    const sorted = [...group].sort((a, b) => a.timelineStart - b.timelineStart);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a.timelineStart + a.timelineDuration > b.timelineStart + 0.001) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Snap
// ---------------------------------------------------------------------------

const SNAP_THRESHOLD_SECS = 0.1;

export function snapToNearestBoundary(
  time: Seconds,
  clips: Clip[],
  excludeId?: ID,
): Seconds {
  const boundaries: Seconds[] = [0];
  for (const clip of clips) {
    if (clip.id === excludeId) continue;
    boundaries.push(clip.timelineStart, clip.timelineStart + clip.timelineDuration);
  }
  let best = time;
  let bestDist = SNAP_THRESHOLD_SECS;
  for (const b of boundaries) {
    const dist = Math.abs(b - time);
    if (dist < bestDist) { bestDist = dist; best = b; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Project Schema Migration
// ---------------------------------------------------------------------------

export function migrateProject(raw: unknown): Project | null {
  try {
    const obj = raw as Partial<Project>;
    if (!obj || typeof obj !== "object") return null;
    if (!obj.id || !obj.settings) return null;
    // Future: handle schema version differences here
    return obj as Project;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Caption creation
// ---------------------------------------------------------------------------

export function createCaption(
  text: string,
  startTime: Seconds,
  endTime: Seconds,
  language = "en",
): Caption {
  return {
    id: generateId("cap"),
    startTime, endTime, text, language,
    style: { ...DEFAULT_CAPTION_STYLE },
  };
}

// ---------------------------------------------------------------------------
// SRT Parse / Export
// ---------------------------------------------------------------------------

export function parseSRT(srt: string): Array<{ index: number; start: Seconds; end: Seconds; text: string }> {
  const blocks = srt.trim().split(/\n\n+/);
  const result = [];

  function parseTimecode(tc: string): Seconds {
    const [time, ms] = tc.split(",");
    const [h, m, s] = time.split(":").map(Number);
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
  }

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const index = parseInt(lines[0]);
    const timeParts = lines[1].split(" --> ");
    if (timeParts.length !== 2) continue;
    const start = parseTimecode(timeParts[0].trim());
    const end = parseTimecode(timeParts[1].trim());
    const text = lines.slice(2).join("\n");
    result.push({ index, start, end, text });
  }
  return result;
}

export function exportSRT(captions: Caption[]): string {
  function formatTC(secs: Seconds): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.round((secs % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  }
  return captions
    .sort((a, b) => a.startTime - b.startTime)
    .map((cap, i) =>
      `${i + 1}\n${formatTC(cap.startTime)} --> ${formatTC(cap.endTime)}\n${cap.text}`
    )
    .join("\n\n");
}



