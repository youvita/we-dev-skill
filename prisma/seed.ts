import { PrismaClient } from '@prisma/client';
import { SKILL_DOCS } from './seed-docs';
import { SKILL_QUESTIONS } from './seed-questions';
import {
  difficultyWeight,
  levelForScore,
  qaScore,
  suggestedConfidence,
  type EvidenceType,
} from '../src/lib/domain';

const prisma = new PrismaClient();

type ItemSeed = [topic: string, requiredLevel: number, description: string];
type GroupSeed = { group: string; items: ItemSeed[] };

// Checklists per original area; merged into the three skills below.
const AREA_CHECKLISTS: Record<string, GroupSeed[]> = {
  database: [
    {
      group: 'Database Fundamentals',
      items: [
        ['Database concepts', 1, 'What a database is, why we use one instead of files.'],
        ['Tables', 1, 'Rows, columns, data types, NULL.'],
        ['Primary key', 1, 'Identity of a row, natural vs surrogate keys.'],
        ['Foreign key', 2, 'Referencing another table, cascade behaviour.'],
        ['Relationships', 2, 'One-to-one, one-to-many, many-to-many via join tables.'],
      ],
    },
    {
      group: 'SQL',
      items: [
        ['SQL', 1, 'What SQL is and how a statement is structured.'],
        ['SELECT', 2, 'Filtering, ordering, limiting, aggregating.'],
        ['INSERT', 2, 'Single and bulk inserts, returning generated keys.'],
        ['UPDATE', 2, 'Safe updates, always knowing your WHERE clause.'],
        ['DELETE', 2, 'Hard vs soft delete, referential integrity.'],
        ['JOIN', 3, 'Inner, left, right and self joins; when each one is right.'],
      ],
    },
    {
      group: 'Operations',
      items: [
        ['Indexes', 3, 'What an index costs, when it helps, reading a query plan.'],
        ['Transactions', 3, 'ACID, isolation levels, deadlocks.'],
        ['Database migration', 3, 'Versioned schema change, forward and rollback.'],
        ['Backup and recovery', 4, 'Backup strategy, restore drill, point-in-time recovery.'],
      ],
    },
  ],
  backend: [
    {
      group: 'API Fundamentals',
      items: [
        ['What an API is', 1, 'Contract between a client and a server.'],
        ['HTTP basics', 1, 'Methods, status codes, headers, body.'],
        ['REST resources', 2, 'Resource modelling, URL design, idempotency.'],
        ['JSON payloads', 2, 'Serialisation, nullability, versioning a payload.'],
      ],
    },
    {
      group: 'Building APIs',
      items: [
        ['Routing and controllers', 2, 'Mapping a request to a handler.'],
        ['Validation', 2, 'Rejecting bad input at the boundary.'],
        ['Authentication', 3, 'Sessions, tokens, refresh flows.'],
        ['Authorization', 3, 'Role and ownership checks that cannot be bypassed.'],
        ['Error handling', 3, 'Consistent error shape, correct status codes.'],
        ['Pagination and filtering', 3, 'Offset vs cursor, stable ordering.'],
      ],
    },
    {
      group: 'Operations',
      items: [
        ['API documentation', 2, 'OpenAPI, keeping docs true to the code.'],
        ['Logging and monitoring', 3, 'Request logs, correlation ids, alerting.'],
        ['Rate limiting', 4, 'Protecting an API under load or abuse.'],
        ['API versioning', 4, 'Shipping breaking changes without breaking clients.'],
      ],
    },
  ],
  web: [
    {
      group: 'Web Fundamentals',
      items: [
        ['HTML semantics', 1, 'Document structure, landmarks, forms.'],
        ['CSS layout', 2, 'Box model, flexbox, grid, responsive rules.'],
        ['JavaScript basics', 2, 'Types, async/await, modules, the event loop.'],
        ['Browser dev tools', 2, 'Inspecting elements, network, console.'],
      ],
    },
    {
      group: 'Application Development',
      items: [
        ['Component model', 2, 'Composition, props, reuse.'],
        ['State management', 3, 'Local vs shared state, derived state.'],
        ['Calling an API', 2, 'Fetch, loading and error states, caching.'],
        ['Routing', 2, 'Client and server routing, URL as state.'],
        ['Forms and validation', 3, 'Controlled inputs, client and server validation.'],
      ],
    },
    {
      group: 'Quality',
      items: [
        ['Accessibility', 3, 'Keyboard access, contrast, labels, focus order.'],
        ['Performance', 3, 'Bundle size, rendering cost, Core Web Vitals.'],
        ['Build and deploy', 3, 'Bundling, environments, static vs server rendering.'],
        ['Web security', 4, 'XSS, CSRF, CORS, cookie flags.'],
      ],
    },
  ],
  ios: [
    {
      group: 'iOS Fundamentals',
      items: [
        ['Swift basics', 1, 'Optionals, structs vs classes, protocols.'],
        ['Xcode and simulator', 1, 'Building, running, reading a crash log.'],
        ['App lifecycle', 2, 'Launch, foreground, background, termination.'],
        ['SwiftUI views', 2, 'View composition, layout, state bindings.'],
      ],
    },
    {
      group: 'Building an App',
      items: [
        ['Navigation', 2, 'Stacks, sheets, deep links.'],
        ['Networking', 2, 'URLSession, decoding, error handling.'],
        ['Local persistence', 3, 'UserDefaults, files, SwiftData / Core Data.'],
        ['Concurrency', 3, 'async/await, actors, main-thread rules.'],
        ['Dependency injection', 3, 'Testable wiring of services.'],
      ],
    },
    {
      group: 'Release',
      items: [
        ['Unit and UI testing', 3, 'XCTest, snapshot and UI tests.'],
        ['Code signing', 4, 'Certificates, profiles, capabilities.'],
        ['App Store release', 4, 'TestFlight, review process, phased rollout.'],
      ],
    },
  ],
  android: [
    {
      group: 'Android Fundamentals',
      items: [
        ['Kotlin basics', 1, 'Null safety, data classes, scope functions.'],
        ['Android Studio and emulator', 1, 'Building, running, reading Logcat.'],
        ['Activity and lifecycle', 2, 'Configuration change, process death, saved state.'],
        ['Jetpack Compose', 2, 'Composables, recomposition, modifiers.'],
      ],
    },
    {
      group: 'Building an App',
      items: [
        ['Navigation', 2, 'Nav graph, arguments, deep links.'],
        ['Networking', 2, 'Retrofit / Ktor, serialisation, error handling.'],
        ['Local persistence', 3, 'Room, DataStore, migrations.'],
        ['Coroutines and Flow', 3, 'Structured concurrency, cold vs hot flows.'],
        ['MVVM architecture', 3, 'ViewModel, repository, unidirectional state.'],
      ],
    },
    {
      group: 'Release',
      items: [
        ['Unit and UI testing', 3, 'JUnit, Compose test rules, fakes.'],
        ['Gradle build', 3, 'Flavours, build types, versioning.'],
        ['Play Store release', 4, 'Signing, app bundle, staged rollout.'],
      ],
    },
  ],
};

