# CareLoop — AI Care Coordination Platform

CareLoop is a full-stack cooperative multi-agent AI platform that helps families coordinate daily care for elderly loved ones living alone. It makes invisible care work visible by connecting an elderly person's daily routine with their caregiver's dashboard — automatically, safely, and without requiring constant manual check-ins.

## The Story

- **Aino (80)** lives alone. She wants to stay independent but needs reminders for medications and meals.
- **Saara (45)** is Aino's daughter and works full-time. She cannot manually check in every hour.

CareLoop sits between them: it monitors Aino's daily tasks, calls her when something is missed, escalates to Saara if she doesn't answer, intercepts Aino's emails so bills never stress her, and gives Saara a real-time dashboard of everything.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Email | MailHog — local SMTP server (port 1025, web UI port 8025) |
| Database | Local JSON file (`localDb.json`) — zero setup, no Postgres needed |
| Voice calls | Simulated by default — ElevenLabs + Twilio when keys are provided |

---

## Architecture — 8 Cooperative AI Agents

Every agent calls Gemini with a structured JSON schema. If `GEMINI_API_KEY` is not set, a deterministic mock fallback activates automatically so the app still runs for demos without an API key.

### 1. Care Coordinator Agent
`src/lib/agents/careCoordinatorAgent.ts`

The brain of the system. Runs on every overdue task check cycle. It receives the task's current state, the full voice call history, and the latest passive wearable signal. Gemini decides the next action:

- **Overdue, no calls yet** → trigger voice reminder (Call 1)
- **1 call failed, 5+ min elapsed** → trigger voice reminder (Call 2)
- **2 calls failed** → escalate to Saara
- **Aino said "I need help"** → immediate urgent escalation
- **All good** → no action

Every message it generates is passed through the Safety Agent before being stored or sent.

### 2. Voice Reminder Agent
`src/lib/agents/voiceReminderAgent.ts`

Generates a natural call script for Aino, validates it through the Safety Agent, then places the call. In production it uses ElevenLabs Conversational AI + Twilio. Without those keys it runs a simulated adapter that mirrors the same state machine (answered / no answer / needs help / remind later). The call outcome updates the task status and triggers the next coordinator cycle.

### 3. Safety & Escalation Agent
`src/lib/agents/safetyEscalationAgent.ts`

