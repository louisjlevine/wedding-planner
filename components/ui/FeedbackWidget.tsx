"use client";

import { useState, useRef, useEffect } from "react";

type State = "idle" | "open" | "submitting" | "success" | "error";

export default function FeedbackWidget() {
  const [state, setState] = useState<State>("idle");
  const [text, setText] = useState("");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state === "open") {
      textareaRef.current?.focus();
    }
  }, [state]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state === "open") {
        setState("idle");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state]);

  async function submit() {
    if (!text.trim()) return;
    setState("submitting");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: text.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIssueUrl(data.issueUrl ?? null);
      setState("success");
      setText("");
    } catch {
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setIssueUrl(null);
    setText("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      {state !== "idle" && (
        <div className="w-80 rounded-2xl border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">
              Send feedback
            </span>
            <button
              onClick={reset}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {state === "success" ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-800">
                  Feedback received
                </p>
                <p className="text-xs text-gray-500">
                  A Linear issue has been created and will be triaged shortly.
                </p>
                {issueUrl && (
                  <a
                    href={issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#D4537E] underline underline-offset-2 hover:opacity-80"
                  >
                    View issue
                  </a>
                )}
                <button
                  onClick={reset}
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : state === "error" ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <p className="text-sm text-gray-700">
                  Something went wrong. Please try again.
                </p>
                <button
                  onClick={() => setState("open")}
                  className="rounded-lg bg-[#D4537E] px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Describe what you noticed, what's broken, or what could be better..."
                  rows={4}
                  maxLength={2000}
                  disabled={state === "submitting"}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#D4537E] focus:ring-1 focus:ring-[#D4537E] disabled:opacity-50 transition-colors"
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {text.length}/2000
                  </span>
                  <button
                    onClick={submit}
                    disabled={!text.trim() || state === "submitting"}
                    className="flex items-center gap-2 rounded-lg bg-[#D4537E] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {state === "submitting" ? (
                      <>
                        <svg
                          className="h-3 w-3 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                        Sending
                      </>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => (state === "idle" ? setState("open") : reset())}
        className="flex items-center gap-2 rounded-full bg-[#D4537E] px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:opacity-90 active:scale-95 transition-all"
        aria-label="Send feedback"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 8h10M7 12h6m-6 4h10M5 20l-2-2 2-2M19 4l2 2-2 2"
          />
        </svg>
        Feedback
      </button>
    </div>
  );
}
