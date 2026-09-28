# Development Knowledge Sharing & Skill Management System

An internal web app for running a development team's cross-skill learning programme.

The goal is not to make every developer an expert in everything. It is that **every
developer understands the full development flow and can contribute outside their
primary specialization**, while keeping deeper expertise in their primary skill.

## Running it

The app uses Postgres. Put a connection string in `.env`:

```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

Then:

```bash
npm install
npm run setup   # prisma generate + db push + seed
npm run dev
```

Open http://localhost:3000.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run setup` | Generate the client, create the tables, seed the team |
| `npm run db:reset` | Drop all data and start over from the seed |
| `npm run db:seed` | Re-run the seed against the existing database |
| `npm run build` | Production build (also type-checks everything) |

## Deploying to Vercel

1. Add a Postgres database to the Vercel project (Storage → Neon, or any hosted
   Postgres) and make sure `DATABASE_URL` is set for Production and Preview.
2. Create the tables and seed once, from your machine, against that database:
   `DATABASE_URL="<production url>" npm run setup`
3. Redeploy.

## Signing in

There is **no password authentication in this build.** The header has a
"Viewing as" switcher that sets a cookie, so you can move between members and see
the permission rules take effect. `src/lib/session.ts` is the only file that
decides who the current user is — replace `getActingUser()` with a real session
lookup to put the app behind SSO, and nothing else has to change.

The seed creates five members matching the example matrix in the spec. Developer A
is an admin.

## The learning cycle

```
Primary Skill Owner → Concept Sharing Session → Team Members
  → Self Research & Learning → Knowledge Checklist → Self Assessment
  → Member Sharing Session → Skill Owner Review → Verified Skill Level
  → Team Skill Matrix
```

Where each stage lives in the app:

| Stage | Where |
| --- | --- |
| Concept sharing | `/sessions/new` with type **Concept Sharing** |
| Learning assignment | Skill page → **Team** tab → *Assign learning* |
| Self research & learning log | Member workspace → **Learning log** tab |
| Knowledge checklist | Member workspace → **Checklist** tab |
| Recording evidence | Member workspace → **Evidence** tab |
| Self assessment | Member workspace → **Assessment** tab |
| Member sharing | `/sessions/new` with type **Member Sharing** |
| Owner review | `/review` → *Assess*, or from a session's participant list |
| Verified level & matrix | `/skills?tab=team` |

## Screen structure

Two screens carry most of the detail, so both are tabbed rather than stacked:

- **Member workspace** (`/members/[id]/skills/[key]`) — four stat tiles up top, then
  Checklist · Evidence · Learning log · History · Assessment. The tab lives in the
  URL (`?tab=evidence`), so it is linkable and server-rendered.
- **Skill page** (`/skills/[key]`) — Checklist · Team · Sessions.

The **members directory** (`/members`) has card and list views, instant search
across name, email, title and primary skill, and a primary-skill filter. Filtering
runs in the browser — the team is small enough that an instant filter beats a round
trip per keystroke. Admins get an inline *Add member* panel from the toolbar rather
than a form permanently parked at the bottom of the page.

The **skills directory** (`/skills`) mirrors it: card and list views, search across
name, description and owner, an owner filter (including *Unassigned*), and an
inline *Add skill* panel for admins. Both views surface an **At target** bar — how
many of the people tracking that skill have reached the level they are aiming for,
which is the honest health signal for a skill area.

The **review queue** is a scannable list: one row per person, showing the
self-vs-verified gap, evidence count, checklist progress and whether a
reassessment is overdue. Overdue items sort first. Each row opens the assessment.

The **assessment** (`/members/[id]/skills/[key]/assess`) is a five-step flow —
Level → Dimensions → Evidence → Independence → Record — with a context rail
showing what the member claims, the last review, and the evidence on file. Every
input stays mounted across steps, so one submit carries the whole form.

## Skills: two tabs

Everything skill-related lives under one nav item, `/skills`, with two tabs:

- **Skill areas** (default) — *the knowledge itself*: each area's concept guides
  and development standards written in Markdown by its owner, the checklist people
  learn against, ownership, learning assignments and that skill's sessions.
- **Team skills** (`?tab=team`) — *measurement*: the whole grid of every member
  against every skill, with five lenses over the same cells. Read-only. Its job is
  finding gaps.

The lens lives in `?view=` alongside `?tab=team`, so any cell state is linkable.
`/matrix` redirects to `/skills?tab=team`, preserving `?view=`, so older links and
bookmarks keep working.

A skill page's own **Team** tab is one column of the matrix expanded, and a
member's profile is one row — hub and slices, not duplicate screens.

## Skill guides

Each skill holds Markdown documents (`SkillDoc`) in three flavours:

