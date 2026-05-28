import type { Vendor } from "@/lib/types";

// Status → dot color, shared by the Vendors list and the Compare table so the
// two stay in sync.
export const STATUS_DOT: Record<Vendor["status"], string> = {
  considering: "bg-gray-400",
  contacted:   "bg-yellow-400",
  booked:      "bg-green-500",
  rejected:    "bg-red-400",
};
