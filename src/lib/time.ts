import { Seconds } from "@/types/project";

/** Format seconds as MM:SS */
export function formatTime(secs: Seconds): string {
  const s = Math.max(0, secs);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Format seconds as HH:MM:SS.mmm */
export function formatTimecode(secs: Seconds): string {
  const s = Math.max(0, secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

/** Parse "HH:MM:SS" or "MM:SS" to seconds */
export function parseTime(str: string): Seconds {
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Convert pixel offset to seconds given zoom */
export function pixelsToSeconds(px: number, zoom: number): Seconds {
  return px / zoom;
}

/** Convert seconds to pixel offset given zoom */
export function secondsToPixels(secs: Seconds, zoom: number): number {
  return secs * zoom;
}
