import Link from 'next/link';
import {
  AI_CRITERION_LABEL,
  AI_RATING_LABEL,
  ANSWER_RESULT_DEF,
  DIFFICULTY_DEF,
  ASSESSMENT_METHOD_LABEL,
  CONFIDENCE_LABEL,
  DIMENSIONS,
  DIMENSION_DEF,
  EVIDENCE_TYPE_LABEL,
  LEVEL_DEF,
  independenceLabel,
  independenceScore,
  levelCode,
  type AiCriterion,
  type AiRating,
  type AnswerResult,
  type AssessmentMethod,
  type Difficulty,
  type Confidence,
  type Dimension,
  type EvidenceType,
  type Level,
} from '@/lib/domain';
import { LevelBadge, formatDate } from '@/components/ui';

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  LOW: 'border-red-200 bg-red-50 text-red-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-800',
  HIGH: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function ConfidenceChip({
  confidence,
  compact = false,
}: {
  confidence: string | null;
  /** Just the word, for dense grids where "confidence" repeats in every cell. */
  compact?: boolean;
}) {
  if (!confidence) return null;
  const c = confidence as Confidence;
  const label = CONFIDENCE_LABEL[c] ?? confidence;
  return (
    <span
      className={`chip ${CONFIDENCE_STYLE[c] ?? CONFIDENCE_STYLE.MEDIUM}`}
      title={`Confidence in this assessment: ${label}`}
    >
      {compact ? label : `${label} confidence`}
    </span>
  );
}

