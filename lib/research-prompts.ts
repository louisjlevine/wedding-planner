import type { WeddingAnswers } from "./types";

export type ResearchType =
  | "venue"
  | "photographer"
  | "caterer"
  | "florist"
  | "music"
  | "dress"
  | "honeymoon"
  | "timeline"
  | "budget";

export function buildResearchPrompt(
  type: ResearchType,
  answers: WeddingAnswers
): string {
  const isLuxury = answers.budget >= 100_000;
  const isSmall = answers.guestCount < 50;
  const isMountain =
    answers.location.toLowerCase().includes("mountain") ||
    answers.location.toLowerCase().includes("colorado") ||
    answers.location.toLowerCase().includes("aspen") ||
    answers.location.toLowerCase().includes("vail");
  const isOutdoor = answers.setting === "outdoor" || answers.setting === "mixed";

  const context = `
Wedding context:
- Partner: ${answers.partnerName}
- Date: ${answers.date}
- Location: ${answers.location}
- Guests: ${answers.guestCount}
- Budget: $${answers.budget.toLocaleString()}${isLuxury ? " (luxury tier)" : ""}
- Vibe: ${answers.vibe.join(", ")}
- Priorities: ${answers.priorities.join(", ")}
- Setting: ${answers.setting}
- Funding: ${answers.funding}
`.trim();

  const prompts: Record<ResearchType, string> = {
    venue: `${context}

Research wedding venues for this couple. Cover:
1. Best venue types that match their ${answers.vibe.join("/")} vibe and ${answers.setting} setting preference
2. What to look for when touring venues
3. Key contract red flags to watch for
4. Typical pricing at their budget level in ${answers.location}
${isMountain ? "5. Mountain-specific: venue availability fills 18+ months out — emphasize early booking" : ""}
${isSmall ? "5. Tips for intimate venues under 50 guests" : ""}
${isLuxury ? "5. Luxury venue options and exclusive buyouts worth considering" : ""}
6. Questions to ask every venue

Be specific and practical. Format with clear sections.`,

    photographer: `${context}

Research wedding photographers. Cover:
1. Photography styles that match their ${answers.vibe.join("/")} aesthetic
2. What to look for in a portfolio
3. Questions to ask photographers during consultations
4. Typical pricing and packages at their budget level
${isLuxury ? "4. Fine art film photographers and luxury studios worth the premium" : ""}
5. Contract essentials (rights, backups, timeline)
6. How to coordinate a shot list with ${answers.guestCount} guests
7. Tips for the wedding day photography timeline

Be specific and practical.`,

    caterer: `${context}

Research wedding catering options. Cover:
1. Catering styles (plated, buffet, family-style, stations) that suit ${answers.guestCount} guests
2. How to evaluate caterers
3. Beverage and bar options
4. Budget breakdown — what's realistic at $${answers.budget.toLocaleString()} for catering
${isLuxury ? "4. Premium catering experiences worth considering at this budget" : ""}
5. Dietary accommodation best practices
6. Questions to ask caterers
7. Timing the meal service

Be specific and practical.`,

    florist: `${context}

Research wedding flowers and decor. Cover:
1. Floral styles that match their ${answers.vibe.join("/")} vibe
2. Seasonal flower availability around ${answers.date}
3. Budget allocation guidance for flowers
4. DIY vs professional tradeoffs
${isOutdoor ? "4. Outdoor-specific: weather-resistant flowers and wind-proof arrangements" : ""}
5. What's included in typical florist packages
6. Questions to ask florists
7. Trending designs vs timeless choices

Be specific and practical.`,

    music: `${context}

Research wedding music and entertainment. Cover:
1. Band vs DJ — pros/cons at their budget
2. What to look for in wedding bands/DJs
3. Ceremony music options (live vs recorded)
4. Building a must-play / do-not-play list
5. Coordinating with a ${answers.guestCount}-person crowd
${isLuxury ? "5. Premium entertainment options (live band, string quartet, etc.) worth considering" : ""}
6. Sound equipment and venue logistics
7. Questions to ask vendors

Be specific and practical.`,

    dress: `${context}

Research wedding attire. Cover:
1. Dress silhouettes and styles that complement ${answers.vibe.join("/")} vibe
2. Shopping timeline — when to start, fittings schedule
3. Budgeting for dress + alterations + accessories
4. Designer boutique vs off-the-rack options
5. What to bring to appointments
6. Groom/partner attire coordination tips
7. Day-of attire logistics

Be specific and practical.`,

    honeymoon: `${context}

Research honeymoon planning. Cover:
1. Destination ideas that match their ${answers.vibe.join("/")} vibe and ${answers.location} base
2. Best timing relative to their ${answers.date} wedding date
3. Budget guidance for honeymoon
${isLuxury ? "3. Luxury honeymoon experiences and resorts" : ""}
4. Booking timeline and deals
5. Travel logistics (passports, visas, insurance)
6. How to manage stress of planning during wedding prep
7. Mini-moon option if timing is tight

Be specific and practical.`,

    timeline: `${context}

Create a detailed wedding day timeline for ${answers.guestCount} guests at ${answers.location}. Include:
1. Getting-ready schedule (hair, makeup, photos)
2. Ceremony timing and flow
3. Cocktail hour
4. Reception: entrance, dinner, speeches, first dances, cake cutting, open dance floor
${isOutdoor ? "5. Buffer time for outdoor logistics and potential weather considerations" : ""}
5. Grand exit
6. Vendor coordination notes
7. Common timing mistakes to avoid

Format as a clear hour-by-hour schedule.`,

    budget: `${context}

Provide detailed wedding budget guidance. Cover:
1. How to allocate $${answers.budget.toLocaleString()} across categories
${answers.priorities.includes("photography") ? "   - Photography is a priority: suggest boosting that category" : ""}
${answers.priorities.includes("food") ? "   - Food/catering is a priority: suggest boosting that category" : ""}
2. Hidden costs most couples forget
3. Where to splurge vs save at this budget level
${isLuxury ? "3. Luxury upgrades that are worth it vs overrated" : ""}
4. How to track spending throughout planning
5. Negotiation tips with vendors
6. Contingency fund guidance (typically 5-10%)
7. Payment schedules and deposits

Be specific and practical.`,
  };

  return prompts[type];
}