/** Prefix a group with its area unless it already names it ("SQL" → "Database: SQL"). */
function inArea(area: string, groups: GroupSeed[]): GroupSeed[] {
  return groups.map((g) => ({
    ...g,
    group: g.group.startsWith(area) ? g.group : `${area}: ${g.group}`,
  }));
}

const CHECKLISTS: Record<string, GroupSeed[]> = {
  backend: [
    ...inArea('Database', AREA_CHECKLISTS.database),
    ...inArea('API', AREA_CHECKLISTS.backend),
  ],
  web: AREA_CHECKLISTS.web,
  mobile: [...inArea('iOS', AREA_CHECKLISTS.ios), ...inArea('Android', AREA_CHECKLISTS.android)],
};

const DOCS: Record<string, (typeof SKILL_DOCS)[string]> = {
  backend: [...SKILL_DOCS.database, ...SKILL_DOCS.backend],
  web: SKILL_DOCS.web,
  mobile: [...SKILL_DOCS.ios, ...SKILL_DOCS.android],
};

const SKILLS = [
  { key: 'backend', name: 'Backend', owner: 'dev.b@example.com', description: 'Database and API: data modelling, SQL, indexes and transactions, plus API design, auth, validation, errors, versioning and operations.' },
  { key: 'web', name: 'Web', owner: 'dev.c@example.com', description: 'Frontend for the browser: markup, layout, state, API integration, accessibility and performance.' },
  { key: 'mobile', name: 'Mobile', owner: 'dev.d@example.com', description: 'Frontend for mobile: native iOS (Swift, SwiftUI) and Android (Kotlin, Compose), from app lifecycle to store release.' },
];