const AI_RATING_STYLE: Record<AiRating, string> = {
  NOT_ASSESSED: 'border-line bg-wash text-muted',
  NO: 'border-red-200 bg-red-50 text-red-700',
  PARTIAL: 'border-amber-200 bg-amber-50 text-amber-800',
  YES: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

/** Six small bars — the point is to show which dimension is holding the level back. */
export function DimensionBars({
  scores,
}: {
  scores: { dimension: string; level: number; note: string }[];
}) {
  if (scores.length === 0) {
    return <p className="text-xs text-muted">No dimensions were scored for this assessment.</p>;
  }
  const byDimension = new Map(scores.map((s) => [s.dimension, s]));

  return (
    <ul className="space-y-1.5">
      {DIMENSIONS.map((d) => {
        const score = byDimension.get(d);
        return (
          <li key={d} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2">
            <span className="text-xs" title={DIMENSION_DEF[d as Dimension].question}>
              {DIMENSION_DEF[d as Dimension].label}
            </span>
            <span className="flex h-1.5 gap-0.5" aria-hidden>
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={`h-full flex-1 rounded-sm ${
                    score == null
                      ? 'bg-line'
                      : score.level >= step
                        ? 'bg-brand'
                        : 'bg-line'
                  }`}
                />
              ))}
            </span>
            <span className="text-right text-xs tabular-nums text-muted">
              {score == null ? '—' : levelCode(score.level)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AiChecks({ checks }: { checks: { criterion: string; rating: string }[] }) {
  const score = independenceScore(checks.map((c) => c.rating as AiRating));
  return (
    <div className="space-y-1.5">
      {checks.map((c) => (
        <div key={c.criterion} className="flex items-center justify-between gap-2">
          <span className="text-xs">{AI_CRITERION_LABEL[c.criterion as AiCriterion] ?? c.criterion}</span>
          <span className={`chip ${AI_RATING_STYLE[c.rating as AiRating] ?? AI_RATING_STYLE.NOT_ASSESSED}`}>
            {AI_RATING_LABEL[c.rating as AiRating] ?? c.rating}
          </span>
        </div>
      ))}
      <p className="pt-1 text-xs text-muted">
        {score === null
          ? 'Independence from AI was not assessed.'
          : `${independenceLabel(score)} (${Math.round(score * 100)}%).`}
      </p>
    </div>
  );
}

export type EvidenceItem = {
  id: string;
  type: string;
  summary: string;
  detail: string;
  url: string;
  occurredAt: Date;
  recordedBy: { name: string } | null;
  session: { id: string; title: string } | null;
  _count?: { assessments: number };
};

export function EvidenceList({
  items,
  onDelete,
}: {
  items: EvidenceItem[];
  /** Pass the delete action to show a remove control on uncited items. */
  onDelete?: (formData: FormData) => void | Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="px-5 py-4 text-sm text-muted">No evidence recorded.</p>;
  }
  return (
    <ul className="divide-rows">
      {items.map((e) => {
        const cited = e._count?.assessments ?? 0;
        return (
          <li key={e.id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip chip-plain">
                {EVIDENCE_TYPE_LABEL[e.type as EvidenceType] ?? e.type}
              </span>
              <span className="text-sm font-medium text-ink">{e.summary}</span>
              <span className="ml-auto text-2xs text-faint">{formatDate(e.occurredAt)}</span>
              {onDelete && cited === 0 && (
                <form action={onDelete}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    className="text-xs text-faint transition hover:text-rose-600"
                    title="Remove this evidence"
                    aria-label={`Remove evidence: ${e.summary}`}
                  >
                    &times;
                  </button>
                </form>
              )}
            </div>
            {e.detail && (
              <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted">
                {e.detail}
              </p>
            )}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-faint">
              {e.recordedBy && <span>recorded by {e.recordedBy.name}</span>}
              {cited > 0 && (
                <span className="chip chip-plain">
                  cited by {cited} assessment{cited === 1 ? '' : 's'}
                </span>
              )}
              {e.session && (
                <Link href={`/sessions/${e.session.id}`} className="link">
                  {e.session.title}
                </Link>
              )}
              {e.url && (
                <a href={e.url} target="_blank" rel="noreferrer noopener" className="link break-all">
                  {e.url}
                </a>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export type AssessmentRecord = {
  id: string;
  type: string;
  level: number;
  score: number | null;
  evidence: string;
  comment: string;
  method: string | null;
  confidence: string | null;
  weakAreas: string;
  recommendedLearning: string;
  nextAssessmentDate: Date | null;
  createdAt: Date;
  reviewer: { name: string } | null;
  session: { id: string; title: string } | null;
  dimensions: { dimension: string; level: number; note: string }[];
  aiChecks: { criterion: string; rating: string }[];
  answers: { id: string; topic: string; prompt: string; difficulty: string; weight: number; result: string; note: string }[];
  evidenceItems: EvidenceItem[];
};

const ANSWER_STYLE: Record<string, string> = {
  CORRECT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PARTIAL: 'border-amber-200 bg-amber-50 text-amber-800',
  WRONG: 'border-rose-200 bg-rose-50 text-rose-700',
};

/** The Q&A behind a verified grade: every question asked and how it went. */
export function QaAnswers({ answers }: { answers: AssessmentRecord['answers'] }) {
  return (
    <ul className="space-y-1">
      {answers.map((q) => (
        <li key={q.id} className="flex items-start gap-2 text-xs">
          <span className={`chip shrink-0 ${ANSWER_STYLE[q.result] ?? 'chip-plain'}`}>
            {ANSWER_RESULT_DEF[q.result as AnswerResult]?.label ?? q.result}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-ink">{q.prompt}</span>
            <span className="text-faint">
              {' '}
              · {q.topic} · {DIFFICULTY_DEF[q.difficulty as Difficulty]?.label ?? q.difficulty}{' '}
              {q.weight}pt
            </span>
            {q.note && <span className="block text-muted">{q.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One full entry in the assessment history. */
export function AssessmentEntry({ a, skillName }: { a: AssessmentRecord; skillName?: string }) {
  const isVerification = a.type === 'VERIFICATION';
  const body = isVerification ? a.comment : a.evidence;

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`chip ${
            isVerification
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-sky-200 bg-sky-50 text-sky-700'
          }`}
        >
          {isVerification ? 'Verified grade' : 'Self assessment'}
        </span>
        {skillName && <span className="text-sm font-medium">{skillName}</span>}
        <LevelBadge level={a.level} />
        <span className="text-xs text-muted">{LEVEL_DEF[a.level as Level]?.name}</span>
        {a.score !== null && (
          <span className="chip chip-plain tabular-nums" title="Weighted Q&A score">
            Q&amp;A {a.score}%
          </span>
        )}
        {isVerification && <ConfidenceChip confidence={a.confidence} />}
        <span className="ml-auto text-xs text-muted">{formatDate(a.createdAt)}</span>
      </div>

      {body && <p className="mt-1.5 whitespace-pre-line text-xs text-muted">{body}</p>}

      {a.answers.length > 0 && (
        <details className="mt-2.5 rounded-md border border-line bg-wash p-2.5">
          <summary className="label mb-0 cursor-pointer">
            Q&amp;A — {a.answers.length} questions
          </summary>
          <div className="mt-2">
            <QaAnswers answers={a.answers} />
          </div>
        </details>
      )}

      {a.dimensions.length > 0 && (
        <div className="mt-2.5 rounded-md border border-line bg-wash p-2.5">
          <p className="label mb-1.5">Dimensions</p>
          <DimensionBars scores={a.dimensions} />
        </div>
      )}

      {isVerification && a.aiChecks.length > 0 && (
        <div className="mt-2 rounded-md border border-line bg-wash p-2.5">
          <p className="label mb-1.5">Independence from AI</p>
          <AiChecks checks={a.aiChecks} />
        </div>
      )}

      {a.evidenceItems.length > 0 && (
        <div className="mt-2">
          <p className="label mb-1">Evidence cited ({a.evidenceItems.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {a.evidenceItems.map((e) => (
              <li
                key={e.id}
                className="chip border-line bg-surface text-muted"
                title={e.summary}
              >
                {EVIDENCE_TYPE_LABEL[e.type as EvidenceType] ?? e.type}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(a.weakAreas || a.recommendedLearning) && (
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          {a.weakAreas && (
            <div>
              <dt className="label">Weak areas</dt>
              <dd className="whitespace-pre-line text-muted">{a.weakAreas}</dd>
            </div>
          )}
          {a.recommendedLearning && (
            <div>
              <dt className="label">Recommended learning</dt>
              <dd className="whitespace-pre-line text-muted">{a.recommendedLearning}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-1.5 flex flex-wrap gap-x-2 text-2xs text-muted">
        <span>
          {isVerification
            ? `Assessor: ${a.reviewer?.name ?? 'removed'}`
            : 'Recorded by the member'}
        </span>
        {a.method && <span>· {ASSESSMENT_METHOD_LABEL[a.method as AssessmentMethod] ?? a.method}</span>}
        {a.session && (
          <>
            <span>·</span>
            <Link href={`/sessions/${a.session.id}`} className="link">
              {a.session.title}
            </Link>
          </>
        )}
        {a.nextAssessmentDate && <span>· next assessment {formatDate(a.nextAssessmentDate)}</span>}
      </p>
    </li>
  );
}

/** The select shape every page needs to render an AssessmentEntry. */
export const assessmentSelect = {
  id: true,
  type: true,
  level: true,
  score: true,
  evidence: true,
  comment: true,
  method: true,
  confidence: true,
  weakAreas: true,
  recommendedLearning: true,
  nextAssessmentDate: true,
  createdAt: true,
  reviewer: { select: { name: true } },
  session: { select: { id: true, title: true } },
  dimensions: { select: { dimension: true, level: true, note: true } },
  aiChecks: { select: { criterion: true, rating: true } },
  answers: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      topic: true,
      prompt: true,
      difficulty: true,
      weight: true,
      result: true,
      note: true,
    },
  },
  evidenceItems: {
    select: {
      id: true,
      type: true,
      summary: true,
      detail: true,
      url: true,
      occurredAt: true,
      recordedBy: { select: { name: true } },
      session: { select: { id: true, title: true } },
    },
  },
} as const;