| Type | What it is for |
| --- | --- |
| Concept guide | What it is, why we use it, architecture, real examples — the material behind a Concept Sharing session |
| Development standard | How we build in this area: conventions and decisions the team works to |
| Reference | Setup notes, cheat sheets, links |

Only the skill owner (or an admin) can write them, enforced in
`assertCanEditDocs()` in `src/lib/actions.ts`. The editor has Write/Preview tabs;
the textarea stays mounted while previewing so toggling never loses work. Markdown
renders with GFM (tables, task lists, code blocks) via `react-markdown`, with raw
HTML disabled.

The seed ships real starter guides for all five skills so the tab is not empty on
arrival.

### Downloading guides as Markdown

Guides are written as Markdown so they can leave the app and live in a repo:

| What | Where |
| --- | --- |
| One guide | *Download .md* on the guide page, or the `.md` link on its row in the Guides tab |
| Every guide for a skill, as one file | *Download all .md* on the Guides tab header |

Routes: `GET /skills/[key]/guides/[slug]/download` and `GET /skills/[key]/download`.
Both return `text/markdown` with a `Content-Disposition: attachment` filename
(`backend-api-standards.md`, `backend-guides.md`).

Each download carries YAML front matter — skill, title, type, owner, who last
edited it and when — so a file dropped into a repo is self-describing. The combined
file adds a contents list with anchors; a guide's own leading H1 is dropped and any
later H1 demoted, so the headings nest correctly instead of competing.

## One place for the definitions

`/levels` — the **Level guide** — is the single definition of every closed set the
programme uses: the L0–L4 ladder, the six assessment dimensions, the nine evidence
types, the AI-independence criteria, confidence, checklist statuses, session types
and the learning cycle. Every page links there instead of repeating it.

Pages that display level chips carry a one-line **Level key** (badge + name only)
so the chart is readable at a glance, with a link through to the guide. That is a
key, not a second copy of the definitions. The footer links the guide from every
page, so it needs no nav slot of its own.

## The cycle is not the same as the session types

There are four session types and the learning cycle has four stages, but they do
**not** map one-to-one — a UI that shows them side by side has to say so:

| Cycle stage | Session type it schedules |
| --- | --- |
| 1. Concept sharing | Concept Sharing |
| 2. Self learning | *none* — individual work, recorded in the learning log |
| 3. Member sharing | Member Sharing, or Practical Challenge for a live demo |
| 4. Review | Review / Assessment |

`LEARNING_CYCLE` and `cycleStageFor()` in `src/lib/domain.ts` hold this mapping.
On `/sessions/new`, picking a session type highlights the stage it belongs to, and
self learning is explicitly marked "no session scheduled".

The **dashboard** opens with a *Needs your attention* band: reviews waiting on you,
overdue reassessments and active learning assignments, ahead of everything else.

## Skill levels

| Level | Name | Meaning |
| --- | --- | --- |
| L0 | No Evidence | Has not yet demonstrated the skill |
| L1 | Fundamental | Understands basic concepts, simple tasks with guidance |
| L2 | Working | Performs common tasks independently and explains them |
| L3 | Proficient | Designs, troubleshoots, reviews code, decides independently |
| L4 | Advanced | Complex problems, optimisation, standards, mentoring |

A primary skill owner is normally L4. Levels are stored as `Int` 0–4 so they can be
compared; the definitions live in `src/lib/domain.ts`.

**`null` and L0 are different.** A null level has never been assessed and renders as
`–`; L0 means someone was assessed and nothing was demonstrated. The UI shows them
differently on purpose.

## Assessment dimensions

A single number hides which part of a skill is missing, so every assessment can
carry a score per dimension:

| Dimension | Question |
| --- | --- |
| Knowledge | Can they explain the fundamental concepts? |
| Implementation | Can they implement a solution? |
| Code Understanding | Can they understand AI-generated or existing code? |
| Debugging | Can they identify and solve problems? |
| Design | Can they make reasonable technical decisions? |
| Communication | Can they clearly explain why a solution was chosen? |

A dimension can be left blank — "not assessed" is more honest than a guess, and
blanks are rendered as gaps rather than zeros.

## Evidence

Evidence accumulates against a member and skill, and an assessment cites the items
that backed it. The nine types from the spec are supported (knowledge questions,
code review, debugging task, practical task, architecture explanation, real project
contribution, knowledge-sharing session, peer review, AI assessment).

Evidence is **many-to-many** with assessments: a standing project contribution is
still valid at the next review, so citing it again does not detach it from the
earlier one. Evidence that any assessment cites cannot be deleted.

### The single-quiz rule is enforced

