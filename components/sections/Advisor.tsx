"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";

const FOLLOW_UPS = [
  "What should I tackle this month?",
  "What are common mistakes to avoid?",
  "How do I find vendors I can trust?",
  "Help me think through the guest list",
];

const KICKOFF_PROMPT =
  "I just finished setting up my wedding planning details. Please give me a warm, personalised briefing: start with the 2–3 most urgent actions I should take first given my timeline and setting, call out any flags specific to my situation (location, setting, guest count, budget), and tell me what you can help me with as we plan together. Keep it encouraging and practical.";

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => <p className="font-bold text-gray-900 text-base mb-1">{children}</p>,
  h2: ({ children }) => <p className="font-bold text-gray-900 mt-3 mb-1 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-gray-800 mt-2 mb-0.5">{children}</p>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr className="my-3 border-gray-200" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent)] transition-colors">
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

function MarkdownMessage({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{content}</ReactMarkdown>;
}

export function Advisor() {
  const { answers } = usePlan();
  const {
    advisorMessages,
    appendAdvisorMessage,
    updateLastAdvisorMessage,
    setAdvisorMessages,
    notes,
    addNote,
    removeNote,
  } = usePlanStore();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const kickedOff = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Kick off welcome message once when there are no messages yet
  useEffect(() => {
    if (answers && advisorMessages.length === 0 && !kickedOff.current) {
      kickedOff.current = true;
      sendMessage(KICKOFF_PROMPT, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [advisorMessages]);

  async function sendMessage(text: string, hidden = false) {
    if (!text.trim() || loading) return;

    const userMessage = { role: "user" as const, content: text, hidden };
    appendAdvisorMessage(userMessage);
    setInput("");
    setLoading(true);

    // Build API messages from full history including new user message
    const allMessages = [...advisorMessages, userMessage];
    const apiMessages = allMessages.map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, answers }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      appendAdvisorMessage({ role: "assistant", content: "" });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        updateLastAdvisorMessage(text);
      }
    } catch (err) {
      console.error("Advisor error:", err);
      appendAdvisorMessage({ role: "assistant", content: "Sorry, something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleSave(index: number, content: string) {
    addNote(content);
    setSavedIndices((prev) => new Set(prev).add(index));
    setNotesOpen(true);
  }

  function handleClearChat() {
    setAdvisorMessages([]);
    kickedOff.current = false;
    setSavedIndices(new Set());
  }

  const visibleMessages = advisorMessages.filter((m) => !m.hidden);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Your Advisor</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Guides you through every decision — conversation history is saved automatically
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {notes.length > 0 && (
            <button onClick={() => setNotesOpen((o) => !o)}
              className="text-xs text-[var(--accent)] border border-[var(--accent)]/30 rounded-lg px-2.5 py-1 hover:bg-[var(--accent)]/10 transition-colors">
              {notes.length} saved note{notes.length !== 1 ? "s" : ""}
            </button>
          )}
          {visibleMessages.length > 0 && (
            <button onClick={handleClearChat}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Saved notes panel */}
      {notesOpen && notes.length > 0 && (
        <div className="shrink-0 mb-4 border border-[var(--accent)]/30 rounded-xl bg-[var(--accent)]/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--accent)]/30">
            <span className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide">Saved Notes</span>
            <button onClick={() => setNotesOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-pink-100">
            {notes.map((note) => (
              <div key={note.id} className="px-4 py-3 flex items-start gap-3 group">
                <div className="flex-1 min-w-0 text-xs text-gray-700 leading-relaxed">
                  <MarkdownMessage content={note.content} />
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-400">
                    {new Date(note.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <button onClick={() => removeNote(note.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Kickoff loading */}
        {loading && visibleMessages.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="inline-flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
              </span>
            </div>
          </div>
        )}

        {visibleMessages.map((msg, i) => {
          const isSaved = savedIndices.has(i);
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="flex flex-col gap-1 max-w-[82%]">
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--accent)] text-white rounded-br-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
                }`}>
                  {msg.content ? (
                    msg.role === "assistant" ? <MarkdownMessage content={msg.content} /> : msg.content
                  ) : (
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </span>
                  )}
                </div>
                {msg.role === "assistant" && msg.content && !loading && (
                  <button
                    onClick={() => !isSaved && handleSave(i, msg.content)}
                    className={`self-start text-xs px-2 py-1 rounded transition-colors ${
                      isSaved ? "text-[var(--accent)] cursor-default" : "text-gray-400 hover:text-[var(--accent)]"
                    }`}
                  >
                    {isSaved ? "Saved" : "Save note"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Follow-up prompts after first message */}
        {!loading && visibleMessages.length === 1 && visibleMessages[0].role === "assistant" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {FOLLOW_UPS.map((s) => (
              <button key={s} onClick={() => sendMessage(s)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex gap-2 pt-4 border-t border-gray-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask anything about your wedding…"
          disabled={loading}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Send
        </button>
      </div>
    </div>
  );
}
