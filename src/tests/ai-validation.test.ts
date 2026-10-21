import { describe, it, expect } from "vitest";
import { validateAIPlan } from "@/lib/ai-validation";
import { createProject } from "@/lib/project-utils";

describe("AI Plan Validation", () => {
  it("approves valid AI plans with existing entity IDs", () => {
    const project = createProject("Test Project");
    const trackId = project.tracks[0].id;

    // Add dummy asset
    project.assets.push({
      id: "asset_test",
      name: "test.mp4",
      kind: "video",
      idbKey: "key_1",
      originalName: "test.mp4",
      mimeType: "video/mp4",
      meta: { size: 1000 },
      importedAt: Date.now(),
    });

    const rawPlan = {
      title: "Add intro clip",
      description: "Appends the imported asset to track 1",
      actions: [
        {
          kind: "add_clip",
          payload: {
            assetId: "asset_test",
            trackId: trackId,
            timelineStart: 0,
          },
          description: "Add clip at start",
        },
        {
          kind: "add_caption",
          payload: {
            text: "Hello World",
            startTime: 0,
            endTime: 2.5,
            language: "en",
          },
          description: "Add title caption",
        },
      ],
    };

    const res = validateAIPlan(rawPlan, project);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.plan?.actions.length).toBe(2);
  });

  it("rejects unknown action kinds", () => {
    const project = createProject("Test Project");
    const rawPlan = {
      title: "Dangerous plan",
      description: "Attempts arbitrary shell or unsupported action",
      actions: [
        {
          kind: "run_shell_command",
          payload: { command: "rm -rf /" },
          description: "Forbidden",
        },
      ],
    };

    const res = validateAIPlan(rawPlan, project);
    expect(res.valid).toBe(false);
  });

  it("rejects non-existent asset IDs and track IDs", () => {
    const project = createProject("Test Project");
    const rawPlan = {
      title: "Invalid References",
      description: "References missing assets",
      actions: [
        {
          kind: "add_clip",
          payload: {
            assetId: "non_existent_asset",
            trackId: "non_existent_track",
            timelineStart: 0,
          },
          description: "Invalid",
        },
      ],
    };

    const res = validateAIPlan(rawPlan, project);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Asset") || e.includes("Track"))).toBe(true);
  });

  it("rejects invalid caption timestamps (end <= start)", () => {
    const project = createProject("Test Project");
    const rawPlan = {
      title: "Bad Timing",
      description: "End time before start time",
      actions: [
        {
          kind: "add_caption",
          payload: {
            text: "Inverted time",
            startTime: 5,
            endTime: 2,
            language: "en",
          },
          description: "Bad caption",
        },
      ],
    };

    const res = validateAIPlan(rawPlan, project);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("endTime must be > startTime"))).toBe(true);
  });
});
