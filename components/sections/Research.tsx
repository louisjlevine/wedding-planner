"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import type { ResearchRecommendation, ResearchChatMessage } from "@/lib/types";
import type { ResearchType as RT } from "@/lib/research-prompts";
import type { ResearchType } from "@/lib/research-prompts";

// ── Markdown renderer shared across sections ──────────────────────────────────

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => <p className="font-bold text-gray-900 mt-3 mb-1 first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="font-bold text-gray-900 mt-3 mb-1 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-gray-800 mt-2 mb-0.5">{children}</p>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr className="my-3 border-gray-100" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent)] transition-colors break-all">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-gray-700 border border-gray-200 align-top">{children}</td>,
  tr: ({ children }) => <tr className="even:bg-gray-50">{children}</tr>,
};

function Md({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{children}</ReactMarkdown>;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPES: { type: ResearchType; label: string; icon: string; vendorCategory?: string }[] = [
  { type: "venue",        label: "Venue",          icon: "🏛",  vendorCategory: "Venue" },
  { type: "photographer", label: "Photography",    icon: "📷",  vendorCategory: "Photography" },
  { type: "caterer",      label: "Catering",       icon: "🍽",  vendorCategory: "Catering" },
  { type: "florist",      label: "Flowers",        icon: "💐",  vendorCategory: "Florist" },
  { type: "music",        label: "Music",          icon: "🎵",  vendorCategory: "Music" },
  { type: "dress",        label: "Attire",         icon: "👗",  vendorCategory: "Attire" },
  { type: "honeymoon",    label: "Honeymoon",      icon: "✈️" },
  { type: "timeline",     label: "Day Timeline",   icon: "🗓" },
  { type: "budget",       label: "Budget",         icon: "💰" },
];

const CHAT_STARTERS: Partial<Record<ResearchType, string[]>> = {
  venue:        ["What questions should I ask on a tour?", "How do I compare two venues?", "What red flags should I watch for in contracts?"],
  photographer: ["What style suits our minimalist vibe?", "What's a fair deposit?", "How do I evaluate a portfolio?"],
  caterer:      ["What's a realistic per-head cost?", "How do I handle dietary restrictions?", "Buffet vs plated — which is better for 100 guests?"],
  florist:      ["What flowers are in season in spring?", "How much should I allocate to florals?", "Can I do a mix of DIY and professional?"],
  music:        ["Band vs DJ — what's better for our budget?", "What are must-play vs do-not-play songs?", "How long do we need music coverage?"],
  dress:        ["When should I start shopping?", "What alterations should I budget for?", "How many fittings will I need?"],
  honeymoon:    ["What destinations suit a romantic minimalist vibe?", "When should we book?", "Should we do a mini-moon first?"],
  timeline:     ["How long should cocktail hour be?", "When do speeches work best?", "How much buffer time do we need?"],
  budget:       ["Where can we cut without it showing?", "What hidden fees should we watch for?", "How should we handle tips for vendors?"],
};

// ── Editable recommendation card ──────────────────────────────────────────────

function RecommendationCard({
  rec,
  type,
  vendorCategory,
  onUpdate,
  onDismiss,
}: {
  rec: ResearchRecommendation;
  type: RT;
  vendorCategory?: string;
  onUpdate: (id: string, updates: Partial<ResearchRecommendation>) => void;
  onDismiss: (id: string, title: string) => void;
}) {
  const { addVendor, markRecommendationDismissed } = usePlanStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...rec });
  const [addedToVendors, setAddedToVendors] = useState(false);

  function saveEdit() {
    onUpdate(rec.id, draft);
    setEditing(false);
  }

  function handleAddVendor() {
    addVendor({
      id: `vendor-${Date.now()}`,
      category: vendorCategory ?? "Other",
      name: rec.title,
      website: rec.website || undefined,
      notes: `${rec.description}\n\nWhy it fits: ${rec.why}`,
      status: "considering",
    });
    markRecommendationDismissed(type, rec.title);
    setAddedToVendors(true);
  }

  if (editing) {
    return (
      <div className="border border-[var(--accent)] rounded-xl p-4 space-y-3 bg-[var(--accent)]/5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Name</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Price range</label>
            <input value={draft.priceRange ?? ""} onChange={(e) => setDraft({ ...draft, priceRange: e.target.value })}
              placeholder="e.g. $5,000–$8,000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Website</label>
          <input value={draft.website ?? ""} onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Description</label>
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Why it fits</label>
          <textarea value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })}
            rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={saveEdit}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors">
            Save
          </button>
          <button onClick={() => { setDraft({ ...rec }); setEditing(false); }}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = {
    open:    { dot: "bg-green-400", label: "Open",         labelClass: "text-green-700 bg-green-50 border-green-200" },
    closed:  { dot: "bg-red-400",   label: "Closed",       labelClass: "text-red-700 bg-red-50 border-red-200" },
    unknown: { dot: "bg-gray-300",  label: "Verify status", labelClass: "text-gray-500 bg-gray-50 border-gray-200" },
  };
  const statusInfo = rec.status ? statusConfig[rec.status] : null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-900 text-sm">{rec.title}</h4>
            {rec.priceRange && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{rec.priceRange}</span>
            )}
            {statusInfo && (
              <span
                title={rec.statusNote ?? "Status checked via web search"}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusInfo.labelClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.label}
              </span>
            )}
          </div>
          {rec.website && (
            <a href={rec.website} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] hover:underline mt-0.5 block truncate">
              {rec.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            Edit
          </button>
          <button onClick={() => onDismiss(rec.id, rec.title)}
            className="text-xs text-gray-300 hover:text-red-400 transition-colors">
            Dismiss
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
      <p className="text-xs text-[var(--accent)] italic">{rec.why}</p>
      {vendorCategory && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {addedToVendors ? (
            <span className="text-xs text-green-600">Added to vendors</span>
          ) : (
            <button onClick={handleAddVendor}
              className="text-xs text-gray-400 hover:text-[var(--accent)] transition-colors">
              + Add to vendors
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Research panel ───────────────────────────────────────────────────────

function ResearchPanel({ type, label, vendorCategory, answers }: {
  type: ResearchType;
  label: string;
  vendorCategory?: string;
  answers: NonNullable<ReturnType<typeof usePlan>["answers"]>;
}) {
  const {
    researchSessions,
    setResearchNotes,
    setResearchRecommendations,
    updateRecommendation,
    dismissRecommendation,
    addResearchChatMessage,
    updateLastResearchChat,
    clearResearchSession,
  } = usePlanStore();

  const session = researchSessions[type] ?? { notes: "", recommendations: [], chatMessages: [] };

  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recError, setRecError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.chatMessages]);

  const { triggerResearchFor, setTriggerResearchFor } = usePlanStore();

  // Auto-fetch when navigated here from "Find similar" on Vendors
  useEffect(() => {
    if (triggerResearchFor === type) {
      setTriggerResearchFor(null);
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerResearchFor, type]);

  const fetchRecommendations = useCallback(async () => {
    setLoadingRecs(true);
    setRecError("");
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, notes: session.notes, answers }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResearchRecommendations(type, data.recommendations, new Date().toISOString());
    } catch {
      setRecError("Failed to get recommendations. Please try again.");
    } finally {
      setLoadingRecs(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, session.notes, answers]);

  async function sendChat(text: string) {
    if (!text.trim() || chatLoading) return;
    const userMsg: ResearchChatMessage = { role: "user", content: text };
    addResearchChatMessage(type, userMsg);
    setChatInput("");
    setChatLoading(true);

    const apiMessages = [...session.chatMessages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/research-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          recommendations: session.recommendations,
          notes: session.notes,
          type,
          answers,
        }),
      });
      if (!res.ok || !res.body) throw new Error("Failed");

      addResearchChatMessage(type, { role: "assistant", content: "" });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        updateLastResearchChat(type, text);
      }
    } catch {
      updateLastResearchChat(type, "Sorry, something went wrong.");
    } finally {
      setChatLoading(false);
    }
  }

  const starters = CHAT_STARTERS[type] ?? [];
  const hasRecs = session.recommendations.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Notes */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Your notes</h3>
        <textarea
          value={session.notes}
          onChange={(e) => setResearchNotes(type, e.target.value)}
          placeholder={`Any specifics for your ${label.toLowerCase()} search? Budget range, style preferences, things you've already ruled out…`}
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-none"
        />
      </div>

      {/* Get recommendations */}
      <div className="flex items-center gap-3">
        <button
          onClick={fetchRecommendations}
          disabled={loadingRecs}
          className="px-5 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loadingRecs && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {hasRecs ? "Refresh recommendations" : "Get recommendations"}
        </button>
        {hasRecs && (
          <button onClick={() => clearResearchSession(type)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Clear all
          </button>
        )}
        {session.fetchedAt && (
          <span className="text-xs text-gray-400 ml-auto">
            Last updated {new Date(session.fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      {recError && <p className="text-sm text-red-500">{recError}</p>}

      {/* Recommendations */}
      {hasRecs && (
        <div>
          {(() => {
            const visible = session.recommendations.filter((r) => r.status !== "closed");
            const closedCount = session.recommendations.length - visible.length;
            return (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  Recommendations
                  <span className="text-gray-400 font-normal">({visible.length})</span>
                  <span className="text-xs font-normal text-gray-400">— open/closed verified via web search</span>
                </h3>
                {closedCount > 0 && (
                  <p className="text-xs text-gray-400 mb-3">
                    {closedCount} closed {closedCount === 1 ? "business" : "businesses"} hidden
                  </p>
                )}
                {closedCount === 0 && <div className="mb-3" />}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {visible.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      type={type}
                      vendorCategory={vendorCategory}
                      onUpdate={(id, updates) => updateRecommendation(type, id, updates)}
                      onDismiss={(id, title) => dismissRecommendation(type, id, title)}
                    />
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Chat */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Ask a follow-up</h3>
          <p className="text-xs text-gray-400 mt-0.5">Dig deeper — all your {label.toLowerCase()} questions answered in context</p>
        </div>

        {/* Messages */}
        {session.chatMessages.length > 0 && (
          <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto bg-white">
            {session.chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-gray-50 border border-gray-200 text-gray-800"
                }`}>
                  {msg.role === "assistant" ? (
                    msg.content
                      ? <Md>{msg.content}</Md>
                      : <span className="inline-flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                        </span>
                  ) : msg.content}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
        )}

        {/* Starter chips */}
        {session.chatMessages.length === 0 && starters.length > 0 && (
          <div className="px-4 py-3 flex flex-wrap gap-2 bg-white border-b border-gray-100">
            {starters.map((s) => (
              <button key={s} onClick={() => sendChat(s)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors bg-white">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 flex gap-2 bg-white">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat(chatInput)}
            placeholder={`Ask anything about ${label.toLowerCase()}…`}
            disabled={chatLoading}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
          <button onClick={() => sendChat(chatInput)} disabled={chatLoading || !chatInput.trim()}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors">
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Research page ─────────────────────────────────────────────────────────────

export function Research() {
  const { answers } = usePlan();
  const { researchSessions, triggerResearchFor } = usePlanStore();
  const [activeType, setActiveType] = useState<ResearchType>("venue");

  // When "Find similar" navigates here, switch to the right category
  useEffect(() => {
    if (triggerResearchFor) {
      const match = TYPES.find((t) => t.type === triggerResearchFor);
      if (match) setActiveType(match.type);
    }
  }, [triggerResearchFor]);

  if (!answers) return null;

  const active = TYPES.find((t) => t.type === activeType)!;

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <aside className="w-44 shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-2">Category</p>
        <nav className="space-y-0.5">
          {TYPES.map(({ type, label, icon }) => {
            const session = researchSessions[type];
            const hasRecs = (session?.recommendations?.length ?? 0) > 0;
            const hasNotes = !!session?.notes?.trim();
            const hasChatMsgs = (session?.chatMessages?.length ?? 0) > 0;
            const hasActivity = hasRecs || hasNotes || hasChatMsgs;

            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeType === type
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="flex-1 truncate">{label}</span>
                {hasActivity && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    hasRecs ? "bg-[var(--accent)]" : "bg-gray-300"
                  }`} />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main panel */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">{active.label} Research</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Add your notes, get personalised recommendations, then refine with follow-up questions
          </p>
        </div>
        <ResearchPanel
          key={activeType}
          type={activeType}
          label={active.label}
          vendorCategory={active.vendorCategory}
          answers={answers}
        />
      </div>
    </div>
  );
}
