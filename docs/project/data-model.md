# Data Model

No database — all state lives in a Zustand store persisted to `localStorage` under the key `wedding-planner-store`. The store is defined in `lib/plan-store.ts`; types in `lib/types.ts`.

**If you add or rename a field, also update the migration logic in `migratePlanStore()` in `lib/plan-store.ts` and bump the version number.**

## WeddingAnswers

The root configuration object — drives all adaptive logic.

| Field | Type | Notes |
|---|---|---|
| partnerName | string | |
| date | string | ISO date |
| dateIsExact | boolean? | true = the couple picked this exact day; false/undefined = placeholder derived from a season + year (15th of the season's middle month). Display goes through `describeWeddingDate()` in `lib/date-utils.ts`. |
| location | string | city / region free text |
| guestCount | number | |
| budget | number | total in dollars |
| vibe | WeddingVibe[] | multi-select |
| priorities | WeddingPriority[] | exactly 3 |
| setting | WeddingSetting | indoor / outdoor / mixed / destination |
| funding | FundingSource | self / parents / both / crowdfunded / loan |
| stress | StressSource[] | multi-select |

## Vendor

| Field | Type | Notes |
|---|---|---|
| id | string | uuid |
| category | string | venue / catering / photography / etc. |
| name | string | |
| contact | string? | |
| website | string? | |
| price | number? | legacy flat price; superseded by costModel |
| status | "considering" \| "contacted" \| "booked" \| "rejected" | |
| tags | string[]? | |
| notes | string? | legacy free-form text; still rendered if present |
| notesList | VendorNote[]? | append-only note objects (id, text, addedAt) |
| attachments | VendorAttachment[]? | base64 data URLs, client-resized |
| costModel | VendorCostModel? | base + overtime + perPerson |
| packages | CatererPackage[]? | catering: package list with per-person pricing |
| miscLineItems | MiscLineItem[]? | extra cost lines; ids reference shared MiscLineItemLabel registry |
| barMode | BarMode? | venue: "self_host" or "via_caterer" |
| barSelfHostAmount | number? | venue + self_host: total alcohol budget |
| barVendorId | string? | venue + via_caterer: id of chosen caterer / bar vendor |
| barCostModel | { base?, perPerson? }? | caterer: bar pricing separate from food |

## Task

| Field | Type | Notes |
|---|---|---|
| id | string | |
| title | string | |
| dueDate | string? | ISO date |
| category | string | |
| done | boolean | |
| priority | "high" \| "medium" \| "low" | |
| flag | string? | advisory note, e.g. "book early — venues fill 18mo out" |

## Guest

| Field | Type | Notes |
|---|---|---|
| id | string | |
| name | string | |
| email | string? | |
| address | string? | |
| totalGuests | number | counts the whole party (1 = solo) |
| rsvp | "pending" \| "yes" \| "no" \| "maybe" | |
| dietary | string? | |
| table | string? | |
| relationship | GuestRelationship? | family / close_friend / friend / acquaintance |
| guestLocation | GuestLocation? | local / out_of_town |
| side | GuestSide? | bride / groom / both |
| priority | GuestPriority? | must / want / ifSpace |

## Derived types (read-only, never persisted)

- **TimelineItem** — produced by `buildTimeline()` in `lib/plan-adapters.ts`
- **BudgetCategory** — produced by `buildBudgetCategories()`; includes `adjustments[]` for adaptive boosts
- **ResearchSession** — per-type research notes + recommendations + chat messages (persisted in store)
- **AdvisorMessage** — advisor chat history (persisted in store)
- **ComparisonSelection** — active venue comparison config (persisted in store)
- **EmailDigestPrefs** — digest email settings (persisted in store)

## MiscLineItemLabel registry

Shared label library for miscellaneous vendor cost lines. Adding a label to one vendor makes it available to all; removing it strips that line item from every vendor. Stored as `miscLineItemLabels: MiscLineItemLabel[]` on the root store. Each `Vendor.miscLineItems[].id` must reference a library entry.
