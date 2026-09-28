/** Starter guides per skill, so the Guides tab arrives with real material. */
export const SKILL_DOCS: Record<
  string,
  { title: string; kind: string; summary: string; body: string }[]
> = {
  database: [
    {
      title: 'Database Fundamentals',
      kind: 'CONCEPT',
      summary: 'The mental model: what a database is, why we use one, and how the pieces fit.',
      body: `# Database Fundamentals

The material behind the concept sharing session. The goal is the correct mental
model, not every implementation detail.

## What is a database?

A database is a program whose job is to store data safely and answer questions
about it quickly. We use one instead of files because it gives us three things
files do not:

- **Structure** — the shape of the data is declared, so bad data is rejected.
- **Concurrency** — many people can read and write at once without corruption.
- **Querying** — we ask *what* we want, not *how* to find it.

## Tables, rows, columns

A table holds rows of the same shape. Each column has a type and may allow NULL.

| Column | Type | Null | Meaning |
| --- | --- | --- | --- |
| id | text | no | Identity of the row |
| email | text | no | Unique per member |
| title | text | yes | Not everyone has one |

> NULL is not zero and not an empty string. It means "we do not know". That
> distinction matters in every comparison you write.

## Keys and relationships

- **Primary key** — identifies a row. One per table.
- **Foreign key** — points at another table's primary key. This is what makes
  the data relational.
- **One-to-many** — a skill has many checklist items.
- **Many-to-many** — an assessment cites many evidence items, and a piece of
  evidence can back many assessments. That needs a join table.

## SQL in one minute

\`\`\`sql
SELECT m.name, s.name AS skill, ms.verified_level
FROM member_skill ms
JOIN member m ON m.id = ms.member_id
JOIN skill  s ON s.id = ms.skill_id
WHERE ms.verified_level < ms.target_level
ORDER BY m.name;
\`\`\`

Read it in this order: \`FROM\` → \`JOIN\` → \`WHERE\` → \`SELECT\` → \`ORDER BY\`.
That is roughly what the engine does too.

## Common problems in our projects

1. **A missing index on a foreign key.** Joins get slow as the table grows.
2. **An UPDATE or DELETE without a WHERE clause.** Always run the SELECT first.
3. **Doing work in a loop that SQL could do in one statement.**
4. **Long transactions** holding locks while waiting on something external.

## What to look at next

- The checklist on this skill, in order.
- Our own schema: \`prisma/schema.prisma\`.
- *Use The Index, Luke* for indexing.`,
    },
    {
      title: 'Database standards',
      kind: 'STANDARD',
      summary: 'Naming, migrations, keys and the rules we hold each other to in review.',
      body: `# Database standards

How we build in this area. Deviations are fine, but say why in the pull request.

## Naming

- Tables are **singular**: \`member\`, \`skill\`, \`assessment\`.
- Primary key is always \`id\`.
- Foreign keys are \`<table>_id\`.
- Timestamps are \`created_at\` / \`updated_at\`.
- Booleans read as a statement: \`is_primary\`, \`archived\`.

## Keys

- Use a generated id (cuid) as the primary key. Do not make a natural key the
  primary key — emails and names change.
- Put a unique constraint on anything that must be unique anyway, such as
  \`(member_id, skill_id)\`.

## Migrations

- Every schema change ships as a migration. No manual edits to a live database.
- A migration must be safe to run while the old code is still serving:
  1. add the column as nullable,
  2. backfill,
  3. make it required in a later migration.
- Never rename and reuse a column in one step.

## Queries

- No N+1. If you are querying inside a loop, stop and write a join.
- Always know what your \`WHERE\` clause matches before an \`UPDATE\` or \`DELETE\`.
- Index foreign keys and anything you filter or sort by regularly.
- Measure before and after adding an index. An index is not free — it costs on
  every write.

## Transactions

- Wrap multi-statement writes that must succeed or fail together.
- Keep transactions short. Never hold one open across a network call.

## Review checklist

- [ ] Migration is reversible, or the risk is stated
- [ ] New foreign keys are indexed
- [ ] No query inside a loop
- [ ] Deletes are either soft or have a considered cascade
- [ ] The query plan was checked for anything on a hot path`,
    },
  ],
  backend: [
    {
      title: 'API Fundamentals',
      kind: 'CONCEPT',
      summary: 'What an API contract is, and how a request becomes a response.',
      body: `# API Fundamentals

## What an API is

A contract. The client promises to send requests in an agreed shape; the server
promises a response in an agreed shape. Everything else — language, framework,
database — is the server's private business.

## The shape of a request

\`\`\`http
POST /api/assessments HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{ "memberId": "abc", "skillId": "def", "level": 3 }
\`\`\`

- **Method** says what kind of operation: GET reads, POST creates, PATCH
  modifies, DELETE removes.
- **Headers** carry metadata: who you are, what format you send.
- **Body** carries the payload.

## Status codes that matter

| Code | Meaning | Use it when |
| --- | --- | --- |
| 200 | OK | The read or update worked |
| 201 | Created | A POST made something new |
| 400 | Bad Request | The input failed validation |
| 401 | Unauthorized | We do not know who you are |
| 403 | Forbidden | We know, and you may not |
| 404 | Not Found | No such resource, or you may not see it |
| 409 | Conflict | It clashes with current state |
| 500 | Server Error | We broke, not you |

The 401/403 distinction matters: 401 means *authenticate*, 403 means *you are
authenticated and still not allowed*.

## Idempotency

GET, PUT and DELETE should be safe to repeat. POST usually is not. If a client
retries after a timeout, will you create a duplicate? If yes, you need an
idempotency key.

## Where things go wrong

1. Validation that only runs in the browser.
2. Authorization checked in the UI but not on the server.
3. Error responses with a different shape per endpoint.
4. Pagination without a stable sort, so rows repeat across pages.`,
    },
    {
      title: 'API standards',
      kind: 'STANDARD',
      summary: 'Resource design, error shape, auth and versioning rules.',
      body: `# API standards

## Resource design

- URLs name **nouns**, not verbs: \`/skills/:id/assessments\`, not
  \`/getAssessmentsForSkill\`.
- Plural collections, singular members: \`GET /skills\`, \`GET /skills/:id\`.
- Nest at most one level deep. Past that, use a query parameter.

## One error shape, everywhere

\`\`\`json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Level must be between 0 and 4.",
    "field": "level"
  }
}
\`\`\`

Clients should never have to parse prose to know what went wrong.

## Validation and authorization

- Validate at the boundary, before anything touches the database.
- Every handler answers two questions: *who is this* and *may they do this to
  this specific record*. Ownership checks belong on the server, always.
- Never trust an id from the client to imply permission.

## Pagination

- Cursor-based for anything that grows. Offset pagination drifts as rows are
  inserted.
- Always sort by something unique and stable, such as \`(created_at, id)\`.

## Versioning

- Additive changes need no version bump. Removing or renaming a field does.
- Version in the path: \`/v1/...\`.
- Announce a deprecation before you ship the removal.

## Review checklist

- [ ] Ownership and role checks are server-side
- [ ] Input validated at the boundary
- [ ] Errors use the standard shape and the right status code
- [ ] List endpoints paginate with a stable sort
- [ ] No secret, token or personal data in a URL or a log line`,
    },
  ],
  web: [
    {
      title: 'Web Fundamentals',
      kind: 'CONCEPT',
      summary: 'How a page becomes pixels, and where state actually lives.',
      body: `# Web Fundamentals

## From URL to pixels

1. The browser requests a document.
2. HTML is parsed into the DOM.
3. CSS is matched and the layout is computed.
4. JavaScript runs and can change any of the above.
5. The browser paints, then repaints when something changes.

Anything you do in step 4 that forces step 3 again is expensive. That is most
performance work in one sentence.

## Semantics first

\`\`\`html
<button type="submit">Save</button>
\`\`\`

not

\`\`\`html
<div onclick="save()">Save</div>
\`\`\`

The first is focusable, announced by a screen reader, works with the keyboard and
submits a form. The second is a div. Reaching for the right element is the
cheapest accessibility work available.

## Where state lives

- **URL** — anything a user should be able to share or reload into: the current
  tab, a filter, a page number.
- **Server** — the truth. Everything durable.
- **Component state** — transient interaction: an open menu, a draft input.

When in doubt, push state up the list, not down.

## The event loop

JavaScript runs one thing at a time. \`await\` does not pause the browser; it
yields. Long synchronous work blocks scrolling, clicks and paint — split it or
move it off the main thread.`,
    },
    {
      title: 'Web standards',
      kind: 'STANDARD',
      summary: 'Components, state, accessibility and performance rules.',
      body: `# Web standards

## Components

- One job per component. If the name needs "and", split it.
- Props in, events out. A component does not reach into global state it was not
  given.
- Server-render by default; reach for a client component only when you need
  interactivity.

## State

- URL for anything shareable or reloadable.
- No duplicated source of truth. Derive, do not copy.
- An uncontrolled input that reflects server data needs a \`key\` tied to that
  data, or it will show a stale value after a save.

## Accessibility (non-negotiable)

- Every interactive element is reachable and operable by keyboard.
- Every input has a label — visually hidden is fine, absent is not.
- Focus is visible. Do not remove the outline without replacing it.
- Colour is never the only carrier of meaning.
- Text contrast is at least 4.5:1.

## Performance

- Measure before optimising.
- Images are sized and lazy below the fold.
- Watch the bundle. A date library is rarely worth 70 KB.

## Review checklist

- [ ] Works with the keyboard alone
- [ ] Inputs are labelled
- [ ] Loading and error states exist, not just the happy path
- [ ] No layout shift once data arrives
- [ ] Nothing secret in client-side code`,
    },
  ],
  ios: [
    {
      title: 'iOS Fundamentals',
      kind: 'CONCEPT',
      summary: 'Swift, the app lifecycle, and how SwiftUI decides what to draw.',
      body: `# iOS Fundamentals

## Swift in one page

- **Optionals** are the type system telling you a value may be absent. Unwrap
  deliberately; \`!\` is a promise you will be held to at runtime.
- **Structs are values, classes are references.** Prefer structs. Reach for a
  class when you need identity or shared mutable state.
- **Protocols** describe capability, not hierarchy.

## App lifecycle

An app is not simply "open" or "closed":

| State | What it means |
| --- | --- |
| Not running | Never launched, or terminated |
| Inactive | Foreground but not receiving events |
| Active | Foreground and interactive |
| Background | Running briefly with limited time |
| Suspended | In memory, not executing — can be killed silently |

Anything you have not saved before suspension can disappear.

## SwiftUI is declarative

You describe what the UI should look like for a given state; the framework works
out the changes. You do not mutate views.

\`\`\`swift
struct LevelBadge: View {
    let level: Int

    var body: some View {
        Text("L\\(level)")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(Capsule().fill(.quaternary))
    }
}
\`\`\`

## State ownership

- \`@State\` — this view owns it.
- \`@Binding\` — someone else owns it, this view may change it.
- \`@Observable\` / \`@StateObject\` — a model object with a longer life.

Hoist state to the lowest common ancestor that needs it, and no higher.`,
    },
  ],
  android: [
    {
      title: 'Android Fundamentals',
      kind: 'CONCEPT',
      summary: 'Kotlin, the lifecycle that actually bites, and how Compose recomposes.',
      body: `# Android Fundamentals

## Kotlin essentials

- **Null safety** is in the type system. \`String?\` and \`String\` are different
  types, and the compiler will hold you to it.
- **Data classes** give you \`equals\`, \`hashCode\`, \`copy\` and destructuring.
- **Sealed classes** model a closed set of states — perfect for UI state.

\`\`\`kotlin
sealed interface SkillUiState {
    data object Loading : SkillUiState
    data class Ready(val skills: List<Skill>) : SkillUiState
    data class Failed(val message: String) : SkillUiState
}
\`\`\`

## The lifecycle that actually bites

Rotation, dark mode, language change and low memory can all destroy and recreate
your Activity. Anything held only in the Activity is gone.

- Survives recreation: \`ViewModel\`.
- Survives process death: \`SavedStateHandle\`, or persisted storage.
- Survives nothing: a property on the Activity.

## Compose and recomposition

Compose re-runs composable functions when the state they read changes. This means:

- A composable must be **side-effect free** — it can run many times.
- Read state as late as possible, so less gets recomposed.
- Hoist state: a composable that takes a value and a callback is testable and
  reusable; one that owns its own state is neither.

\`\`\`kotlin
@Composable
fun LevelChip(level: Int, modifier: Modifier = Modifier) {
    Text(
        text = "L$level",
        style = MaterialTheme.typography.labelSmall,
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}
\`\`\`

## Coroutines

- Structured concurrency: work is scoped, and cancelling the scope cancels the
  work. Use \`viewModelScope\`.
- \`Flow\` is a stream. \`StateFlow\` always has a current value — that is what a
  screen wants.
- Never block the main thread. Use \`withContext(Dispatchers.IO)\` for disk and
  network.`,
    },
  ],
};
