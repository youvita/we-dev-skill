// Closed sets and rules from the two product specs. Kept in one place because
// the schema stores them as plain strings — everything that writes these
// values validates here.

/* ----------------------------------------------------------------- levels */

/**
 * Grades E (lowest) to A (highest), stored as Int 0..4 so they can be compared
 * and aggregated: 0 = E, 1 = D, 2 = C, 3 = B, 4 = A. A NULL level means never
 * assessed. A verified grade comes from the Q&A score (see levelForScore).
 */
export const LEVELS = [0, 1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];

/** Levels a member may claim for themselves, or an assessor may award. */
export const ASSIGNABLE_LEVELS = LEVELS;

export const LEVEL_DEF: Record<
  Level,
  { code: string; name: string; summary: string; can: string[]; minScore: number; band: string }
> = {
  0: {
    code: 'E',
    name: 'Beginner',
    summary: 'Knows some basic concepts but cannot yet work in the area without close guidance.',
    can: ['Recognise the main terms and tools', 'Follow a worked example step by step'],
    minScore: 0,
    band: 'below 60',
  },
  1: {
    code: 'D',
    name: 'Fundamental',
    summary: 'Understands basic concepts and can perform simple tasks with guidance.',
    can: [
      'Explain what it is and why it is used',
      'Describe the basic architecture and terminology',
      'Perform simple tasks with guidance',
    ],
    minScore: 60,
    band: '60–69',
  },
  2: {
    code: 'C',
    name: 'Working',
    summary: 'Can independently perform common tasks and explain the implementation.',
    can: [
      'Follow documentation and use common tools',
      'Implement common tasks independently',
      'Explain their own implementation',
      'Integrate with another layer',
    ],
    minScore: 70,
    band: '70–79',
  },
  3: {
    code: 'B',
    name: 'Proficient',
    summary: 'Can design solutions, troubleshoot, review code and decide independently.',
    can: [
      'Design normal implementations',
      'Troubleshoot problems',
      'Review other people’s code',
      'Make technical decisions independently',
    ],
    minScore: 80,
    band: '80–89',
  },
  4: {
    code: 'A',
    name: 'Advanced',
    summary: 'Handles complex problems, optimises, defines standards and mentors.',
    can: [
      'Handle complex problems',
      'Optimise solutions',
      'Define standards',
      'Mentor other developers',
      'Own the skill area',
    ],
    minScore: 90,
    band: '90–100',
  },
};

/** `null` means never assessed. */
export function levelCode(level: number | null | undefined): string {
  if (level === null || level === undefined) return '–';
  return LEVEL_DEF[level as Level]?.code ?? '–';
}

export function isLevel(v: unknown): v is Level {
  return typeof v === 'number' && v >= 0 && v <= 4 && Number.isInteger(v);
}

/** The grade a Q&A score (0..100) earns. Anything under 60 is E. */
export function levelForScore(score: number): Level {
  for (const l of [...LEVELS].reverse()) {
    if (score >= LEVEL_DEF[l].minScore) return l;
  }
  return 0;
}

/* -------------------------------------------------------------- Q&A score */

