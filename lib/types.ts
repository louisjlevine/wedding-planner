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

export interface VendorAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;       // base64 data URL (images resized client-side)
  addedAt: string;       // ISO date
}

export interface VendorNote {
  id: string;
  text: string;
  addedAt: string; // ISO date
}

export interface VendorCostModel {
  base?: number;            // flat fee (venue rental, catering minimum, bar setup)
  hoursIncluded?: number;   // venue: hours included in base price
  overtimeHourly?: number;  // venue: $ per extra hour
  perPerson?: number;       // catering / bar: $ per guest (legacy — caterers now use packages)
}

export interface CatererPackage {
  id: string;
  name: string;
  perPerson?: number;
  base?: number;
  description?: string;
}

export interface MiscLineItem {
  id: string;     // matches MiscLineItemLabel.id when sourced from the shared library
  label: string;  // denormalized for back-compat; library label is the source of truth
  cost: number;
}

// Shared registry of misc line item labels. Adding a label to one vendor makes
// it available to all vendors; deleting removes it from all vendors that had a
// cost recorded for it.
export interface MiscLineItemLabel {
  id: string;
  label: string;
}

export interface Vendor {
  id: string;
  category: string;
  name: string;
  contact?: string;
  website?: string;
  price?: number;
  status: "considering" | "contacted" | "booked" | "rejected";
  tags?: string[];
  notes?: string;           // legacy — still rendered if present
  notesList?: VendorNote[];
  attachments?: VendorAttachment[];
  // Venue-specific fields
  rentalPeriod?: string;  // e.g. "8 hours", "full day"
  overtimeRate?: string;  // e.g. "$250/hour"
  barMode?: BarMode;      // venue: which bar setup this venue uses
  barSelfHostAmount?: number; // venue + self_host: total alcohol budget
  barVendorId?: string;       // venue + via_caterer: id of selected caterer or bar vendor
  // Catering-specific
  packages?: CatererPackage[];
  // Catering-specific: optional bar / alcohol pricing when this caterer also
  // handles drinks. Treated separately from food packages so Compare can
  // surface food and bar lines independently.
  barCostModel?: {
    base?: number;
    perPerson?: number;
  };
  // Extra cost lines surfaced as "Misc" in the Compare table
  miscLineItems?: MiscLineItem[];
  // Structured cost model used by the Compare dashboard
  costModel?: VendorCostModel;
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
export type GuestPriority    = "must" | "want" | "ifSpace";

export interface Guest {
  id: string;
  name: string;
  email?: string;
  address?: string;
  totalGuests: number;
  rsvp: "pending" | "yes" | "no" | "maybe";
  dietary?: string;
  table?: string;
  relationship?: GuestRelationship;
  guestLocation?: GuestLocation;
  side?: GuestSide;
  priority?: GuestPriority;
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
  description?: string; // what this category covers, context-aware
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
  | "compare"
  | "guests"
  | "research"
  | "advisor"
  | "digest";

export type BarMode = "self_host" | "via_caterer";

export interface VenueComparisonConfig {
  catererId?: string;        // single caterer per venue
  packageId?: string;        // selected package from that caterer
  // Bar mode + amount/vendor now live on the venue itself (Vendor.barMode,
  // barSelfHostAmount, barVendorId). These legacy fields stay for migration
  // and are ignored at read time.
  barFlatBudget?: number;
  barPerPerson?: number;
}

export interface ComparisonSelection {
  venueIds: string[];
  venueConfigs: Record<string, VenueComparisonConfig>;
  guestCount?: number;       // override; falls back to answers.guestCount
  hours?: number;            // total event hours used for overtime math
  notes: string;
}

export interface EmailDigestPrefs {
  emailLouis: string;
  emailPartner: string;
  sendDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday … 6 = Saturday
  optInLouis: boolean;
  optInPartner: boolean;
}
