"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePlanStore } from "@/lib/plan-store";
import type { ResearchType } from "@/lib/research-prompts";
import type { WeddingAnswers } from "@/lib/types";

interface ResearchCardProps {
  type: ResearchType;
  title: string;
  description: string;
  answers: WeddingAnswers;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const VENDOR_CATEGORY: Partial<Record<ResearchType, string>> = {
  venue: "Venue",
  photographer: "Photography",
  caterer: "Catering",
  florist: "Florist",
  music: "Music",
  dress: "Attire",
};

const CHAT_STARTERS: Partial<Record<ResearchType, string[]>> = {
  venue: ["What questions should I ask on a tour?", "How do I compare two venues?"],
  photographer: ["What style suits a minimalist wedding?", "What's a fair deposit?"],
  caterer: ["What's a realistic per-head cost?", "How do I handle dietary restrictions?"],
  florist: ["What flowers are in season in spring?", "How much should I budget for florals?"],
  music: ["Should we do a band or DJ?", "What songs are essential?"],
  dress: ["When should I start shopping?", "What silhouette suits an outdoor setting?"],
  honeymoon: ["What destinations suit our vibe?", "When should we book?"],
  timeline: ["How long should cocktail hour be?", "When should speeches happen?"],
  budget: ["Where can we cut costs?", "What hidden fees should we watch for?"],
};

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => <p className="font-bold text-gray-900 text-sm mb-1 mt-3 first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="font-bold text-gray-900 text-sm mb-1 mt-3 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-gray-800 text-sm mb-0.5 mt-2">{children}</p>,
  p: ({ children }) => <p className="mb-2 last:mb-0 text-sm text-gray-700">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5 text-sm text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5 text-sm text-gray-700">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr className="my-3 border-gray-100" />,
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
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-700 border border-gray-200 align-top">{children}</td>
  ),
  tr: ({ children }) => <tr className="even:bg-gray-50">{children}</tr>,
};

export function ResearchCard({ type, title, description, answers }: ResearchCardProps) {
  const { addVendor } = usePlanStore();

  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Add vendor state
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [vendorAdded, setVendorAdded] = useState(false);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function fetchResearch() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, answers }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setResult(data.result);
    } catch {
      setError("Failed to load research. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat(text: string) {
    if (!text.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/research-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, research: result, type, answers }),
      });
      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: text };
          return updated;
        });
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleAddVendor() {
    if (!vendorName.trim()) return;
    const category = VENDOR_CATEGORY[type] ?? "Other";
    addVendor({
      id: `vendor-${Date.now()}`,
      category,
      name: vendorName.trim(),
      status: "considering",
    });
    setVendorName("");
    setVendorFormOpen(false);
    setVendorAdded(true);
  }

  const starters = CHAT_STARTERS[type] ?? [];
  const hasVendorCategory = type in VENDOR_CATEGORY;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      {/* Empty state */}
      {!result && !loading && (
        <div className="p-5">
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <button
            onClick={fetchResearch}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
          >
            {error ? "Try again" : "Get Research"}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-5 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          Researching...
        </div>
      )}

      {/* Result */}
      {result && (
        <>
          <div className="px-5 py-4 overflow-y-auto max-h-96">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {result}
            </ReactMarkdown>
          </div>

          {/* Actions bar */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setChatOpen((o) => !o)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                chatOpen
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "text-gray-600 border-gray-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {chatOpen ? "Close chat" : "Ask a follow-up"}
            </button>

            {hasVendorCategory && (
              <button
                onClick={() => setVendorFormOpen((o) => !o)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  vendorFormOpen
                    ? "bg-gray-100 text-gray-700 border-gray-200"
                    : "text-gray-600 border-gray-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                Add to vendors
              </button>
            )}

            {vendorAdded && (
              <span className="text-xs text-green-600">Added to vendors</span>
            )}

            <button
              onClick={fetchResearch}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Add vendor form */}
          {vendorFormOpen && (
            <div className="px-5 pb-4 flex gap-2">
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddVendor()}
                placeholder={`${VENDOR_CATEGORY[type]} name...`}
                autoFocus
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleAddVendor}
                disabled={!vendorName.trim()}
                className="px-3 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setVendorFormOpen(false)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Chat */}
          {chatOpen && (
            <div className="border-t border-gray-100 bg-gray-50">
              {/* Chat messages */}
              {chatMessages.length > 0 && (
                <div className="px-4 pt-3 space-y-3 max-h-64 overflow-y-auto">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-[var(--accent)] text-white"
                            : "bg-white border border-gray-200 text-gray-800"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          msg.content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <span className="inline-flex gap-1 items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                            </span>
                          )
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
              )}

              {/* Starter chips (only before first message) */}
              {chatMessages.length === 0 && starters.length > 0 && (
                <div className="px-4 pt-3 flex flex-wrap gap-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendChat(s)}
                      className="text-xs px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat input */}
              <div className="px-4 py-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat(chatInput)}
                  placeholder="Ask a follow-up question..."
                  disabled={chatLoading}
                  className="flex-1 border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
                />
                <button
                  onClick={() => sendChat(chatInput)}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors"
                >
                  Ask
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
