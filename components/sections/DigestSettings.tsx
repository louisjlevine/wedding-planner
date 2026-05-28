"use client";

import { useState } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { usePlan } from "@/hooks/usePlan";
import { Button } from "@/components/ui/Button";
import type { EmailDigestPrefs } from "@/lib/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_PREFS: EmailDigestPrefs = {
  emailLouis: "",
  emailPartner: "",
  sendDay: 0,
  optInLouis: true,
  optInPartner: true,
};

interface DigestStats {
  overdueTasks: number;
  upcomingTasks: number;
  upcomingMilestones: number;
}

interface DigestPreview {
  subject: string;
  plainText: string;
  stats: DigestStats;
  sent: boolean;
  resendConfigured: boolean;
}

export function DigestSettings() {
  const { answers, vendors, emailPrefs, setEmailPrefs } = usePlanStore();
  const { tasks, timeline, budgetCategories, defaultTasks } = usePlan();

  const [form, setForm] = useState<EmailDigestPrefs>(emailPrefs ?? DEFAULT_PREFS);
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendResult, setSendResult] = useState<"sent" | "error" | null>(null);
  const [previewError, setPreviewError] = useState(false);

  if (!answers) return null;

  // Merge store tasks with adapter defaults (same logic as Tasks/Timeline)
  const storeTaskIds = new Set(tasks.map((t) => t.id));
  const allTasks = [
    ...tasks,
    ...defaultTasks.filter((t) => !storeTaskIds.has(t.id)),
  ];

  function handleChange<K extends keyof EmailDigestPrefs>(key: K, value: EmailDigestPrefs[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setEmailPrefs(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function fetchDigest(send: boolean) {
    return fetch("/api/email-digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: allTasks,
        timeline,
        vendors,
        answers,
        budgetCategories,
        emailPrefs: form,
        send,
      }),
    });
  }

  async function handlePreview() {
    setLoadingPreview(true);
    setPreviewError(false);
    try {
      const res = await fetchDigest(false);
      if (!res.ok) throw new Error();
      const data: DigestPreview = await res.json();
      setPreview(data);
    } catch {
      setPreviewError(true);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSendNow() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetchDigest(true);
      if (!res.ok) throw new Error();
      const data: DigestPreview = await res.json();
      setPreview(data);
      setSendResult(data.sent ? "sent" : "error");
    } catch {
      setSendResult("error");
    } finally {
      setSending(false);
    }
  }

  const canSend =
    (form.optInLouis && form.emailLouis.includes("@")) ||
    (form.optInPartner && form.emailPartner.includes("@"));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Digest</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Weekly summary of overdue tasks, upcoming deadlines, and planning milestones.
        </p>
      </div>

      {/* Preferences form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">Preferences</h2>

        {/* Louis */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleChange("optInLouis", !form.optInLouis)}
              className={`w-4 h-4 rounded border-2 shrink-0 transition-colors ${
                form.optInLouis
                  ? "bg-[var(--accent)] border-[var(--accent)]"
                  : "border-gray-300"
              }`}
            />
            <label className="text-sm font-medium text-gray-900">Louis</label>
          </div>
          {form.optInLouis && (
            <input
              type="email"
              value={form.emailLouis}
              onChange={(e) => handleChange("emailLouis", e.target.value)}
              placeholder="louis@example.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          )}
        </div>

        {/* Partner */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleChange("optInPartner", !form.optInPartner)}
              className={`w-4 h-4 rounded border-2 shrink-0 transition-colors ${
                form.optInPartner
                  ? "bg-[var(--accent)] border-[var(--accent)]"
                  : "border-gray-300"
              }`}
            />
            <label className="text-sm font-medium text-gray-900">
              {answers.partnerName || "Partner"}
            </label>
          </div>
          {form.optInPartner && (
            <input
              type="email"
              value={form.emailPartner}
              onChange={(e) => handleChange("emailPartner", e.target.value)}
              placeholder="partner@example.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          )}
        </div>

        {/* Send day */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Preferred send day</label>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((day, i) => (
              <button
                key={day}
                type="button"
                onClick={() => handleChange("sendDay", i as EmailDigestPrefs["sendDay"])}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  form.sendDay === i
                    ? "bg-[var(--accent)] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button onClick={handleSave}>
            {saved ? "Saved" : "Save preferences"}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Digest</h2>
        <p className="text-sm text-gray-500">
          Preview the digest to see what it would contain based on your current plan, or send it
          now to the opted-in addresses.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? "Generating..." : "Preview digest"}
          </Button>

          <Button
            onClick={handleSendNow}
            disabled={sending || !canSend}
          >
            {sending ? "Sending..." : "Send now"}
          </Button>
        </div>

        {!canSend && (
          <p className="text-xs text-gray-400">
            Add at least one email address and opt in to enable sending.
          </p>
        )}

        {sendResult === "sent" && (
          <p className="text-sm text-green-600 font-medium">Digest sent.</p>
        )}
        {sendResult === "error" && (
          <p className="text-sm text-red-500">
            Could not send — check that RESEND_API_KEY is configured.
          </p>
        )}
        {previewError && (
          <p className="text-sm text-red-500">Failed to generate preview.</p>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Subject
              </p>
              <p className="text-sm text-gray-800">{preview.subject}</p>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 flex-wrap">
              <StatPill
                label="Overdue"
                count={preview.stats.overdueTasks}
                color={preview.stats.overdueTasks > 0 ? "red" : "gray"}
              />
              <StatPill label="Due soon" count={preview.stats.upcomingTasks} color="pink" />
              <StatPill label="Milestones" count={preview.stats.upcomingMilestones} color="indigo" />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Plain-text preview
              </p>
              <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-64">
                {preview.plainText}
              </pre>
            </div>

            {!preview.resendConfigured && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Email sending is not yet configured. Set RESEND_API_KEY and (optionally)
                DIGEST_FROM_EMAIL in your environment to enable delivery.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Scheduling info */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
          Automated weekly delivery active
        </p>
        <p className="text-sm text-green-800">
          A digest will be sent automatically every{" "}
          <span className="font-medium">{DAY_NAMES[form.sendDay]}</span> at 9 AM UTC via Vercel
          Cron. Requires <code className="font-mono bg-green-100 px-1 rounded text-xs">RESEND_API_KEY</code>{" "}
          and at least one opted-in email address to deliver.
        </p>
      </div>
    </div>
  );
}

function StatPill({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "red" | "pink" | "indigo" | "gray";
}) {
  const colors = {
    red: "bg-red-50 text-red-600 border-red-200",
    pink: "bg-pink-50 text-pink-700 border-pink-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    gray: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[color]}`}>
      <span className="font-bold">{count}</span> {label}
    </span>
  );
}
