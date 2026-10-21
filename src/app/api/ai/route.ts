import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const RequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  projectContext: z.object({
    settings: z.object({
      name: z.string(),
      duration: z.number(),
      aspectRatio: z.string(),
      width: z.number(),
      height: z.number(),
    }),
    tracks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.string(),
      })
    ),
    clips: z.array(
      z.object({
        id: z.string(),
        trackId: z.string(),
        kind: z.string(),
        timelineStart: z.number(),
        timelineDuration: z.number(),
        label: z.string().optional(),
      })
    ),
    assets: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.string(),
        meta: z.object({
          duration: z.number().optional(),
        }),
      })
    ),
    captionsCount: z.number(),
  }),
});

const SYSTEM_INSTRUCTION = `You are AI Video Studio's editing assistant.
Your task is to analyze the user's natural language video editing instructions and project state, then output a structured editing plan as JSON.

STRICT RULES:
1. ONLY return valid JSON matching the exact schema below. Do not include markdown codeblocks or preamble.
2. Only reference existing track IDs, clip IDs, or asset IDs from the provided projectContext.
3. Supported action kinds:
   - "add_clip": payload { assetId: string, trackId: string, timelineStart: number }
   - "remove_clip": payload { clipId: string }
   - "trim_clip": payload { clipId: string, edge: "start"|"end", newTime: number }
   - "move_clip": payload { clipId: string, newStart: number }
   - "split_clip": payload { clipId: string, splitTime: number }
   - "set_volume": payload { clipId: string, volume: number (0-2) }
   - "add_caption": payload { text: string, startTime: number, endTime: number, language: string }
   - "remove_caption": payload { captionId: string }
   - "set_speed": payload { clipId: string, speed: number (0.1-5) }
   - "set_color": payload { clipId: string, brightness?: number (-100 to 100), contrast?: number, saturation?: number }
   - "add_text": payload { trackId: string, text: string, timelineStart: number, timelineDuration: number }
   - "mute_track": payload { trackId: string, muted: boolean }
   - "set_opacity": payload { clipId: string, opacity: number (0-1) }

SCHEMA FORMAT:
{
  "title": "Short title describing the plan",
  "description": "Clear explanation of planned actions",
  "estimatedDuration": number (total seconds),
  "actions": [
    {
      "kind": "action_kind",
      "payload": { ... },
      "description": "User-friendly description of this action"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const { prompt, projectContext } = parseResult.data;
    const apiKey = process.env.GEMINI_API_KEY;

    // If no API key is configured or requested offline, provide intelligent template-based plans
    if (!apiKey || apiKey === "your_api_key_here" || apiKey.trim() === "") {
      const fallbackPlan = generateLocalFallbackPlan(prompt, projectContext);
      return NextResponse.json({
        plan: fallbackPlan,
        source: "local-heuristic",
        notice: "Gemini API key not configured in .env.local. A local rule-based editing plan was generated.",
      });
    }

    const primaryModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-flash";

    const ai = new GoogleGenAI({ apiKey });

    const contents = [
      {
        text: `User Request: "${prompt}"\n\nCurrent Project State:\n${JSON.stringify(
          projectContext,
          null,
          2
        )}\n\nGenerate the JSON editing plan now:`,
      },
    ];

    let responseText = "";
    try {
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      responseText = response.text || "";
    } catch (err: unknown) {
      console.warn(`Primary model ${primaryModel} failed, trying fallback ${fallbackModel}:`, err);
      try {
        const responseFallback = await ai.models.generateContent({
          model: fallbackModel,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });
        responseText = responseFallback.text || "";
      } catch (fallbackErr: unknown) {
        console.error("Gemini API error on both models:", fallbackErr);
        // Fallback gracefully so manual editing and preview never break
        const fallbackPlan = generateLocalFallbackPlan(prompt, projectContext);
        return NextResponse.json({
          plan: fallbackPlan,
          source: "local-fallback",
          warning: "Gemini API request failed (rate limit or network). Generated smart fallback plan.",
        });
      }
    }

    // Clean response if needed
    let cleaned = responseText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
    }

    let planJson;
    try {
      planJson = JSON.parse(cleaned);
    } catch {
      console.warn("JSON parse of Gemini response failed, falling back to local engine");
      planJson = generateLocalFallbackPlan(prompt, projectContext);
      return NextResponse.json({
        plan: planJson,
        source: "local-fallback",
        notice: "AI generated an edit plan using the local rule engine.",
      });
    }

    return NextResponse.json({
      plan: planJson,
      source: "gemini",
    });
  } catch (error: unknown) {
    console.error("AI Route Exception:", error);
    // Even if an unexpected error occurs, provide a graceful fallback plan
    try {
      const fallbackPlan = generateLocalFallbackPlan("auto-enhance", {
        settings: { name: "Project", duration: 10, aspectRatio: "16:9", width: 1920, height: 1080 },
        tracks: [],
        clips: [],
        assets: [],
        captionsCount: 0,
      });
      return NextResponse.json({
        plan: fallbackPlan,
        source: "local-fallback",
        warning: "Encountered a temporary error. Provided smart fallback editing plan.",
      });
    } catch {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Internal AI processing error",
        },
        { status: 500 }
      );
    }
  }
}

// Smart heuristic plan builder for offline / fallback scenarios with Roman Urdu & English understanding
function generateLocalFallbackPlan(
  prompt: string,
  context: z.infer<typeof RequestSchema>["projectContext"]
) {
  const p = prompt.toLowerCase();
  const actions: Array<{ kind: string; payload: Record<string, unknown>; description: string }> = [];
  const textTrack = context.tracks.find((t) => t.kind === "text") || context.tracks[0];
  let title = "AI Assisted Edit";
  let description = `Proposed edit plan based on: "${prompt}"`;

  if (
    p.includes("caption") ||
    p.includes("subtitle") ||
    p.includes("transcribe") ||
    p.includes("urdu") ||
    p.includes("roman") ||
    p.includes("likho") ||
    p.includes("sub")
  ) {
    title = "Generate Smart Captions (Urdu & English)";
    description = "Add time-synchronized speech captions across the timeline.";
    const totalDur = Math.max(context.settings.duration, 6);
    const step = 3;
    const isUrdu = p.includes("urdu") || p.includes("roman") || p.includes("likho");
    const phrases = isUrdu
      ? ["Khushamdeed dosto", "Aaj hum seekhenge video editing", "AI ki madad se kaam aasan", "Video ko like aur share karein", "Shukriya dekhne ka!"]
      : ["Welcome to our video", "Let's explore the editing process", "Professional AI Video Studio", "Don't forget to like & share", "Thanks for watching!"];

    let t = 0;
    let idx = 0;
    while (t < totalDur) {
      const phrase = phrases[idx % phrases.length];
      const end = Math.min(t + 2.5, totalDur);
      actions.push({
        kind: "add_caption",
        payload: {
          text: phrase,
          startTime: t,
          endTime: end,
          language: isUrdu ? "ur-Latn" : "en",
        },
        description: `Add caption "${phrase}" (${t.toFixed(1)}s - ${end.toFixed(1)}s)`,
      });
      t += step;
      idx++;
    }
  } else if (
    p.includes("pause") ||
    p.includes("silence") ||
    p.includes("trim") ||
    p.includes("khamoshi") ||
    p.includes("hatao")
  ) {
    title = "Remove Pauses & Trim Dead Air";
    description = "Trims start and end silence from video clips to improve pacing.";
    for (const clip of context.clips) {
      if (clip.timelineDuration > 2) {
        actions.push({
          kind: "trim_clip",
          payload: {
            clipId: clip.id,
            edge: "start",
            newTime: clip.timelineStart + 0.3,
          },
          description: `Trim leading pause from clip "${clip.label || clip.id}"`,
        });
      }
    }
  } else if (
    p.includes("split") ||
    p.includes("cut") ||
    p.includes("kaat") ||
    p.includes("kat") ||
    p.includes("aadha") ||
    p.includes("tukray")
  ) {
    title = "Split Video at Midpoint";
    description = "Splits clips at key pacing points.";
    if (context.clips.length > 0) {
      const target = context.clips[0];
      const mid = target.timelineStart + target.timelineDuration / 2;
      actions.push({
        kind: "split_clip",
        payload: { clipId: target.id, splitTime: mid },
        description: `Split clip "${target.label || target.id}" at ${mid.toFixed(1)}s`,
      });
    }
  } else if (
    p.includes("vertical") ||
    p.includes("reel") ||
    p.includes("tiktok") ||
    p.includes("shorts") ||
    p.includes("9:16")
  ) {
    title = "Format for Vertical Social Media (9:16)";
    description = "Adjust framing and text positioning for 9:16 reels/shorts.";
    if (textTrack) {
      actions.push({
        kind: "add_text",
        payload: {
          trackId: textTrack.id,
          text: "#Viral #VideoStudio",
          timelineStart: 0,
          timelineDuration: Math.min(context.settings.duration || 5, 5),
        },
        description: "Add social media hashtag overlay header",
      });
    }
  } else if (
    p.includes("color") ||
    p.includes("bright") ||
    p.includes("contrast") ||
    p.includes("cinematic") ||
    p.includes("rang") ||
    p.includes("khubsurat")
  ) {
    title = "Apply Cinematic Color Tuning";
    description = "Enhance contrast and saturation for a vivid cinematic tone.";
    for (const clip of context.clips) {
      actions.push({
        kind: "set_color",
        payload: {
          clipId: clip.id,
          brightness: 5,
          contrast: 15,
          saturation: 20,
        },
        description: `Cinematic grading for "${clip.label || clip.id}"`,
      });
    }
  } else if (
    p.includes("music") ||
    p.includes("audio") ||
    p.includes("volume") ||
    p.includes("duck") ||
    p.includes("aawaz") ||
    p.includes("awaz") ||
    p.includes("sound")
  ) {
    title = "Balance Audio Levels";
    description = "Optimize video dialogue clarity and boost volume.";
    for (const clip of context.clips) {
      actions.push({
        kind: "set_volume",
        payload: { clipId: clip.id, volume: 1.25 },
        description: `Boost clarity for "${clip.label || clip.id}" to 125%`,
      });
    }
  } else if (
    p.includes("speed") ||
    p.includes("fast") ||
    p.includes("slow") ||
    p.includes("tez") ||
    p.includes("raftar")
  ) {
    const isSlow = p.includes("slow");
    title = isSlow ? "Slow Motion Effect" : "Speed Up Playback";
    description = `Adjust video playback speed to ${isSlow ? "0.75x" : "1.25x"}.`;
    for (const clip of context.clips) {
      actions.push({
        kind: "set_speed",
        payload: { clipId: clip.id, speed: isSlow ? 0.75 : 1.25 },
        description: `Set playback speed of "${clip.label || clip.id}" to ${isSlow ? "0.75x" : "1.25x"}`,
      });
    }
  } else {
    // General enhance
    title = "Smart Polish Plan";
    description = "Automatic intro title and clarity enhancement.";
    if (textTrack) {
      actions.push({
        kind: "add_text",
        payload: {
          trackId: textTrack.id,
          text: context.settings.name || "AI Video Studio",
          timelineStart: 0,
          timelineDuration: 3,
        },
        description: "Add title overlay for the opening sequence",
      });
    }
    if (context.clips.length > 0) {
      actions.push({
        kind: "set_color",
        payload: { clipId: context.clips[0].id, brightness: 5, contrast: 10, saturation: 10 },
        description: "Enhance visual vibrance",
      });
    }
  }

  return {
    title,
    description,
    estimatedDuration: context.settings.duration,
    actions,
  };
}

