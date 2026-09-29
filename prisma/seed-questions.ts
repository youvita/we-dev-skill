/**
 * Starter preparation Q&A per skill. The skill owner asks these in a review and
 * marks each answer; the weighted score sets the verified grade. Owners can add
 * and remove questions on the skill's Q&A tab.
 */
type QuestionSeed = [
  topic: string,
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED',
  prompt: string,
  expectedAnswer: string,
];

export const SKILL_QUESTIONS: Record<string, QuestionSeed[]> = {
  backend: [
    /* ------------------------------------------------------------ Database */
    [
      'Database',
      'BASIC',
      'What is the difference between a primary key and a foreign key?',
      'A **primary key** uniquely identifies a row in its own table (unique, not null, one per table). A **foreign key** is a column that references the primary key of another table, so the database enforces that the referenced row exists.',
    ],
    [
      'Database',
      'BASIC',
      'Explain one-to-many and many-to-many relationships, and how each is stored.',
      'One-to-many: the "many" side holds a foreign key to the "one" side (an order has a `customer_id`). Many-to-many needs a **join table** holding two foreign keys (e.g. `student_course(student_id, course_id)`).',
    ],
    [
      'Database',
      'BASIC',
      'What does NULL mean in SQL, and why does `WHERE col = NULL` not work?',
      'NULL means "unknown / no value", not zero or empty string. Any comparison with NULL yields unknown, so `= NULL` never matches. Use `IS NULL` / `IS NOT NULL`.',
    ],
    [
      'Database',
      'INTERMEDIATE',
      'What is the difference between INNER JOIN and LEFT JOIN? When would you use a LEFT JOIN?',
      'INNER JOIN returns only rows that match on both sides. LEFT JOIN returns every row from the left table, with NULLs where the right side has no match. Use it to keep rows without a match, e.g. customers with no orders (`WHERE o.id IS NULL`).',
    ],
    [
      'Database',
      'INTERMEDIATE',
      'What is the difference between WHERE and HAVING?',
      '`WHERE` filters rows **before** grouping; `HAVING` filters groups **after** `GROUP BY` and can use aggregates, e.g. `HAVING COUNT(*) > 5`.',
    ],
    [
      'Database',
      'INTERMEDIATE',
      'What is an index, what does it cost, and when should you add one?',
      'An index is a separate structure (usually a B-tree) that lets the database find rows without scanning the table. It speeds up reads on filtered/joined/sorted columns but costs disk space and slows every insert/update/delete. Add one for frequent, selective queries — confirmed with the query plan.',
    ],
    [
      'Database',
      'INTERMEDIATE',
      'What is a transaction, and what does ACID stand for?',
      'A transaction groups statements so they succeed or fail together. **Atomicity** (all or nothing), **Consistency** (constraints hold), **Isolation** (concurrent transactions do not see each other’s partial work), **Durability** (committed data survives a crash).',
    ],
    [
      'Database',
      'ADVANCED',
      'Explain transaction isolation levels and one anomaly that READ COMMITTED allows.',
      'Read Uncommitted, Read Committed, Repeatable Read, Serializable — each prevents more anomalies at more cost. READ COMMITTED allows **non-repeatable reads** (a row changes between two reads in one transaction) and **phantoms** (new rows appear in a repeated range query).',
    ],
    [
      'Database',
      'ADVANCED',
      'A report query became slow in production. How do you investigate and fix it?',
      'Reproduce with the real parameters, run `EXPLAIN ANALYZE`, look for sequential scans, bad row estimates, and expensive sorts/joins. Fixes: a suitable (possibly composite) index, rewriting the query, updating statistics, pagination, or pre-aggregating. Measure before and after.',
    ],
    [
      'Database',
      'ADVANCED',
      'How do you run a schema migration on a large live table without downtime?',
      'Make changes backward compatible in steps (expand → migrate → contract): add nullable column, deploy code that writes both, backfill in batches, then add constraints and remove the old column. Avoid long table locks (e.g. `CREATE INDEX CONCURRENTLY`), and have a rollback plan and a backup.',
    ],

    /* ----------------------------------------------------------------- API */
    [
      'API',
      'BASIC',
      'What are the common HTTP methods and what is each used for in a REST API?',
      '`GET` read, `POST` create, `PUT` replace, `PATCH` partial update, `DELETE` remove. GET must not change state.',
    ],
    [
      'API',
      'BASIC',
      'What do the status code families mean? Give an example of each: 2xx, 4xx, 5xx.',
      '2xx success (`200 OK`, `201 Created`, `204 No Content`); 4xx client error (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422`); 5xx server error (`500`, `503`).',
    ],
    [
      'API',
      'BASIC',
      'What is the difference between authentication and authorization?',
      '**Authentication** establishes who you are (login, token). **Authorization** decides what you are allowed to do (roles, ownership checks). A 401 means not authenticated; a 403 means authenticated but not allowed.',
    ],
    [
      'API',
      'INTERMEDIATE',
      'What does idempotent mean? Which HTTP methods are idempotent?',
      'Repeating the same request has the same effect as sending it once. GET, PUT, DELETE (and HEAD, OPTIONS) are idempotent; POST is not. Matters for safe retries — POST can be made safe with an idempotency key.',
    ],
    [
      'API',
      'INTERMEDIATE',
      'Where should input validation happen, and what should the API return for invalid input?',
      'Always on the server at the boundary, even if the client validates too. Return `400` or `422` with a consistent error body that says which field failed and why — never a 500 or a stack trace.',
    ],
    [
      'API',
      'INTERMEDIATE',
      'How does token-based authentication with a JWT work, and where are its weaknesses?',
      'The server signs a token with claims (user id, expiry); the client sends it in the `Authorization: Bearer` header and the server verifies the signature without a session lookup. Weaknesses: hard to revoke before expiry, so keep access tokens short-lived with refresh tokens; never store secrets in the payload; store securely on the client.',
    ],
    [
      'API',
      'INTERMEDIATE',
      'Compare offset pagination with cursor pagination.',
      'Offset (`?page=3&limit=20`) is simple and allows jumping to a page, but gets slow on large offsets and skips/duplicates rows when data changes. Cursor (`?after=<last id>`) is fast and stable for feeds, but cannot jump to an arbitrary page. Both need a stable sort order.',
    ],
    [
      'API',
      'ADVANCED',
      'How would you ship a breaking change to an API that mobile apps already use?',
      'Never break the old contract in place: version it (`/v2` or a header), or make the change additive. Run both versions, monitor usage of the old one, communicate a deprecation timeline, and remove it only when old app versions are gone — mobile clients update slowly.',
    ],
    [
      'API',
      'ADVANCED',
      'How do you protect an API against abuse or traffic spikes?',
      'Rate limiting per user/key/IP (token bucket or sliding window) with `429` and `Retry-After`; request size limits; timeouts; caching; queueing slow work; autoscaling; and monitoring/alerting to spot abuse.',
    ],
    [
      'API',
      'ADVANCED',
      'A request is slow only sometimes in production. How do you find the cause?',
      'Use logs with correlation/request IDs and metrics (p95/p99 latency) to find which requests and when. Trace the request through its dependencies (DB, external APIs). Common causes: lock contention, N+1 queries, cold caches, slow third parties, resource exhaustion. Reproduce, fix, then confirm with the metrics.',
    ],
  ],

  web: [
    [
      'Web fundamentals',
      'BASIC',
      'Why does semantic HTML matter? Give examples of semantic elements.',
      'It gives meaning to structure for screen readers, search engines and other developers: `<header>`, `<nav>`, `<main>`, `<article>`, `<button>`, `<label>`. A clickable `<div>` has no keyboard support or role; a `<button>` does.',
    ],
    [
      'Web fundamentals',
      'BASIC',
      'Explain the CSS box model.',
      'Every element is content + padding + border + margin. `box-sizing: border-box` makes width include padding and border, which is easier to reason about.',
    ],
    [
      'Web fundamentals',
      'BASIC',
      'When would you use flexbox and when grid?',
      'Flexbox lays items out in **one dimension** (a row or a column), good for toolbars and aligning items. Grid handles **two dimensions** (rows and columns together), good for page layouts and card grids.',
    ],
    [
      'Web fundamentals',
      'BASIC',
      'What is the difference between `let`, `const` and `var`?',
      '`let` and `const` are block-scoped; `const` cannot be reassigned (the object it points to can still change). `var` is function-scoped and hoisted, which causes bugs — avoid it.',
    ],
    [
      'Web fundamentals',
      'INTERMEDIATE',
      'Explain the event loop, and in what order `setTimeout(…, 0)` and a resolved Promise callback run.',
      'JavaScript runs one call stack. When it is empty, the event loop runs all **microtasks** (Promise callbacks) first, then the next **macrotask** (timers, events). So the Promise `.then` runs before the `setTimeout(…, 0)` callback.',
    ],
    [
      'Web fundamentals',
      'INTERMEDIATE',
      'How does `async`/`await` relate to Promises, and how do you handle errors with it?',
      '`async` functions always return a Promise; `await` pauses until a Promise settles. Handle errors with `try/catch` (or `.catch` on the returned Promise). Use `Promise.all` to run independent requests in parallel instead of awaiting them one by one.',
    ],
    [
      'Application development',
      'BASIC',
      'What are props and state in a component, and how do they differ?',
      'Props are inputs passed from a parent and are read-only in the child. State is data a component owns and changes over time; changing it re-renders the component.',
    ],
    [
      'Application development',
      'INTERMEDIATE',
      'When should state be lifted up, and when do you need shared or global state?',
      'Lift state to the nearest common parent when siblings need the same data. Use context or a store only for truly app-wide data (current user, theme) or when prop drilling gets deep. Keep server data in a data-fetching cache rather than global state, and derive values instead of duplicating them.',
    ],
    [
      'Application development',
      'INTERMEDIATE',
      'When calling an API from a screen, which states must the UI handle?',
      'Loading, success, empty, and error (with a way to retry). Also cancel or ignore stale responses when the input changes, and avoid double-submits on mutations.',
    ],
    [
      'Application development',
      'INTERMEDIATE',
      'Why do list items need a stable `key`, and why is the array index a bad key?',
      'The key lets the framework match items between renders. With the index, inserting or reordering items attaches state and DOM to the wrong item. Use a stable id from the data.',
    ],
    [
      'Application development',
      'ADVANCED',
      'Compare client-side rendering, server-side rendering and static generation. How do you choose?',
      'CSR renders in the browser: simple hosting, slow first paint, weaker SEO. SSR renders per request: fast first content and SEO, needs a server. Static generation renders at build time: fastest and cheapest, but data can be stale (revalidation helps). Choose by how dynamic and personalised the data is and SEO needs.',
    ],
    [
      'Quality',
      'INTERMEDIATE',
      'How do you make a form accessible?',
      'Every input has a `<label>`; errors are announced and linked to the field; everything works by keyboard with a visible focus; enough colour contrast; do not rely on colour alone; use native elements before ARIA.',
    ],
    [
      'Quality',
      'ADVANCED',
      'What are Core Web Vitals, and how would you improve a poor LCP?',
      'LCP (loading of the largest element), INP (responsiveness to input), CLS (layout shift). Improve LCP by optimising and preloading the hero image, reducing render-blocking CSS/JS, server-rendering the content, using a CDN and caching.',
    ],
    [
      'Quality',
      'ADVANCED',
      'Explain XSS and how to prevent it.',
      'Cross-site scripting: attacker-controlled input is rendered as script in another user’s page. Prevent it by escaping output (frameworks do this by default — avoid `dangerouslySetInnerHTML`/`innerHTML` with user data), sanitising any HTML you must render, a Content Security Policy, and `HttpOnly` cookies.',
    ],
    [
      'Quality',
      'ADVANCED',
      'What is CORS and why does the browser enforce it?',
      'The same-origin policy stops a page reading responses from another origin. CORS lets a server opt in with headers such as `Access-Control-Allow-Origin`; non-simple requests are preceded by a preflight `OPTIONS`. It protects users’ data in the browser — it is not server-side security.',
    ],
    [
      'Quality',
      'ADVANCED',
      'A page feels slow when typing in a search box. How do you find and fix the cause?',
      'Profile with the browser Performance tab / framework profiler to see what re-renders and how long it takes. Typical fixes: debounce the input, memoise expensive children, virtualise long lists, move heavy work off the main thread, and avoid state updates that re-render the whole page.',
    ],
  ],

  mobile: [
    /* ------------------------------------------------------- shared mobile */
    [
      'Mobile fundamentals',
      'BASIC',
      'What are the main states of a mobile app lifecycle, and why do they matter?',
      'Not running, foreground/active, background, suspended/stopped, terminated. The OS can pause or kill the app at any time, so save state and release resources when going to the background, and restore when coming back.',
    ],
    [
      'Mobile fundamentals',
      'BASIC',
      'Why must long-running work never run on the main (UI) thread?',
      'The main thread draws the UI and handles touches. Blocking it freezes the app, and the OS may kill it (ANR on Android, watchdog on iOS). Do network, disk and heavy work in the background and update the UI back on the main thread.',
    ],
    [
      'Mobile fundamentals',
      'INTERMEDIATE',
      'How do you handle an unreliable network in a mobile app?',
      'Show loading, error and retry states; set timeouts; cache data locally so the app works offline; retry with backoff; queue writes and sync later; and handle a request finishing after the user has left the screen.',
    ],
    [
      'Mobile fundamentals',
      'ADVANCED',
      'How do you release a mobile app safely, given users update slowly?',
      'Beta testing (TestFlight / internal testing tracks), phased or staged rollout, crash and analytics monitoring, feature flags to switch features off remotely, and keep the backend compatible with old app versions — optionally a forced-update check for critical fixes.',
    ],

    /* ----------------------------------------------------------------- iOS */
    [
      'iOS',
      'BASIC',
      'What is an optional in Swift, and what are safe ways to unwrap it?',
      'A value that may be `nil` (`String?`). Unwrap with `if let` / `guard let`, optional chaining (`a?.b`), or `??` for a default. Avoid force unwrapping `!` because it crashes on nil.',
    ],
    [
      'iOS',
      'BASIC',
      'What is the difference between a struct and a class in Swift?',
      'Structs are **value types** (copied on assignment, no inheritance); classes are **reference types** (shared instance, inheritance, deinit). Prefer structs for models; SwiftUI views are structs.',
    ],
    [
      'iOS',
      'INTERMEDIATE',
      'Explain `@State`, `@Binding` and `@Observable` / `@StateObject` in SwiftUI.',
      '`@State` is simple local state owned by a view. `@Binding` gives a child read-write access to a parent’s state. `@Observable` (or `ObservableObject` with `@StateObject`/`@ObservedObject`) holds reference-type model state shared across views; the view owning it creates it once.',
    ],
    [
      'iOS',
      'INTERMEDIATE',
      'How do you make a network request with async/await and update the UI safely?',
      'Use `try await URLSession.shared.data(from:)`, decode with `JSONDecoder` into a `Codable` type, catch errors, and update UI state on the main actor (`@MainActor`). Start it from `.task {}` so it is cancelled when the view disappears.',
    ],
    [
      'iOS',
      'INTERMEDIATE',
      'What is a retain cycle and how do you avoid one with closures?',
      'Two objects hold strong references to each other, so neither is freed (memory leak). Common with closures capturing `self`. Break it with `[weak self]` (or `unowned` when the lifetime is guaranteed) and `weak` delegates.',
    ],
    [
      'iOS',
      'ADVANCED',
      'What problems do actors and `@MainActor` solve in Swift concurrency?',
      'Actors protect their mutable state so only one task touches it at a time, preventing data races. `@MainActor` guarantees code runs on the main thread, which UI updates require. The compiler enforces these rules (Sendable checking).',
    ],
    [
      'iOS',
      'ADVANCED',
      'Explain certificates, provisioning profiles and how an app gets onto TestFlight.',
      'A signing certificate proves the developer’s identity; a provisioning profile ties the app ID, certificate, devices and capabilities (entitlements) together. Archive with a distribution profile, upload to App Store Connect, then distribute to testers via TestFlight after processing (and beta review for external testers).',
    ],

    /* ------------------------------------------------------------- Android */
    [
      'Android',
      'BASIC',
      'How does Kotlin handle null safety?',
      'Types are non-null by default; `String?` may be null. Use safe calls `?.`, the Elvis operator `?:` for defaults, and `let`. `!!` throws if null and should be avoided.',
    ],
    [
      'Android',
      'BASIC',
      'What happens to an Activity on a configuration change such as rotation, and how do you keep data?',
      'The Activity is destroyed and recreated. Keep UI state in a `ViewModel` (survives configuration changes) and use `SavedStateHandle` / `rememberSaveable` for state that must survive process death.',
    ],
    [
      'Android',
      'INTERMEDIATE',
      'What is recomposition in Jetpack Compose, and why hoist state?',
      'When state read by a composable changes, Compose re-runs that composable to update the UI. Hoisting moves state up to the caller so composables are stateless, reusable and testable, with one source of truth (state down, events up).',
    ],
    [
      'Android',
      'INTERMEDIATE',
      'Describe MVVM on Android: what belongs in the ViewModel and what in the repository?',
      'The UI observes state from the **ViewModel** and sends it events; the ViewModel holds UI state (e.g. `StateFlow`) and logic, and survives configuration changes. The **repository** owns data access (network, Room database) and hides where data comes from.',
    ],
    [
      'Android',
      'INTERMEDIATE',
      'What is structured concurrency with coroutines, and why use `viewModelScope`?',
      'Coroutines are started in a scope and are cancelled with it, so work never outlives its owner. `viewModelScope` cancels its coroutines when the ViewModel is cleared, preventing leaks and wasted work. Use `Dispatchers.IO` for blocking I/O.',
    ],
    [
      'Android',
      'ADVANCED',
      'Explain cold vs hot flows, and the difference between `StateFlow` and `SharedFlow`.',
      'A cold `Flow` starts producing for each collector when collected; a hot flow emits regardless of collectors. `StateFlow` always has a current value and replays the latest to new collectors (UI state). `SharedFlow` can have no value and configurable replay (one-off events).',
    ],
    [
      'Android',
      'ADVANCED',
      'How do you sign and release an app on Google Play, and how does a staged rollout help?',
      'Build an Android App Bundle (AAB) signed with the upload key (Play App Signing holds the app signing key), bump `versionCode`, upload to a testing track, then production. A staged rollout releases to a percentage of users first so crashes can be caught and the rollout halted.',
    ],
  ],
};
