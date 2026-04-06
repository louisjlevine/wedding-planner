"use client";

import { useState } from "react";
import { usePlanStore } from "@/lib/plan-store";
import type {
  WeddingAnswers,
  WeddingVibe,
  WeddingPriority,
  WeddingSetting,
  FundingSource,
  StressSource,
} from "@/lib/types";

const VIBES: { value: WeddingVibe; label: string }[] = [
  { value: "romantic", label: "Romantic" },
  { value: "rustic", label: "Rustic" },
  { value: "modern", label: "Modern" },
  { value: "boho", label: "Boho" },
  { value: "classic", label: "Classic" },
  { value: "whimsical", label: "Whimsical" },
  { value: "minimalist", label: "Minimalist" },
  { value: "glamorous", label: "Glamorous" },
];

const PRIORITIES: { value: WeddingPriority; label: string }[] = [
  { value: "photography", label: "Photography" },
  { value: "food", label: "Food & Drink" },
  { value: "music", label: "Music" },
  { value: "flowers", label: "Flowers & Decor" },
  { value: "venue", label: "Venue" },
  { value: "honeymoon", label: "Honeymoon" },
  { value: "dress", label: "Attire" },
  { value: "guest_experience", label: "Guest Experience" },
];

const SETTINGS: { value: WeddingSetting; label: string; desc: string }[] = [
  { value: "indoor", label: "Indoor", desc: "Ballroom, restaurant, barn" },
  { value: "outdoor", label: "Outdoor", desc: "Garden, beach, field" },
  { value: "mixed", label: "Mixed", desc: "Ceremony outdoors, reception in" },
  { value: "destination", label: "Destination", desc: "Away from home base" },
];

const FUNDING: { value: FundingSource; label: string }[] = [
  { value: "self", label: "Paying ourselves" },
  { value: "parents", label: "Parent-funded" },
  { value: "both", label: "Mix of both" },
  { value: "crowdfunded", label: "Guests contributing" },
  { value: "loan", label: "Financing / loan" },
];

const STRESS: { value: StressSource; label: string }[] = [
  { value: "budget", label: "Staying on budget" },
  { value: "family", label: "Family dynamics" },
  { value: "logistics", label: "Logistics & coordination" },
  { value: "vendor_search", label: "Finding vendors" },
  { value: "guest_list", label: "Guest list decisions" },
  { value: "timeline", label: "Fitting everything in" },
  { value: "decision_fatigue", label: "Too many decisions" },
];

type Season = "Spring" | "Summer" | "Autumn" | "Winter";

const SEASONS: { value: Season; desc: string }[] = [
  { value: "Spring", desc: "Mar – May" },
  { value: "Summer", desc: "Jun – Aug" },
  { value: "Autumn", desc: "Sep – Nov" },
  { value: "Winter", desc: "Dec – Feb" },
];

// Map season + year → representative ISO date
function seasonToDate(season: Season, year: number): string {
  const month = { Spring: "05", Summer: "07", Autumn: "10", Winter: "12" }[season];
  return `${year}-${month}-15`;
}

function defaultSeason(): { season: Season; year: number } {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const month = d.getMonth() + 1; // 1-12
  let season: Season =
    month <= 2 || month === 12 ? "Winter" :
    month <= 5 ? "Spring" :
    month <= 8 ? "Summer" : "Autumn";
  return { season, year: d.getFullYear() };
}

