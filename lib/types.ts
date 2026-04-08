export type WeddingVibe =
  | "romantic"
  | "rustic"
  | "modern"
  | "boho"
  | "classic"
  | "whimsical"
  | "minimalist"
  | "glamorous";

export type WeddingPriority =
  | "photography"
  | "food"
  | "music"
  | "flowers"
  | "venue"
  | "honeymoon"
  | "dress"
  | "guest_experience";

export type WeddingSetting = "indoor" | "outdoor" | "mixed" | "destination";

export type FundingSource =
  | "self"
  | "parents"
  | "both"
  | "crowdfunded"
  | "loan";

export type StressSource =
  | "budget"
  | "family"
  | "logistics"
  | "vendor_search"
  | "guest_list"
  | "timeline"
  | "decision_fatigue";

export interface WeddingAnswers {
  partnerName: string;
  date: string; // ISO date string
  location: string;
  guestCount: number;
  budget: number;
  vibe: WeddingVibe[];
  priorities: WeddingPriority[]; // exactly 3
  setting: WeddingSetting;
  funding: FundingSource;
  stress: StressSource[];
}

export interface Vendor {
  id: string;
  category: string;
  name: string;
  contact?: string;
  website?: string;
  price?: number;
  status: "considering" | "contacted" | "booked" | "rejected";
  notes?: string;
  // Venue-specific fields
  rentalPeriod?: string;  // e.g. "8 hours", "full day"
  overtimeRate?: string;  // e.g. "$250/hour"
}

export interface Task {
  id: string;
  title: string;
  dueDate?: string; // ISO date string
  category: string;
  done: boolean;
  priority: "high" | "medium" | "low";
  flag?: string; // e.g. "book early — venues fill 18mo out"
}

export type GuestRelationship = "family" | "close_friend" | "friend" | "acquaintance";
export type GuestLocation    = "local" | "out_of_town";
export type GuestSide        = "bride" | "groom" | "both";

export interface Guest {
  id: string;
  name: string;
  email?: string;
  address?: string;
  plusOne: boolean;
  rsvp: "pending" | "yes" | "no" | "maybe";
  dietary?: string;
  table?: string;
  relationship?: GuestRelationship;
  guestLocation?: GuestLocation;
  side?: GuestSide;
}

export interface TimelineItem {
  id: string;
  title: string;
  targetDate: string; // ISO or relative like "12 months before"
  monthsBefore: number;
  category: string;
  flag?: string;
  done: boolean;
}

export interface AdaptiveAdjustment {
  reason: string;
  delta: number; // percentage points added (pre-normalization)
}

export interface BudgetCategory {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  spent: number;
  tip?: string;
  baselinePercentage: number; // industry default % before any adaptive adjustments
  adjustments: AdaptiveAdjustment[]; // list of rules that changed the baseline
}

export interface Note {
  id: string;
  content: string; // raw markdown from advisor
  savedAt: string; // ISO date
}

export interface ResearchRecommendation {
  id: string;
  title: string;
  description: string;
  priceRange?: string;
  website?: string;
  why: string;
  status?: "open" | "closed" | "unknown"; // verified via web search
  statusNote?: string; // e.g. "Verified via web search April 2025"
}

export interface ResearchChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ResearchSession {
  notes: string;
  recommendations: ResearchRecommendation[];
  chatMessages: ResearchChatMessage[];
  fetchedAt?: string; // ISO date
}

export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
}

export type Tab =
  | "overview"
  | "timeline"
  | "budget"
  | "tasks"
  | "vendors"
  | "guests"
  | "research"
  | "advisor"
  | "digest";

export interface EmailDigestPrefs {
  emailLouis: string;
  emailPartner: string;
  sendDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday … 6 = Saturday
  optInLouis: boolean;
  optInPartner: boolean;
}
