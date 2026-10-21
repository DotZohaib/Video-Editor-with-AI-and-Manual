"use client";
import React, { useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { validateAIPlan } from "@/lib/ai-validation";
import { Button } from "@/components/ui";
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  Wand2,
  ListChecks,
} from "lucide-react";

export function AIAssistant() {
  const project = useEditorStore((s) => s.project);
  const aiPlans = useEditorStore((s) => s.aiPlans);
  const addAIPlan = useEditorStore((s) => s.addAIPlan);
  const applyAIPlan = useEditorStore((s) => s.applyAIPlan);
  const rejectAIPlan = useEditorStore((s) => s.rejectAIPlan);
  const togglePanel = useEditorStore((s) => s.togglePanel);

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);

  if (!project) return null;

  const quickPrompts = [
    "Generate Roman Urdu & English speech captions",
    "Remove silent pauses and dead air",
    "Format for vertical 9:16 Shorts / Reels",
    "Apply cinematic color grading & contrast",
    "Balance audio and dialogue volume",
    "Split clip at halfway mark",
  ];

  const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const query = customPrompt || prompt;
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSourceNotice(null);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          projectContext: {
            settings: {
              name: project.settings.name,
              duration: project.settings.duration,
              aspectRatio: project.settings.aspectRatio,
              width: project.settings.width,
              height: project.settings.height,
            },
            tracks: project.tracks.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
            clips: project.clips.map((c) => ({
              id: c.id,
              trackId: c.trackId,
              kind: c.kind,
              timelineStart: c.timelineStart,
              timelineDuration: c.timelineDuration,
              label: c.label,
            })),
            assets: project.assets.map((a) => ({
              id: a.id,
              name: a.name,
              kind: a.kind,
              meta: { duration: a.meta.duration },
            })),
            captionsCount: project.captions.length,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process AI request");
      }

      if (data.notice || data.warning) {
        setSourceNotice(data.notice || data.warning);
      }

      // Validate the plan strictly against current project schema
      const validation = validateAIPlan(data.plan, project);
      if (validation.valid && validation.plan) {
        addAIPlan(validation.plan);
        setPrompt("");
      } else {
        setErrorMessage(
          `AI plan validation failed: ${validation.errors.slice(0, 3).join(", ")}`
        );
      }
    } catch (err: unknown) {
      console.error("AI Assistant error:", err);
      setErrorMessage(err instanceof Error ? err.message : "AI Assistant communication error");
    } finally {
      setIsLoading(false);
    }
  };

  const pendingPlans = aiPlans.filter((p) => p.status === "pending");

  return (
    <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col h-full select-none text-zinc-200 shrink-0">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-purple-950/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">AI Video Assistant</h3>
            <p className="text-[10px] text-zinc-400">Powered by Gemini & Rule Engine</p>
          </div>
        </div>

        <button
          onClick={() => togglePanel("aiAssistant")}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-3.5 flex flex-col gap-3 overflow-y-auto">
        {sourceNotice && (
          <div className="p-2 bg-blue-950/40 border border-blue-800/60 rounded-lg text-[11px] text-blue-300 flex items-start gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>{sourceNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-2 bg-red-950/50 border border-red-800/80 rounded-lg text-[11px] text-red-300 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Pending Plans Card for User Approval */}
        {pendingPlans.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-purple-400" />
              <span>Proposed Editing Plans</span>
            </h4>

            {pendingPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-zinc-900 border border-purple-900/50 rounded-xl p-3 shadow-lg shadow-purple-950/20 space-y-2.5"
              >
                <div>
                  <h5 className="text-xs font-bold text-white">{plan.title}</h5>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{plan.description}</p>
                </div>

                {/* Actions list preview */}
                <div className="bg-zinc-950/80 rounded-lg p-2 border border-zinc-800/80 space-y-1.5 max-h-36 overflow-y-auto">
                  {plan.actions.map((act, i) => (
                    <div key={i} className="text-[10px] text-zinc-300 flex items-start gap-1.5">
                      <span className="text-purple-400 font-bold shrink-0">•</span>
                      <span>{act.description}</span>
                    </div>
                  ))}
                </div>

                {/* Approve / Reject buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => applyAIPlan(plan.id)}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1 py-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Plan</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectAIPlan(plan.id)}
                    className="text-zinc-400 hover:text-red-400 text-xs px-2 py-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Dismiss</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Suggestion Pills */}
        <div className="space-y-2 mt-2">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Quick Actions
          </label>
          <div className="flex flex-col gap-1.5">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                disabled={isLoading}
                onClick={() => handleSubmit(undefined, qp)}
                className="text-left p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-[11px] text-zinc-300 hover:text-white transition flex items-center justify-between group disabled:opacity-50"
              >
                <span>{qp}</span>
                <Wand2 className="w-3 h-3 text-zinc-500 group-hover:text-purple-400 shrink-0 ml-1 transition" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Field */}
      <form onSubmit={(e) => handleSubmit(e)} className="p-3 border-t border-zinc-800 bg-zinc-900/60">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask AI to edit your video..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="absolute right-1.5 top-1.5 p-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white rounded-md transition"
            title="Generate AI Edit Plan"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}