const BUDGET_RANGES: { label: string; sub: string; value: number }[] = [
  { label: "Under $15k",    sub: "Micro / elopement",  value: 12_000 },
  { label: "$15k – $30k",   sub: "Small & intimate",   value: 22_000 },
  { label: "$30k – $50k",   sub: "Mid-range",          value: 40_000 },
  { label: "$50k – $75k",   sub: "Comfortable",        value: 62_000 },
  { label: "$75k – $100k",  sub: "Generous",           value: 87_000 },
  { label: "$100k – $150k", sub: "Luxury",             value: 125_000 },
  { label: "$150k+",        sub: "Ultra-luxury",       value: 175_000 },
];

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const TOTAL_STEPS = 10;

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-1 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-1 rounded-full transition-all ${
            i <= step ? "bg-[#D4537E]" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function StepLabel({ step }: { step: number }) {
  return (
    <p className="text-xs text-gray-400 mb-2">
      Step {step + 1} of {TOTAL_STEPS}
    </p>
  );
}

export function Intake() {
  const setAnswers = usePlanStore((s) => s.setAnswers);

  const [step, setStep] = useState<Step>(0);
  const [partnerName, setPartnerName] = useState("");
  const { season: defaultSeasonVal, year: defaultYear } = defaultSeason();
  const [season, setSeason] = useState<Season>(defaultSeasonVal);
  const [year, setYear] = useState<number>(defaultYear);
  const [location, setLocation] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [vibe, setVibe] = useState<WeddingVibe[]>([]);
  const [priorities, setPriorities] = useState<WeddingPriority[]>([]);
  const [setting, setSetting] = useState<WeddingSetting | "">("");
  const [funding, setFunding] = useState<FundingSource | "">("");
  const [stress, setStress] = useState<StressSource[]>([]);

  function toggleVibe(v: WeddingVibe) {
    setVibe((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  function togglePriority(p: WeddingPriority) {
    setPriorities((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (prev.length >= 3) return prev;
      return [...prev, p];
    });
  }

  function toggleStress(s: StressSource) {
    setStress((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1) as Step);
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0) as Step);
  }

  function finish() {
    const answers: WeddingAnswers = {
      partnerName,
      date: seasonToDate(season, year),
      location,
      guestCount: parseInt(guestCount, 10),
      budget: budget!,
      vibe,
      priorities,
      setting: setting as WeddingSetting,
      funding: funding as FundingSource,
      stress,
    };
    setAnswers(answers);
  }

  const canProceed = [
    !!partnerName.trim(),
    true, // season+year always valid (has defaults)
    !!location.trim(),
    !!guestCount && parseInt(guestCount) > 0,
    budget !== null,
    vibe.length > 0,
    priorities.length === 3,
    !!setting,
    !!funding,
    stress.length > 0,
  ][step];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Wedding Planner</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tell us about your wedding so we can personalise everything.
          </p>
        </div>

        <ProgressBar step={step} />

        {/* Step 0: Partner name */}
        {step === 0 && (
          <div>
            <StepLabel step={0} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Who are you marrying?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Your partner&apos;s name
            </p>
            <input
              type="text"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#D4537E] focus:ring-1 focus:ring-[#D4537E]"
              onKeyDown={(e) => e.key === "Enter" && canProceed && next()}
              autoFocus
            />
          </div>
        )}

        {/* Step 1: Season + Year */}
        {step === 1 && (
          <div>
            <StepLabel step={1} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              When&apos;s the big day?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Season and year — you can refine the exact date later
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SEASONS.map(({ value, desc }) => (
                <button
                  key={value}
                  onClick={() => setSeason(value)}
                  className={`px-4 py-3 rounded-lg text-sm border transition-all text-left ${
                    season === value
                      ? "bg-[#D4537E] text-white border-[#D4537E]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#D4537E]"
                  }`}
                >
                  <div className="font-medium">{value}</div>
                  <div className={`text-xs mt-0.5 ${season === value ? "text-pink-100" : "text-gray-400"}`}>
                    {desc}
                  </div>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-[#D4537E] focus:ring-1 focus:ring-[#D4537E]"
              >
                {[0, 1, 2, 3].map((offset) => {
                  const y = new Date().getFullYear() + offset;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            <p className="text-xs text-[#D4537E] mt-3">
              Planning for {season} {year} — roughly {seasonToDate(season, year).slice(0, 7)}
            </p>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div>
            <StepLabel step={2} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Where will you celebrate?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              City, region, or venue area
            </p>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Tuscany, Italy or Nashville, TN"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#D4537E] focus:ring-1 focus:ring-[#D4537E]"
              onKeyDown={(e) => e.key === "Enter" && canProceed && next()}
              autoFocus
            />
          </div>
        )}

        {/* Step 3: Guest count */}
        {step === 3 && (
          <div>
            <StepLabel step={3} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              How many guests?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Your estimated headcount
            </p>
            <input
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="e.g. 120"
              min="1"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#D4537E] focus:ring-1 focus:ring-[#D4537E]"
              onKeyDown={(e) => e.key === "Enter" && canProceed && next()}
              autoFocus
            />
            {parseInt(guestCount) < 50 && parseInt(guestCount) > 0 && (
              <p className="text-xs text-[#D4537E] mt-2">
                Intimate wedding — you&apos;ll have more flexibility with venues.
              </p>
            )}
          </div>
        )}

        {/* Step 4: Budget */}
        {step === 4 && (
          <div>
            <StepLabel step={4} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              What&apos;s your total budget?
            </h2>
            <p className="text-sm text-gray-500 mb-4">All-in, including everything</p>
            <div className="space-y-2">
              {BUDGET_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setBudget(range.value)}
                  className={`w-full px-4 py-3 rounded-lg text-sm border transition-all flex items-center justify-between ${
                    budget === range.value
                      ? "bg-[#D4537E] text-white border-[#D4537E]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#D4537E]"
                  }`}
                >
                  <span className="font-medium">{range.label}</span>
                  <span className={`text-xs ${budget === range.value ? "text-pink-100" : "text-gray-400"}`}>
                    {range.sub}
                  </span>
                </button>
              ))}
            </div>
            {budget !== null && budget >= 100_000 && (
              <p className="text-xs text-[#D4537E] mt-3">
                Luxury budget — we&apos;ll include premium vendor suggestions.
              </p>
            )}
          </div>
        )}

        {/* Step 5: Vibe */}
        {step === 5 && (
          <div>
            <StepLabel step={5} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              What&apos;s your wedding vibe?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Pick all that apply
            </p>
            <div className="grid grid-cols-2 gap-2">
              {VIBES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleVibe(value)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    vibe.includes(value)
                      ? "bg-[#D4537E] text-white border-[#D4537E]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#D4537E]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Priorities */}
        {step === 6 && (
          <div>
            <StepLabel step={6} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Your top 3 priorities
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Pick exactly 3 — these shape your budget and advice
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map(({ value, label }) => {
                const selected = priorities.includes(value);
                const disabled = !selected && priorities.length >= 3;
                return (
                  <button
                    key={value}
                    onClick={() => !disabled && togglePriority(value)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      selected
                        ? "bg-[#D4537E] text-white border-[#D4537E]"
                        : disabled
                        ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#D4537E]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {priorities.length}/3 selected
            </p>
          </div>
        )}

        {/* Step 7: Setting */}
        {step === 7 && (
          <div>
            <StepLabel step={7} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Indoor or outdoor?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Your preferred setting
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SETTINGS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setSetting(value)}
                  className={`px-4 py-3 rounded-lg text-sm border transition-all text-left ${
                    setting === value
                      ? "bg-[#D4537E] text-white border-[#D4537E]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#D4537E]"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      setting === value ? "text-pink-100" : "text-gray-400"
                    }`}
                  >
                    {desc}
                  </div>
                </button>
              ))}
            </div>
            {(setting === "outdoor" || setting === "mixed") && (
              <p className="text-xs text-[#D4537E] mt-3">
                We&apos;ll add weather contingency tasks to your plan.
              </p>
            )}
          </div>
        )}

        {/* Step 8: Funding */}
        {step === 8 && (
          <div>
            <StepLabel step={8} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              How are you funding this?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Helps us tailor budget advice
            </p>
            <div className="space-y-2">
              {FUNDING.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFunding(value)}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-medium border transition-all text-left ${
                    funding === value
                      ? "bg-[#D4537E] text-white border-[#D4537E]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#D4537E]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 9: Stress */}
        {step === 9 && (
          <div>
            <StepLabel step={9} />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              What worries you most?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Pick all that apply — we&apos;ll address these head-on
            </p>
            <div className="grid grid-cols-1 gap-2">
              {STRESS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleStress(value)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all text-left ${
                    stress.includes(value)
                      ? "bg-[#D4537E] text-white border-[#D4537E]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#D4537E]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={back}
            className={`px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors ${
              step === 0 ? "invisible" : ""
            }`}
          >
            Back
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={next}
              disabled={!canProceed}
              className="px-6 py-2.5 bg-[#D4537E] text-white text-sm font-medium rounded-lg hover:bg-[#bf4a70] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={!canProceed}
              className="px-6 py-2.5 bg-[#D4537E] text-white text-sm font-medium rounded-lg hover:bg-[#bf4a70] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Let&apos;s go
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
