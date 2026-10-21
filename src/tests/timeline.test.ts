import { describe, it, expect } from "vitest";
import { formatTime, formatTimecode, parseTime } from "@/lib/time";
import {
  computeProjectDuration,
  splitClip,
  trimClip,
  moveClip,
  snapToNearestBoundary,
} from "@/lib/project-utils";
import { VideoClip, DEFAULT_TRANSFORM, DEFAULT_AUDIO, DEFAULT_COLOR, Clip } from "@/types/project";

describe("Timeline Calculations & Clip Operations", () => {
  it("formats seconds to MM:SS correctly", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3600)).toBe("60:00");
  });

  it("formats timecode to HH:MM:SS.mmm", () => {
    expect(formatTimecode(0)).toBe("00:00:00.000");
    expect(formatTimecode(3661.5)).toBe("01:01:01.500");
  });

  it("parses time strings to seconds", () => {
    expect(parseTime("01:30")).toBe(90);
    expect(parseTime("01:00:00")).toBe(3600);
  });

  it("computes project duration from clips", () => {
    const mockClips = [
      { id: "c1", trackId: "t1", kind: "video", speed: 1, timelineStart: 0, timelineDuration: 5 } as unknown as Clip,
      { id: "c2", trackId: "t1", kind: "video", speed: 1, timelineStart: 4, timelineDuration: 6 } as unknown as Clip,
    ];
    expect(computeProjectDuration(mockClips)).toBe(10);
  });

  it("splits a clip accurately at playhead position", () => {
    const original: VideoClip = {
      id: "clip_1",
      kind: "video",
      trackId: "track_1",
      assetId: "asset_1",
      timelineStart: 2,
      timelineDuration: 8,
      speed: 1,
      sourceStart: 0,
      sourceEnd: 8,
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO },
      color: { ...DEFAULT_COLOR },
    };

    // Split at 6s on timeline (4s into clip)
    const result = splitClip([original], "clip_1", 6);
    expect(result.length).toBe(2);

    const [left, right] = result as VideoClip[];
    expect(left.timelineStart).toBe(2);
    expect(left.timelineDuration).toBe(4);
    expect(left.sourceEnd).toBe(4);

    expect(right.timelineStart).toBe(6);
    expect(right.timelineDuration).toBe(4);
    expect(right.sourceStart).toBe(4);
    expect(right.sourceEnd).toBe(8);
  });

  it("does not split if playhead is outside the clip", () => {
    const clip: VideoClip = {
      id: "clip_1",
      kind: "video",
      trackId: "track_1",
      assetId: "asset_1",
      timelineStart: 2,
      timelineDuration: 5,
      speed: 1,
      sourceStart: 0,
      sourceEnd: 5,
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO },
      color: { ...DEFAULT_COLOR },
    };

    const before = splitClip([clip], "clip_1", 1);
    expect(before.length).toBe(1);

    const after = splitClip([clip], "clip_1", 10);
    expect(after.length).toBe(1);
  });

  it("trims clip start and end correctly", () => {
    const clip: VideoClip = {
      id: "clip_1",
      kind: "video",
      trackId: "track_1",
      assetId: "asset_1",
      timelineStart: 2,
      timelineDuration: 8,
      speed: 1,
      sourceStart: 0,
      sourceEnd: 8,
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO },
      color: { ...DEFAULT_COLOR },
    };

    const trimmedStart = trimClip(clip, "start", 4) as VideoClip;
    expect(trimmedStart.timelineStart).toBe(4);
    expect(trimmedStart.timelineDuration).toBe(6);
    expect(trimmedStart.sourceStart).toBe(2);

    const trimmedEnd = trimClip(clip, "end", 7) as VideoClip;
    expect(trimmedEnd.timelineStart).toBe(2);
    expect(trimmedEnd.timelineDuration).toBe(5);
    expect(trimmedEnd.sourceEnd).toBe(5);
  });

  it("moves clip to new timeline position", () => {
    const clip: VideoClip = {
      id: "clip_1",
      kind: "video",
      trackId: "track_1",
      assetId: "asset_1",
      timelineStart: 2,
      timelineDuration: 5,
      speed: 1,
      sourceStart: 0,
      sourceEnd: 5,
      transform: { ...DEFAULT_TRANSFORM },
      audio: { ...DEFAULT_AUDIO },
      color: { ...DEFAULT_COLOR },
    };

    const moved = moveClip(clip, 8);
    expect(moved.timelineStart).toBe(8);
  });

  it("snaps to nearest clip boundary within threshold", () => {
    const clips = [
      { id: "c1", trackId: "t1", kind: "video", speed: 1, timelineStart: 0, timelineDuration: 5 } as unknown as Clip,
      { id: "c2", trackId: "t1", kind: "video", speed: 1, timelineStart: 10, timelineDuration: 5 } as unknown as Clip,
    ];

    // Close to 5 (4.95) -> should snap to 5
    expect(snapToNearestBoundary(4.95, clips, "c3")).toBe(5);
    // Close to 10 (10.05) -> should snap to 10
    expect(snapToNearestBoundary(10.05, clips, "c3")).toBe(10);
    // Far from boundary (7.5) -> should stay 7.5
    expect(snapToNearestBoundary(7.5, clips, "c3")).toBe(7.5);
  });
});