`evidenceWarnings()` in `src/lib/domain.ts` flags an assessment that rests on no
evidence, on a single form of evidence, or only on recall/AI-based evidence, and
warns when an L3+ claim has no debugging or practical task behind it. The warnings
update live as the assessor ticks evidence.

Confidence (Low / Medium / High) is **capped by the evidence**: if an assessor picks
High but only cited one item, the record stores the confidence the evidence actually
supports and says so in the response. The assessor is not blocked — the record is
just kept honest.

## AI dependency

AI usage is not a negative factor. What is recorded is how much of the solution the
developer demonstrably controls, across five criteria: can explain AI-generated
code, can modify it, can identify incorrect AI output, can debug without AI, can
decide without blindly following AI. Each is Yes / Partly / No / Not assessed, and
the assessed ones roll up to an independence percentage.

Every assessment form carries the principle in plain sight: *a developer who shipped
the feature with AI has not, by that fact, demonstrated the skill.*

## The assessment record

Each verification stores: date, assessment type (owner review, review session,
practical task, peer review), assessor, level, confidence, per-dimension scores,
AI-dependency checks, cited evidence, comment, weak areas, recommended learning and
the next assessment date. Overdue reassessments surface on the dashboard, the member
profile, the matrix and the review queue.

## Self assessment vs verified assessment

This separation is enforced, not just a UI convention:

- A member records their **self assessment** with optional evidence. It never
  touches their verified level.
- Only the **skill owner** (or an admin standing in, e.g. when the owner is the one
  being assessed) can record a **verified level**. Nobody can verify themselves.
- The rule lives in `canVerify()` in `src/lib/domain.ts` and is checked inside the
  `submitVerification` server action, so hiding the form is not the only defence.
- Checklist items can be moved to **Verified** only by the skill owner or an admin.
- Assessments are **append-only**. `MemberSkill.selfLevel` / `verifiedLevel` are
  denormalised pointers to the latest of each type; the `Assessment` table is the
  source of truth and keeps every past review with its reviewer and comment.

## Skill matrix

`/matrix` has four views over the same grid, because one cell cannot legibly carry
everything the spec asks for:

- **Verified level** — the official level, with a star on each member's primary skill
- **Self vs verified** — flags where someone rates themselves above their verified level
- **Target level** — current level against the target, highlighting the gap
- **Checklist progress** — how much of the knowledge checklist is done
- **Evidence & confidence** — how well-evidenced each level is, and what is overdue for reassessment

There is deliberately no overall score, ranking or leaderboard.

## Roles

| Role | Can |
| --- | --- |
| Member | Edit their own checklist progress and notes, record their own self assessment (optionally per dimension), record evidence about themselves, set their own target |
| Skill owner | Everything a member can, plus: edit that skill's checklist, assign learning, mark items Verified, record evidence, record verified levels in that skill |
| Admin | Everything, plus: add members and skills, assign skill owners, set primary skills |

## Project layout

```
prisma/
  schema.prisma          data model
  seed.ts                five skills, 66 checklist items, five members, sessions
src/
  app/
    page.tsx             dashboard
    matrix/              team skill matrix
    skills/              skill list, skill detail + checklist editor
    members/             member list, profile,
      [id]/skills/[skillKey]/   the learning workspace (checklist, log, assessments)
    sessions/            list, create, detail
    review/              skill owner's review queue
  components/            shared UI, forms, checklist row
  components/
    assessment.tsx       the verification form (dimensions, evidence, AI checks)
    assessment-view.tsx  read-only rendering of an assessment record
  lib/
    domain.ts            levels, dimensions, evidence rules, permission rules
    actions.ts           every server action (all writes go through here)
    queries.ts           matrix and review-queue queries
    session.ts           who the current user is — swap this for real auth
```

## Notes on scope

- Built from two specs: the programme/workflow spec (sections 1–12) and the
  assessment spec. The first spec's text ends part-way through §12 (Member
  Sharing), so anything after that point is not implemented.
- The two specs name levels differently. The assessment spec's ladder wins
  (L0 No Evidence … L4 Advanced); the rungs map 1:1 onto the first spec's.
- The assessment spec groups skills as Database / Backend / Web / Mobile. The
  Backend naming was adopted (the first spec called it API), but iOS and Android
  stay separate rather than merging into one Mobile skill — they have different
  checklists and different owners. The five seeded skills are Database, Backend,
  Web, iOS and Android. Admins can rename or add skills in the UI.
- The database is Postgres (originally SQLite, which cannot run on Vercel's
  read-only serverless filesystem). Closed sets are still `String` columns
  validated in `src/lib/domain.ts`, a holdover from SQLite having no enums.
- `prisma db push` is used rather than migrations, so the schema can move freely
  while the model is still settling. Switch to `prisma migrate` before the first
  real deployment.