export const DIFFICULTIES = ['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Harder questions count for more of the score. */
export const DIFFICULTY_DEF: Record<Difficulty, { label: string; weight: number }> = {
  BASIC: { label: 'Basic', weight: 1 },
  INTERMEDIATE: { label: 'Intermediate', weight: 2 },
  ADVANCED: { label: 'Advanced', weight: 3 },
};

export function difficultyWeight(d: string): number {
  return DIFFICULTY_DEF[d as Difficulty]?.weight ?? 1;
}

/** NOT_ASKED questions are left out of the score entirely. */
export const ANSWER_RESULTS = ['NOT_ASKED', 'CORRECT', 'PARTIAL', 'WRONG'] as const;
export type AnswerResult = (typeof ANSWER_RESULTS)[number];

export const ANSWER_RESULT_DEF: Record<AnswerResult, { label: string; credit: number }> = {
  NOT_ASKED: { label: 'Not asked', credit: 0 },
  CORRECT: { label: 'Correct', credit: 1 },
  PARTIAL: { label: 'Partial', credit: 0.5 },
  WRONG: { label: 'Wrong', credit: 0 },
};

/** Fewer answers than this and the score says too little to set a grade. */
export const MIN_QUESTIONS_ASKED = 5;

/**
 * Weighted Q&A score, 0..100 rounded to one decimal, over the questions that
 * were actually asked. Returns null when nothing was asked.
 */
export function qaScore(answers: { weight: number; result: string }[]): number | null {
  const asked = answers.filter((a) => a.result !== 'NOT_ASKED');
  const max = asked.reduce((sum, a) => sum + a.weight, 0);
  if (max === 0) return null;
  const earned = asked.reduce(
    (sum, a) => sum + a.weight * (ANSWER_RESULT_DEF[a.result as AnswerResult]?.credit ?? 0),
    0,
  );
  return Math.round((earned / max) * 1000) / 10;
}

/* ------------------------------------------------------- assessment types */

export const ASSESSMENT_TYPES = ['SELF', 'VERIFICATION'] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

/** How the assessment was actually conducted (spec 2, "Assessment type"). */
export const ASSESSMENT_METHODS = [
  'OWNER_REVIEW',
  'SESSION_REVIEW',
  'PRACTICAL_TASK',
  'PEER_REVIEW',
  'SELF_ASSESSMENT',
] as const;
export type AssessmentMethod = (typeof ASSESSMENT_METHODS)[number];

export const ASSESSMENT_METHOD_LABEL: Record<AssessmentMethod, string> = {
  OWNER_REVIEW: 'Skill owner review',
  SESSION_REVIEW: 'Review session',
  PRACTICAL_TASK: 'Practical task',
  PEER_REVIEW: 'Peer review',
  SELF_ASSESSMENT: 'Self assessment',
};

export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const CONFIDENCE_HINT: Record<Confidence, string> = {
  LOW: 'Thin or single-source evidence — treat this level as provisional.',
  MEDIUM: 'Reasonable evidence, but some dimensions were not directly observed.',
  HIGH: 'Several independent forms of evidence across the dimensions.',
};

/* ------------------------------------------------- assessment dimensions */

export const DIMENSIONS = [
  'KNOWLEDGE',
  'IMPLEMENTATION',
  'CODE_UNDERSTANDING',
  'DEBUGGING',
  'DESIGN',
  'COMMUNICATION',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_DEF: Record<Dimension, { label: string; question: string }> = {
  KNOWLEDGE: {
    label: 'Knowledge',
    question: 'Can they explain the fundamental concepts?',
  },
  IMPLEMENTATION: {
    label: 'Implementation',
    question: 'Can they implement a solution?',
  },
  CODE_UNDERSTANDING: {
    label: 'Code Understanding',
    question: 'Can they understand AI-generated or existing code?',
  },
  DEBUGGING: {
    label: 'Debugging',
    question: 'Can they identify and solve problems?',
  },
  DESIGN: {
    label: 'Design',
    question: 'Can they make reasonable technical decisions?',
  },
  COMMUNICATION: {
    label: 'Communication',
    question: 'Can they clearly explain why a solution was chosen?',
  },
};

/* ------------------------------------------------------------- evidence */

export const EVIDENCE_TYPES = [
  'KNOWLEDGE_QUESTIONS',
  'CODE_REVIEW',
  'DEBUGGING_TASK',
  'PRACTICAL_TASK',
  'ARCHITECTURE_EXPLANATION',
  'PROJECT_CONTRIBUTION',
  'SHARING_SESSION',
  'PEER_REVIEW',
  'AI_ASSESSMENT',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  KNOWLEDGE_QUESTIONS: 'Knowledge questions',
  CODE_REVIEW: 'Code review',
  DEBUGGING_TASK: 'Debugging task',
  PRACTICAL_TASK: 'Practical task',
  ARCHITECTURE_EXPLANATION: 'Architecture explanation',
  PROJECT_CONTRIBUTION: 'Real project contribution',
  SHARING_SESSION: 'Knowledge-sharing session',
  PEER_REVIEW: 'Peer review',
  AI_ASSESSMENT: 'AI assessment',
};

/** Evidence that only shows recall, never enough on its own for a level. */
export const WEAK_ALONE_EVIDENCE: EvidenceType[] = ['KNOWLEDGE_QUESTIONS', 'AI_ASSESSMENT'];

/**
 * The Q&A score sets the grade; the evidence cited alongside it decides how far
 * that grade can be trusted. The Q&A is recorded as Knowledge questions
 * evidence automatically, so `types` should include it. Returns the warnings
 * that apply, or an empty array when the evidence is sound.
 */
export function evidenceWarnings(types: EvidenceType[], level: number): string[] {
  const out: string[] = [];
  const distinct = [...new Set(types)];

  if (distinct.length === 0) {
    out.push('No evidence is attached. A grade should be supported by evidence.');
    return out;
  }
  if (distinct.every((t) => WEAK_ALONE_EVIDENCE.includes(t))) {
    out.push(
      'The grade rests on the Q&A alone. Cite a practical task, code review or project work as well to raise confidence.',
    );
  } else if (distinct.length === 1) {
    out.push(
      `Only one form of evidence (${EVIDENCE_TYPE_LABEL[distinct[0]]}). Use multiple forms whenever possible.`,
    );
  }
  if (level >= 3 && !distinct.some((t) => t === 'DEBUGGING_TASK' || t === 'PRACTICAL_TASK')) {
    out.push(
      'B and above claim independent troubleshooting. Consider a debugging or practical task as evidence.',
    );
  }
  return out;
}

/** The confidence the evidence actually supports, used to flag optimistic input. */
export function suggestedConfidence(types: EvidenceType[], level: number): Confidence {
  void level;
  const distinct = [...new Set(types)];
  if (distinct.length === 0) return 'LOW';
  if (distinct.length === 1 || distinct.every((t) => WEAK_ALONE_EVIDENCE.includes(t))) return 'LOW';
  if (distinct.length === 2) return 'MEDIUM';
  return 'HIGH';
}

/* --------------------------------------------------------- AI dependency */

export const AI_CRITERIA = [
  'EXPLAIN_AI_CODE',
  'MODIFY_AI_CODE',
  'SPOT_WRONG_AI_CODE',
  'DEBUG_WITHOUT_AI',
  'DECIDE_WITHOUT_AI',
] as const;
export type AiCriterion = (typeof AI_CRITERIA)[number];

export const AI_CRITERION_LABEL: Record<AiCriterion, string> = {
  EXPLAIN_AI_CODE: 'Can explain AI-generated code',
  MODIFY_AI_CODE: 'Can modify AI-generated code',
  SPOT_WRONG_AI_CODE: 'Can identify incorrect AI-generated code',
  DEBUG_WITHOUT_AI: 'Can debug without AI',
  DECIDE_WITHOUT_AI: 'Can make technical decisions without blindly following AI',
};

export const AI_RATINGS = ['NOT_ASSESSED', 'NO', 'PARTIAL', 'YES'] as const;
export type AiRating = (typeof AI_RATINGS)[number];

export const AI_RATING_LABEL: Record<AiRating, string> = {
  NOT_ASSESSED: 'Not assessed',
  NO: 'No',
  PARTIAL: 'Partly',
  YES: 'Yes',
};

/**
 * How much of the solution the developer demonstrably controls, 0..1, over the
 * criteria that were actually assessed. AI usage itself is not a negative
 * factor — this only measures understanding and control.
 */
export function independenceScore(ratings: AiRating[]): number | null {
  const assessed = ratings.filter((r) => r !== 'NOT_ASSESSED');
  if (assessed.length === 0) return null;
  const points = assessed.reduce((sum, r) => sum + (r === 'YES' ? 1 : r === 'PARTIAL' ? 0.5 : 0), 0);
  return points / assessed.length;
}

export function independenceLabel(score: number | null): string {
  if (score === null) return 'Not assessed';
  if (score >= 0.85) return 'Understands and controls the solution';
  if (score >= 0.6) return 'Mostly in control, some reliance';
  if (score >= 0.35) return 'Partial understanding, leans on AI';
  return 'Largely dependent on AI output';
}

/* --------------------------------------------------------- checklist §7 */

export const CHECKLIST_STATUSES = [
  'NOT_STARTED',
  'LEARNING',
  'COMPLETED',
  'NEEDS_REVIEW',
  'VERIFIED',
] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  NOT_STARTED: 'Not Started',
  LEARNING: 'Learning',
  COMPLETED: 'Completed',
  NEEDS_REVIEW: 'Needs Review',
  VERIFIED: 'Verified',
};

// Only the skill owner may move an item to Verified — the member cannot sign
// off their own, for the same reason they cannot set their own level.
export const OWNER_ONLY_CHECKLIST_STATUSES: ChecklistStatus[] = ['VERIFIED'];

/* ---------------------------------------------------------- sessions §9 */

export const SESSION_TYPES = [
  'CONCEPT_SHARING',
  'MEMBER_SHARING',
  'PRACTICAL_CHALLENGE',
  'REVIEW_ASSESSMENT',
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  CONCEPT_SHARING: 'Concept Sharing',
  MEMBER_SHARING: 'Member Sharing',
  PRACTICAL_CHALLENGE: 'Practical Challenge',
  REVIEW_ASSESSMENT: 'Review / Assessment',
};

export const SESSION_TYPE_HINT: Record<SessionType, string> = {
  CONCEPT_SHARING: 'Primary Skill Owner introduces the topic and builds the mental model.',
  MEMBER_SHARING: 'A developer shares what they independently learned.',
  PRACTICAL_CHALLENGE: 'Developer demonstrates an implementation.',
  REVIEW_ASSESSMENT: 'Skill Owner evaluates knowledge and records a verified level.',
};

export const SESSION_STATUSES = ['PLANNED', 'COMPLETED', 'CANCELLED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * The learning cycle from spec 1 §10-12. It is deliberately NOT one-to-one with
 * SESSION_TYPES: "self learning" is individual work that schedules no session at
 * all, and the sharing stage can be a talk, a live demonstration, or both. Any
 * UI that shows the cycle next to the session types has to say so, or the two
 * four-item lists read as a mapping they are not.
 */
export const LEARNING_CYCLE = [
  {
    key: 'CONCEPT',
    title: 'Concept sharing',
    detail:
      'The primary skill owner introduces the topic: what it is, why we use it, the architecture and real examples from our own projects. The goal is the correct mental model, not every implementation detail.',
    sessionTypes: ['CONCEPT_SHARING'] as SessionType[],
  },
  {
    key: 'SELF_LEARNING',
    title: 'Self learning',
    detail:
      'Members research on their own — AI, documentation, tutorials, internal examples, small experiments. There is no session to schedule: the owner hands out a learning assignment, and members work the checklist and keep a learning log.',
    sessionTypes: [] as SessionType[],
  },
  {
    key: 'SHARING',
    title: 'Member sharing',
    detail:
      'The developer presents what they understood and what they practised. A practical challenge is the same stage with the emphasis on a live demonstration rather than a talk.',
    sessionTypes: ['MEMBER_SHARING', 'PRACTICAL_CHALLENGE'] as SessionType[],
  },
  {
    key: 'REVIEW',
    title: 'Review',
    detail:
      'The skill owner checks that they can explain, use, demonstrate and troubleshoot, then records a verified level against the evidence on file.',
    sessionTypes: ['REVIEW_ASSESSMENT'] as SessionType[],
  },
] as const;

export type CycleStageKey = (typeof LEARNING_CYCLE)[number]['key'];

/** Which stage of the cycle a given session type belongs to. */
export function cycleStageFor(type: SessionType): CycleStageKey | null {
  return LEARNING_CYCLE.find((s) => (s.sessionTypes as SessionType[]).includes(type))?.key ?? null;
}

/* ------------------------------------------------------------ skill docs */

export const DOC_KINDS = ['CONCEPT', 'STANDARD', 'REFERENCE'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  CONCEPT: 'Concept guide',
  STANDARD: 'Development standard',
  REFERENCE: 'Reference',
};

export const DOC_KIND_HINT: Record<DocKind, string> = {
  CONCEPT:
    'What it is, why we use it, the architecture and real examples. The material behind a Concept Sharing session.',
  STANDARD: 'How we build in this area: the conventions and decisions the team works to.',
  REFERENCE: 'Setup notes, cheat sheets, links — anything worth writing down once.',
};

/** URL-safe slug from a document title. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

/* ----------------------------------------------------- learning log §11 */

export const NOTE_KINDS = ['NOTE', 'LINK', 'CODE', 'QUESTION'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  NOTE: 'Note',
  LINK: 'Link',
  CODE: 'Code example',
  QUESTION: 'Open question',
};

/* -------------------------------------------------------- permissions §8 */

/**
 * A developer may never write their own verified level. Verification belongs to
 * the skill's owner, with admins able to stand in when the owner is the person
 * being assessed (or the skill has no owner yet).
 */
export function canVerify(opts: {
  actorId: string;
  actorRole: string;
  skillOwnerId: string | null;
  subjectId: string;
}): boolean {
  const { actorId, actorRole, skillOwnerId, subjectId } = opts;
  if (actorId === subjectId) return false; // nobody verifies themselves
  if (actorRole === 'ADMIN') return true;
  return !!skillOwnerId && skillOwnerId === actorId;
}

export function verifyDenialReason(opts: {
  actorId: string;
  actorRole: string;
  skillOwnerId: string | null;
  subjectId: string;
}): string | null {
  if (canVerify(opts)) return null;
  if (opts.actorId === opts.subjectId) {
    return 'You cannot verify your own level. A skill owner or admin has to review you.';
  }
  return 'Only this skill’s owner or an admin can record a verified level.';
}

/** A gap worth acting on: verified level is below the member's target. */
export function gapSize(verified: number | null, target: number | null): number {
  if (!target) return 0;
  return Math.max(0, target - (verified ?? 0));
}

/** Is a reassessment due? */
export function isReassessmentDue(nextAssessmentDate: Date | null | undefined): boolean {
  if (!nextAssessmentDate) return false;
  return new Date(nextAssessmentDate) <= new Date();
}