const MEMBERS = [
  { name: 'Developer A', email: 'dev.a@example.com', title: 'Backend Engineer', role: 'ADMIN', primary: 'backend' },
  { name: 'Developer B', email: 'dev.b@example.com', title: 'Backend Engineer', role: 'MEMBER', primary: 'backend' },
  { name: 'Developer C', email: 'dev.c@example.com', title: 'Frontend Engineer', role: 'MEMBER', primary: 'web' },
  { name: 'Developer D', email: 'dev.d@example.com', title: 'Mobile Engineer (iOS)', role: 'MEMBER', primary: 'mobile' },
  { name: 'Developer E', email: 'dev.e@example.com', title: 'Mobile Engineer (Android)', role: 'MEMBER', primary: 'mobile' },
];

// Target grades (0 = E … 4 = A). The recorded grade comes from the seeded Q&A
// score, which is aimed at the middle of each band.
const MATRIX: Record<string, Record<string, number>> = {
  'dev.a@example.com': { backend: 4, web: 2, mobile: 0 },
  'dev.b@example.com': { backend: 4, web: 2, mobile: 1 },
  'dev.c@example.com': { backend: 2, web: 4, mobile: 0 },
  'dev.d@example.com': { backend: 1, web: 2, mobile: 4 },
  'dev.e@example.com': { backend: 2, web: 1, mobile: 3 },
};

// Self-assessments that differ from verified, to exercise the §8 separation.
const SELF: Record<string, Record<string, number>> = {
  'dev.a@example.com': { web: 3 },
  'dev.c@example.com': { backend: 3 },
  'dev.d@example.com': { web: 3 },
  'dev.e@example.com': { backend: 3, mobile: 4 },
};

const BAND_TARGET = [55, 65, 75, 85, 95];

/**
 * Plausible Q&A results that land a score near the middle of the target
 * grade's band: the basics go right first, the advanced questions last.
 */