Every single piece of outbound text — call scripts, SMS alerts, caregiver recommendations — passes through this agent before being used. Gemini scans for and rewrites any language that:
- makes a medical diagnosis (dementia, Alzheimer's, illness)
- creates panic (emergency, danger, medically unsafe)
- gives medication instructions or dosages

If Gemini misses something, a deterministic code-level check catches it as a second layer.

### 4. Caregiver Alert Agent
`src/lib/agents/caregiverAlertAgent.ts`

Creates structured alerts on Saara's dashboard when the Coordinator escalates. Validates the alert message through the Safety Agent, saves the alert, and optionally places a voice call to Saara's phone for high/urgent risk levels.

### 5. Morning Briefing Agent
`src/lib/agents/morningBriefingAgent.ts`

Generates a calm daily summary for Saara combining today's scheduled tasks and Aino's latest passive wearable signals. Keeps language family-friendly — no diagnoses, no panic. The recommendation is validated by the Safety Agent before being saved.

### 6. Passive Signal Retrieval Agent
`src/lib/agents/passiveSignalRetrievalAgent.ts`

Pulls biometric data from the wearable adapter (mock data in three scenarios: `normal_day`, `watch_day`, `concern_day`). If signals show a `concern` level, Gemini writes a contextual health summary alert and routes it to Saara's dashboard.

### 7. Email Dispatcher & Task Agent
`src/lib/agents/emailRetrievalAgent.ts`

Reads Aino's inbox from MailHog, passes each email to Gemini for classification, and acts on the result:

| Email type | Gemini action | Result |
|---|---|---|
| Bill / invoice / payment | `send_to_saara` | Alert on Saara's dashboard only — Aino never sees financial stress |
| Appointment / task / request | `create_task` | Task created for Aino + alert on Saara's dashboard |
| Spam / irrelevant | `ignore` | Nothing happens |

Gemini also evaluates `risk_level` (`low` / `medium` / `high` / `urgent`) based on urgency, due dates, and content. After processing, each email is deleted from MailHog.

### 8. Impact Measurement Agent
`src/lib/agents/impactMeasurementAgent.ts`

Aggregates live system data into KPIs: average alert resolution time, safety compliance rate (% of messages not blocked), outreach success rate (calls answered), and total agent interventions. Shown on the Technical Agent Monitor page.

---

## Agent Flow Diagram

```
Email arrives in MailHog
        ↓
Email Dispatcher Agent (Gemini classifies)
        ↓
    bill? → Alert to Saara only
    task? → Task for Aino + Alert to Saara
        ↓
Task becomes overdue
        ↓
Care Coordinator Agent (Gemini decides action)
        ↓
    trigger_voice_reminder → Voice Reminder Agent → Safety Agent → Call Aino
    escalate_to_caregiver  → Caregiver Alert Agent → Safety Agent → Alert + Call Saara
    no_action              → wait
        ↓
Morning Briefing Agent (Gemini writes daily summary for Saara)
        ↓
Passive Signal Agent (mock wearable data → Gemini health analysis if concern)
        ↓
Safety Agent validates every outbound message
        ↓
Impact Agent measures all of the above
```

---

## Database

No Postgres, no setup. Everything persists to `localDb.json` at the project root via a file-based adapter in `src/lib/database/server.ts`. Tables: `users`, `care_pairs`, `tasks`, `alerts`, `voice_calls`, `passive_signals`, `morning_briefs`, `agent_action_logs`.

`localDb.json` is git-ignored. On first run the app auto-seeds Aino and Saara with demo tasks.

---

## Running the Project

### 1. Prerequisites

- Node.js 18+
- Docker (for MailHog)

### 2. Install dependencies

```bash
npm install
```

### 3. Start MailHog

MailHog is the local email server. Aino's inbox lives here.

```bash
docker compose up -d
```

MailHog web UI: http://localhost:8025
MailHog SMTP port: 1025

### 4. Set up environment variables

Create `.env.local` in the project root:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here

# Optional — leave blank to use simulated voice calls
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_VOICE_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=

APP_BASE_URL=http://localhost:3000
```

Get a Gemini API key at https://aistudio.google.com/app/apikey

### 5. Run the dev server

```bash
npm run dev
```

App runs at http://localhost:3000 (or 3001 if 3000 is busy).

### 6. Open the dashboards

| URL | Who | What |
|---|---|---|
| `/` | Everyone | Landing page — choose a view |
| `/saara` | Caregiver | Full dashboard: alerts, tasks, morning brief, wearable data, audit log |
| `/aino` | Elderly user | Simple large-text task checklist with "I did this" and "I need help" |
| `/agents` | Technical | Live agent monitor: KPIs, action logs, safety filter audit |

---

## Sending Emails to MailHog (Manual Testing)

The Email Dispatcher Agent reads Aino's inbox every 10 seconds automatically. Use the included script to inject any custom email directly into MailHog:

```bash
node send-email.js "<from>" "<to>" "<subject>" "<body>"
```

**`to` must always be `aino@careloop.com`** — that is Aino's inbox address.

### Examples

**Invoice / bill — routed to Saara's dashboard only:**
```bash
node send-email.js \
  "billing@electricity.fi" \
  "aino@careloop.com" \
  "February Electricity Invoice" \
  "Dear Aino, your electricity bill for February is ready. Total due: 112.40 EUR. Please pay by 2026-06-15."
```

**Doctor appointment — creates task for Aino + alert for Saara:**
```bash
node send-email.js \
  "clinic@terveyskeskus.fi" \
  "aino@careloop.com" \
  "Appointment Reminder: Check-up Tomorrow at 10:30 AM" \
  "Dear Aino, you have a check-up appointment at Kamppi Health Center tomorrow at 10:30 AM. Please bring your medication list."
```

**Prescription pickup — creates a Medication task:**
```bash
node send-email.js \
  "pharmacy@apteekki.fi" \
  "aino@careloop.com" \
  "Prescription Ready for Pickup" \
  "Dear Aino, your prescription for blood pressure medication is ready. Please collect it before Friday. Opening hours: Mon-Fri 9am-6pm."
```

**Neighbor task:**
```bash
node send-email.js \
  "neighbor@gmail.com" \
  "aino@careloop.com" \
  "Package at the door" \
  "Hi Aino, the postal carrier left a package at your front door this morning."
```

After sending, the agent picks it up within 10 seconds (dashboard auto-polls). Gemini reads the full email content, evaluates the type and urgency, assigns a `risk_level`, and routes accordingly — no templates, no hardcoded rules.

---

## Demo Simulation Buttons (Saara's Dashboard Sidebar)

| Button | What it does |
|---|---|
| Aino takes tonsillitis meds | Marks the medication task as completed |
| Call 1: Aino No Answer | Overdues the task, places Call 1, Aino doesn't answer → `retry_queued` |
| Call 2: No Answer & Escalate | Aino misses Call 2 → `escalated_to_saara`, high-risk alert created |
| Call 1: Aino Needs Help | Aino answers and says she needs help → `needs_help`, urgent alert |
| Generate Full Timeline Log | Populates historical dummy data for a full audit trail |
| Run Overdue Checker | Manually triggers the coordinator agent cycle (also processes any pending emails) |
| Sync & Regenerate Brief | Runs the Morning Briefing Agent with selected wearable scenario |

---

## Wearable Scenarios

Since there is no real wearable device, three pre-built mock scenarios are available. Select one from the dropdown in Saara's sidebar and click **Sync & Regenerate Brief**:

| Scenario | Sleep | Recovery | Meaning |
|---|---|---|---|
| `normal_day` | 76/100 | 71/100 | All signals near baseline — low concern |
| `watch_day` | 48/100 | 41/100 | Moderate decline — CareLoop monitors closely |
| `concern_day` | 31/100 | 28/100 | Significant deviation — Gemini writes a health alert to Saara |

---

## Project Structure

```
src/
  app/
    aino/           — Aino's simple task checklist UI
    saara/          — Saara's full caregiver dashboard UI
    agents/         — Technical agent monitor UI
    api/
      agents/       — check-overdue-tasks, morning-brief, process-emails, logs
      aino/         — Aino's task endpoints
      saara/        — Saara's dashboard data endpoint
      alerts/       — acknowledge and resolve alerts
      tasks/        — create, complete, overdue, need-help
      voice/        — call-aino, elevenlabs-init
      demo/         — reset, simulate-* endpoints for demos
  lib/
    agents/         — All 8 AI agents
    ai/             — Gemini client + mock fallback
    database/       — Local JSON database adapter
    voice/          — Simulated + ElevenLabs voice adapters
    wearables/      — Mock wearable data adapter
    demo/           — Seed data and reset logic
    types.ts        — Shared TypeScript types

send-email.js       — CLI script to inject custom emails into MailHog
localDb.json        — Live database (git-ignored)
docker-compose.yml  — Starts MailHog
```
