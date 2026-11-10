# Remix of Remix of Health Companion

App Context

This is an additive feature inside an existing patient app.

Patients can ask questions about their own Mediboard records.

Responses include a plain-language explanation plus expandable Sources linked to Mediboard items.

Two “wow” features must be prominent:

Deep Research button (like ChatGPT) that produces a structured mini-report with citations.

Pre-baked prompt chips to start conversations instantly.

Design System

Clean medical app aesthetic: white background, soft neutrals, minimal color accents.

Rounded cards, clear typography, generous spacing.

Accessibility: readable font sizes, high contrast for text.

Use subtle icons (chat, search, document, timeline).

Primary CTA color: calm blue/teal.

Secondary CTA: outline/ghost.

Screens to Generate
Screen 1: “Ask AI about my health” Entry Point

Purpose: Entry into chatbot from existing app.

Layout:

Top nav bar with Mediboard app shell: logo left, profile icon right.

Page title: “AI Health Assistant”

Short explainer card:

Title: “Ask questions about your own medical history”

Body: “Get clear answers based on your Mediboard records. Read-only. Always check sources.”

Primary button centered: “Start Chat”

For POC demo only, include a small inline field before starting:

Label: “Patient ID (POC only)”

Placeholder: “Enter your patient_id”

Helper text: “In production this uses your login.”

Below, show 3–4 pre-baked prompt chips as examples:

“Summarize my last 12 months of key medical events.”

“Show my cholesterol trend in the last 3 years.”

“What medications and supplements am I currently taking?”

“What changed in my bloodwork since starting [medication]?”

Interaction:

Tapping Start Chat opens Screen 2.

Tapping a chip also opens Screen 2 with that prompt pre-filled/sent.

Screen 2: Chat View (Main Experience)

Purpose: Conversational Q&A over patient records.

Layout:

Header:

Title: “AI Health Assistant”

Right-side small button: “Deep Research” (sparkle/search icon)

Chat area:

Patient messages in right-aligned bubbles.

Assistant messages in left-aligned bubbles.

First assistant welcome message:

“Hi, I can help you understand your Mediboard records. Ask a question or tap a suggestion. I’m not a doctor.”

Show prompt chips above input when chat is empty and also as a collapsible tray:

same chips as Screen 1 plus one more: “List my diagnostic tests in the last 2 years.”

Input bar:

Placeholder: “Ask about visits, tests, meds…”

Send icon.

Example Conversation (preloaded for demo):

Patient: “Show my cholesterol trend in the last 3 years.”

Assistant response card:

Short narrative summary (plain language).

Tiny embedded line chart placeholder labeled “Cholesterol (3y trend)” (no real data needed, just a visual).

CTA row:

“View Sources” (expandable)

“Ask a follow-up”

Sources accordion expanded in demo showing 3 linked items:

“Diagnostic Test: Lipid Panel — 2024-02-12”

“Diagnostic Test: Lipid Panel — 2023-05-09”

“Visit Note — 2022-11-21”

Disclaimer line: “For interpretation or treatment decisions, consult your clinician.”

Error State (secondary example, small):

If a question is out of scope:

Friendly refusal bubble: “I can’t answer that safely. Please discuss with your doctor. Here are relevant records you can review.”

Interactions:

Tapping Deep Research opens Screen 3.

Tapping a source opens a small modal with record snippet + “Open full record” link (mock).

Screen 3: Deep Research Mode (Wow Feature)

Purpose: Produce richer structured report with citations.

Layout:

Header: “Deep Research Report”

Subheader: “Based on your Mediboard records (read-only)”

Timeframe selector row:

Dropdown/pill: “Last 3 years” (default)

Option to change: “Last 12 months / 5 years / Custom”

Generate Report button (primary).

Report Output (preloaded in demo after generation):
Show a multi-section scrollable report in cards:

Overview

3–5 bullet summary of major events.

Key Findings & Trends

2–3 trend callouts with small chart placeholders.

Medications / Supplements Timeline

Simple vertical timeline UI.

Notable Diagnostic Tests

Table/list with dates and highlights.

Questions to Ask Your Doctor

3 suggested questions.

Sources

Expandable list of cited Mediboard entries (at least 3), same as chat sources.

Safety footer: “This report is informational and not medical advice.”

Interactions:

Back button returns to chat.

Tapping a source opens record modal (same as Screen 2).

Prototype Requirements

Make it feel like it lives inside an existing Mediboard patient app.

Prioritize the two wow features visually:

Deep Research button prominent in chat header.

Pre-baked prompt chips visible on entry and chat.

Use realistic microcopy for trust and safety.

Keep demo lightweight: no clinician features, no write actions.

Ensure flows are clickable between screens.

Generate these 3 screens with linked interactions and preloaded example content for a polished client demo.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2fc26939-b219-450a-8d83-85503bc81b35).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
