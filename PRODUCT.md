# Product

## Register

brand

## Users

Two audiences, same screens:

- **A product team that already uses PostHog** (PM, UX researcher, founder). They have data on what users do, but not why. They open the tool to see which behavior groups their users fall into, what people said in the AI interview and which reason keeps coming up, so they can decide what to change in the product.
- **The jury at the hackathon demo (today).** They watch on a projector for about 3 minutes, live: a jury member signs a lab report in Folio, a few seconds later shows up in a group, the AI interviews them about what they actually did, the result appears in PostHog, and the group screen shows a synthesis of reasons with quotes. Every screen has to make sense in about 10 seconds, without explanation.

The end users we interview (doctor, developer, banker in Folio) only see the interview screen: a 2 to 3 minute conversation with the AI that starts by asking for consent.

## Product Purpose

Product name: **Because** (the ∵ sign, the math symbol for "because"). "PostHog tells you what users do. Because asks them why, each one about what they actually did."

The tool connects to PostHog, sorts users into behavior groups (code, not a model), runs an AI interview based only on facts computed by code, and sends the result back to PostHog as person properties (`ai_main_reason`), so the product team can build cohorts by reason without code. Success: after one look at a group, the product team knows the main reason, has a quote that proves it and a concrete suggested change; the jury remembers "they asked me about what I had just done."

## Brand Personality

**Human, curious, warm.** People's voices are at the center: quotes are the main material, not decoration. The tone is that of a good researcher: curious, careful, never leading, polite. An insight is stated once in one clear sentence, then backed by evidence.

References:
- **The Pudding / NYT data stories:** the headline is the insight itself, quotes carry people's voices, typography carries the page, data serves the story.
- **Linear:** calm and precise; clear hierarchy, few colors, every element feels considered.

## Anti-references

- **Generic SaaS dashboard:** grey cards in a grid, blue buttons, big metrics with small labels, everything the same weight.
- **AI purple and "sparkle":** purple gradients, stars and "magic" icons for everything the AI does.
- **A PostHog clone:** dense analytics UI full of charts and filters. We are the "why", not another "what".
- **Cream/beige "editorial":** a warm paper background with a serif that today looks like every AI website.

## Design Principles

1. **The user's voice comes first.** The answer to "why" is shown in the user's words; the quote is the evidence and the main content, the people count follows it.
2. **The insight is the headline.** Every screen starts with a sentence that says what was found (the synthesis takeaway, the main reason), and details and tables come below.
3. **Evidence before claims.** Code computes the facts, code counts the people, quotes are verbatim, and the AI cites which facts it used. The interface shows this, not just claims it.
4. **Honest about simulation.** Simulated results are always clearly labeled, and a real live interview stands out; the jury must never think everything is fake.
5. **Calm background, one voice.** Like Linear: few colors and little decoration, so what matters (the insight, the quote, the live person) clearly stands out.

## Accessibility & Inclusion

- WCAG 2.2 AA: text contrast at least 4.5:1 (large text 3:1), no light grey text on a light background.
- Readable from a projector in a lit room: body text at least 16px, key numbers and insights large, state (live, simulated, written to PostHog) never shown by color alone.
- `prefers-reduced-motion` is respected: animations have an instant or crossfade alternative.
- The interface is in English; the interview is polite and warm.
