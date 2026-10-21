import { describe, it, expect } from "vitest";
import {
  createProject,
  migrateProject,
  parseSRT,
  exportSRT,
  createCaption,
} from "@/lib/project-utils";

describe("Project Persistence, Migration & SRT Processing", () => {
  it("initializes project with default tracks and settings", () => {
    const proj = createProject("Test Persistence");
    expect(proj.settings.name).toBe("Test Persistence");
    expect(proj.settings.frameRate).toBe(30);
    expect(proj.tracks.length).toBe(3);
    expect(proj.tracks.some((t) => t.kind === "video")).toBe(true);
    expect(proj.tracks.some((t) => t.kind === "audio")).toBe(true);
    expect(proj.tracks.some((t) => t.kind === "text")).toBe(true);
  });

  it("safely serializes and validates migrated project JSON", () => {
    const proj = createProject("Saved Project");
    const serialized = JSON.stringify(proj);
    const parsed = JSON.parse(serialized);

    const migrated = migrateProject(parsed);
    expect(migrated).not.toBeNull();
    expect(migrated?.id).toBe(proj.id);
    expect(migrated?.settings.name).toBe("Saved Project");
  });

  it("rejects corrupt or invalid project files during migration", () => {
    expect(migrateProject(null)).toBeNull();
    expect(migrateProject({})).toBeNull();
    expect(migrateProject("not a project")).toBeNull();
    expect(migrateProject({ id: "1" })).toBeNull();
  });

  it("exports and parses SRT subtitle files accurately", () => {
    const caps = [
      createCaption("First subtitle line", 0, 2.5),
      createCaption("Second subtitle line", 3, 5.5),
    ];

    const srt = exportSRT(caps);
    expect(srt).toContain("00:00:00,000 --> 00:00:02,500");
    expect(srt).toContain("First subtitle line");

    const parsed = parseSRT(srt);
    expect(parsed.length).toBe(2);
    expect(parsed[0].text).toBe("First subtitle line");
    expect(parsed[0].start).toBeCloseTo(0);
    expect(parsed[0].end).toBeCloseTo(2.5);
    expect(parsed[1].text).toBe("Second subtitle line");
    expect(parsed[1].start).toBeCloseTo(3);
  });
});