function answersFor(
  questions: { id: string; topic: string; prompt: string; difficulty: string }[],
  level: number,
) {
  const sorted = [...questions].sort(
    (a, b) => difficultyWeight(a.difficulty) - difficultyWeight(b.difficulty),
  );
  const total = sorted.reduce((sum, q) => sum + difficultyWeight(q.difficulty), 0);
  let need = (BAND_TARGET[level] / 100) * total;
  return sorted.map((q) => {
    const weight = difficultyWeight(q.difficulty);
    let result: 'CORRECT' | 'PARTIAL' | 'WRONG' = 'WRONG';
    if (need >= weight) {
      result = 'CORRECT';
      need -= weight;
    } else if (need >= weight / 2) {
      result = 'PARTIAL';
      need -= weight / 2;
    }
    return {
      questionId: q.id,
      topic: q.topic,
      prompt: q.prompt,
      difficulty: q.difficulty,
      weight,
      result,
      note: '',
    };
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  return daysAgo(-n);
}


const DIMENSION_KEYS = [
  'KNOWLEDGE',
  'IMPLEMENTATION',
  'CODE_UNDERSTANDING',
  'DEBUGGING',
  'DESIGN',
  'COMMUNICATION',
] as const;

/**
 * A plausible dimension spread for an overall level: knowledge and
 * communication tend to run ahead of debugging and design, which is exactly the
 * pattern the dimension scores exist to make visible.
 */
function dimensionsFor(level: number, isPrimary: boolean) {
  const clamp = (n: number) => Math.max(0, Math.min(4, n));
  const offsets: Record<(typeof DIMENSION_KEYS)[number], number> = isPrimary
    ? { KNOWLEDGE: 0, IMPLEMENTATION: 0, CODE_UNDERSTANDING: 0, DEBUGGING: 0, DESIGN: 0, COMMUNICATION: 0 }
    : {
        KNOWLEDGE: 1,
        IMPLEMENTATION: 0,
        CODE_UNDERSTANDING: 0,
        DEBUGGING: -1,
        DESIGN: -1,
        COMMUNICATION: 0,
      };
  return DIMENSION_KEYS.map((d) => ({ dimension: d, level: clamp(level + offsets[d]), note: '' }));
}

const AI_CRITERIA_KEYS = [
  'EXPLAIN_AI_CODE',
  'MODIFY_AI_CODE',
  'SPOT_WRONG_AI_CODE',
  'DEBUG_WITHOUT_AI',
  'DECIDE_WITHOUT_AI',
] as const;

/** Control over the solution rises with level; spotting wrong output lags. */
function aiChecksFor(level: number) {
  const rate = (threshold: number) =>
    level >= threshold ? 'YES' : level >= threshold - 1 ? 'PARTIAL' : 'NO';
  const map: Record<(typeof AI_CRITERIA_KEYS)[number], string> = {
    EXPLAIN_AI_CODE: rate(2),
    MODIFY_AI_CODE: rate(2),
    SPOT_WRONG_AI_CODE: rate(3),
    DEBUG_WITHOUT_AI: rate(3),
    DECIDE_WITHOUT_AI: rate(3),
  };
  return AI_CRITERIA_KEYS.map((c) => ({ criterion: c, rating: map[c], note: '' }));
}

function evidenceFor(
  key: string,
  name: string,
  level: number,
  isPrimary: boolean,
): { type: string; summary: string; detail?: string; daysAgo: number }[] {
  void key;
  if (level === 0) return [];
  if (isPrimary) {
    return [
      {
        type: 'PROJECT_CONTRIBUTION',
        summary: `Owns the ${name} layer across current projects`,
        detail: 'Day-to-day design and review work in this area.',
        daysAgo: 60,
      },
      {
        type: 'ARCHITECTURE_EXPLANATION',
        summary: `Walked the team through the ${name} architecture`,
        daysAgo: 45,
      },
      { type: 'CODE_REVIEW', summary: `Regular reviewer on ${name} changes`, daysAgo: 38 },
      { type: 'DEBUGGING_TASK', summary: `Diagnosed a production ${name} incident`, daysAgo: 50 },
    ];
  }
  const base: { type: string; summary: string; detail?: string; daysAgo: number }[] = [];
  if (level >= 2) {
    base.push({
      type: 'PRACTICAL_TASK',
      summary: `Completed a small ${name} task and explained the implementation`,
      daysAgo: 37,
    });
  }
  if (level >= 3) {
    base.push({
      type: 'DEBUGGING_TASK',
      summary: `Found and fixed a seeded ${name} bug without assistance`,
      daysAgo: 36,
    });
  }
  return base;
}

function weakAreasFor(key: string): string {
  const map: Record<string, string> = {
    backend: 'Indexes, transaction isolation and authorization edge cases.',
    web: 'State management and accessibility.',
    mobile: 'Concurrency, local persistence and configuration-change handling.',
  };
  return map[key] ?? 'Needs broader hands-on practice.';
}

function recommendedFor(key: string): string {
  const map: Record<string, string> = {
    backend: 'Read a query plan for a slow report and add an index; then implement an endpoint with ownership checks.',
    web: 'Rebuild one screen with hoisted state, then run a keyboard-only pass.',
    mobile: 'Move one screen to async/await (iOS) or a StateFlow-driven ViewModel (Android).',
  };
  return map[key] ?? 'Pick a small task in this area and present the result.';
}

async function main() {
  console.log('Clearing existing data…');
  await prisma.sessionMaterial.deleteMany();
  await prisma.sessionParticipant.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.learningNote.deleteMany();
  await prisma.learningAssignment.deleteMany();
  await prisma.checklistProgress.deleteMany();
  await prisma.skillDoc.deleteMany();
  await prisma.question.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.memberSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.member.deleteMany();

  console.log('Creating members…');
  const members: Record<string, { id: string; name: string }> = {};
  for (const m of MEMBERS) {
    const created = await prisma.member.create({
      data: { name: m.name, email: m.email, title: m.title, role: m.role },
    });
    members[m.email] = created;
  }

  console.log('Creating skills and checklists…');
  const skills: Record<string, { id: string; name: string }> = {};
  for (const [i, s] of SKILLS.entries()) {
    const { owner: ownerEmail, ...fields } = s;
    const created = await prisma.skill.create({
      data: { ...fields, order: i, ownerId: members[ownerEmail].id },
    });
    skills[s.key] = created;

    // Preparation Q&A: the questions the owner scores in a review.
    for (const [q, [topic, difficulty, prompt, expectedAnswer]] of (
      SKILL_QUESTIONS[s.key] ?? []
    ).entries()) {
      await prisma.question.create({
        data: { skillId: created.id, topic, difficulty, prompt, expectedAnswer, order: q },
      });
    }

    // Starter guides: the concepts and standards the owner maintains.
    const docs = DOCS[s.key] ?? [];
    for (const [d, doc] of docs.entries()) {
      await prisma.skillDoc.create({
        data: {
          skillId: created.id,
          title: doc.title,
          slug: doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          kind: doc.kind,
          summary: doc.summary,
          body: doc.body,
          order: d,
          updatedById: members[ownerEmail].id,
        },
      });
    }

    let order = 0;
    for (const g of CHECKLISTS[s.key]) {
      for (const [topic, requiredLevel, description] of g.items) {
        await prisma.checklistItem.create({
          data: { skillId: created.id, group: g.group, topic, description, requiredLevel, order: order++ },
        });
      }
    }
  }

  console.log('Creating member skills and assessment history…');
  const questionsBySkill: Record<string, { id: string; topic: string; prompt: string; difficulty: string }[]> = {};
  for (const s of SKILLS) {
    questionsBySkill[s.key] = await prisma.question.findMany({
      where: { skillId: skills[s.key].id },
      orderBy: { order: 'asc' },
      select: { id: true, topic: true, prompt: true, difficulty: true },
    });
  }

  for (const m of MEMBERS) {
    const memberId = members[m.email].id;
    for (const s of SKILLS) {
      const skillId = skills[s.key].id;
      const isPrimary = m.primary === s.key;
      const answers = answersFor(questionsBySkill[s.key], MATRIX[m.email][s.key]);
      const score = qaScore(answers)!;
      const verified = levelForScore(score);
      const self = SELF[m.email]?.[s.key] ?? verified;
      // Everyone targets C in every non-primary skill: "capable of contributing
      // outside their primary specialization".
      const targetLevel = isPrimary ? 4 : Math.max(2, verified);

      await prisma.memberSkill.create({
        data: { memberId, skillId, isPrimary, targetLevel, selfLevel: self, verifiedLevel: verified },
      });

      await prisma.assessment.create({
        data: {
          memberId,
          skillId,
          type: 'SELF',
          level: self,
          method: 'SELF_ASSESSMENT',
          evidence: isPrimary
            ? 'Primary skill — day-to-day work in this area.'
            : 'Completed the concept session and the first block of the checklist.',
          createdAt: daysAgo(40),
          dimensions: { create: dimensionsFor(self, isPrimary) },
        },
      });

      // The skill owner reviews, except when they are the one being assessed —
      // nobody verifies themselves, so an admin stands in (see canVerify).
      const skillOwnerId = (await prisma.skill.findUnique({
        where: { id: skillId },
        select: { ownerId: true },
      }))!.ownerId!;
      const adminId = members['dev.a@example.com'].id;
      const reviewerId = skillOwnerId === memberId ? adminId : skillOwnerId;

      if (reviewerId !== memberId) {
        // Evidence first: the level has to rest on something.
        const evidenceSeeds = evidenceFor(s.key, s.name, verified, isPrimary);
        const created = await Promise.all(
          evidenceSeeds.map((e) =>
            prisma.evidence.create({
              data: {
                memberId,
                skillId,
                type: e.type,
                summary: e.summary,
                detail: e.detail ?? '',
                occurredAt: daysAgo(e.daysAgo),
                recordedById: reviewerId,
              },
              select: { id: true },
            }),
          ),
        );

        // The Q&A goes on file as evidence, like it does in the app.
        const asked = answers.length;
        created.push(
          await prisma.evidence.create({
            data: {
              memberId,
              skillId,
              type: 'KNOWLEDGE_QUESTIONS',
              summary: `Q&A: scored ${score}% on ${asked} ${s.name} questions`,
              occurredAt: daysAgo(35),
              recordedById: reviewerId,
            },
            select: { id: true },
          }),
        );

        const assessment = await prisma.assessment.create({
          data: {
            memberId,
            skillId,
            type: 'VERIFICATION',
            level: verified,
            score,
            reviewerId,
            method: 'OWNER_REVIEW',
            confidence: suggestedConfidence(
              ['KNOWLEDGE_QUESTIONS', ...evidenceSeeds.map((e) => e.type as EvidenceType)],
              verified,
            ),
            comment:
              self > verified
                ? 'Good grasp of the concepts, and explains the happy path well. Could not yet talk through the failure modes without help.'
                : 'Confirmed at this level against the evidence on file.',
            weakAreas: self > verified ? weakAreasFor(s.key) : '',
            recommendedLearning: self > verified ? recommendedFor(s.key) : '',
            nextAssessmentDate: isPrimary ? null : daysFromNow(verified < 2 ? 30 : 90),
            createdAt: daysAgo(35),
            dimensions: { create: dimensionsFor(verified, isPrimary) },
            aiChecks: { create: aiChecksFor(verified) },
            answers: { create: answers },
            evidenceItems: { connect: created.map((c) => ({ id: c.id })) },
          },
          select: { id: true },
        });
        void assessment;
      }
    }
  }

  console.log('Creating learning assignments, notes and progress…');
  const devC = members['dev.c@example.com'].id;
  const devD = members['dev.d@example.com'].id;
  const devE = members['dev.e@example.com'].id;

  await prisma.learningAssignment.createMany({
    data: [
      { memberId: devC, skillId: skills.backend.id, targetLevel: 2, dueDate: daysFromNow(14), note: 'Work through the SQL block, then present what you learned.' },
      { memberId: devD, skillId: skills.backend.id, targetLevel: 2, dueDate: daysFromNow(14), note: 'Focus on tables, keys and relationships first.' },
      { memberId: devE, skillId: skills.backend.id, targetLevel: 2, dueDate: daysFromNow(21), note: '' },
    ],
  });

  // Developer C: 6 of the 15 database items in the Backend checklist done.
  const dbItems = await prisma.checklistItem.findMany({
    where: { skillId: skills.backend.id },
    orderBy: { order: 'asc' },
  });
  const cStatuses = [
    'VERIFIED', 'VERIFIED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED',
    'LEARNING', 'LEARNING', 'NEEDS_REVIEW',
    'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED',
  ];
  for (const [i, item] of dbItems.entries()) {
    await prisma.checklistProgress.create({
      data: {
        memberId: devC,
        itemId: item.id,
        status: cStatuses[i] ?? 'NOT_STARTED',
        notes:
          i === 5 ? 'Practised inner and left joins against a copy of the reporting schema.' : '',
        evidenceUrl: i === 5 ? 'https://wiki.internal/dev-c/sql-join-practice' : '',
      },
    });
  }

  await prisma.learningNote.createMany({
    data: [
      { memberId: devC, skillId: skills.backend.id, kind: 'NOTE', title: 'Primary key vs unique constraint', body: 'A table has one primary key; unique constraints can be many and allow a NULL depending on the engine.' },
      { memberId: devC, skillId: skills.backend.id, kind: 'CODE', title: 'LEFT JOIN that keeps orphan rows', body: 'SELECT c.id, o.total\nFROM customer c\nLEFT JOIN "order" o ON o.customer_id = c.id\nWHERE o.id IS NULL;' },
      { memberId: devC, skillId: skills.backend.id, kind: 'LINK', title: 'Use The Index, Luke', body: 'Recommended by the database owner.', url: 'https://use-the-index-luke.com' },
      { memberId: devC, skillId: skills.backend.id, kind: 'QUESTION', title: 'When is a composite index worse than two single ones?', body: 'Ask in the next review session.' },
      { memberId: devD, skillId: skills.backend.id, kind: 'NOTE', title: 'Foreign key cascade', body: 'ON DELETE CASCADE removes children automatically — convenient, but easy to lose data with.' },
    ],
  });

  console.log('Creating sessions…');
  const allMemberIds = Object.values(members).map((m) => m.id);

  const conceptSession = await prisma.session.create({
    data: {
      title: 'Database Fundamentals',
      skillId: skills.backend.id,
      topic: 'Database Fundamentals',
      type: 'CONCEPT_SHARING',
      presenterId: members['dev.a@example.com'].id,
      date: daysAgo(28),
      duration: 90,
      location: 'Meeting Room 1 / https://meet.example.com/db-fundamentals',
      description:
        'What a database is and why we use one. Architecture, tables, relationships, SQL, common problems, and examples from our own projects. The goal is the correct mental model, not every implementation detail.',
      status: 'COMPLETED',
      participants: { create: allMemberIds.map((id) => ({ memberId: id, attended: true })) },
      materials: {
        create: [
          { label: 'Slides — Database Fundamentals', url: 'https://wiki.internal/sessions/db-fundamentals' },
          { label: 'Sample schema', url: 'https://wiki.internal/sessions/db-fundamentals/schema.sql' },
        ],
      },
    },
  });

  await prisma.session.create({
    data: {
      title: 'What I Learned About Database',
      skillId: skills.backend.id,
      topic: 'SQL and relationships',
      type: 'MEMBER_SHARING',
      presenterId: devC,
      date: daysFromNow(5),
      duration: 45,
      location: 'Meeting Room 1',
      description:
        'What I understood, what I practised, and a worked example of joins against the reporting schema. Open question on composite indexes at the end.',
      status: 'PLANNED',
      participants: { create: allMemberIds.map((id) => ({ memberId: id })) },
    },
  });

  await prisma.session.create({
    data: {
      title: 'Build a small REST endpoint end to end',
      skillId: skills.backend.id,
      topic: 'Routing, validation and error handling',
      type: 'PRACTICAL_CHALLENGE',
      presenterId: members['dev.b@example.com'].id,
      date: daysFromNow(12),
      duration: 60,
      location: 'https://meet.example.com/api-challenge',
      description:
        'Each participant implements one endpoint with validation and a consistent error shape, then walks through it.',
      status: 'PLANNED',
      participants: { create: allMemberIds.map((id) => ({ memberId: id })) },
    },
  });

  await prisma.session.create({
    data: {
      title: 'Backend C review — Developer D',
      skillId: skills.backend.id,
      topic: 'Tables, keys, relationships',
      type: 'REVIEW_ASSESSMENT',
      presenterId: members['dev.a@example.com'].id,
      date: daysFromNow(9),
      duration: 30,
      location: 'Meeting Room 2',
      description: 'Checklist walkthrough and the Backend Q&A, then record a verified grade.',
      status: 'PLANNED',
      participants: { create: [{ memberId: devD }, { memberId: members['dev.a@example.com'].id }] },
    },
  });

  await prisma.session.create({
    data: {
      title: 'Compose state and recomposition',
      skillId: skills.mobile.id,
      topic: 'Jetpack Compose',
      type: 'CONCEPT_SHARING',
      presenterId: devE,
      date: daysAgo(10),
      duration: 60,
      location: 'Meeting Room 1',
      description: 'How recomposition works and why state has to be hoisted.',
      status: 'COMPLETED',
      participants: { create: allMemberIds.map((id) => ({ memberId: id, attended: true })) },
    },
  });

  // Tie one historical verification to the concept session it came out of.
  await prisma.assessment.updateMany({
    where: { skillId: skills.backend.id, type: 'VERIFICATION', memberId: devC },
    data: { sessionId: conceptSession.id },
  });

  const counts = {
    members: await prisma.member.count(),
    skills: await prisma.skill.count(),
    checklistItems: await prisma.checklistItem.count(),
    guides: await prisma.skillDoc.count(),
    questions: await prisma.question.count(),
    answers: await prisma.questionAnswer.count(),
    assessments: await prisma.assessment.count(),
    dimensionScores: await prisma.dimensionScore.count(),
    evidence: await prisma.evidence.count(),
    sessions: await prisma.session.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
