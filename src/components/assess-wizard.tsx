'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AI_CRITERIA,
  AI_CRITERION_LABEL,
  AI_RATINGS,
  AI_RATING_LABEL,
  ASSESSMENT_METHODS,
  ASSESSMENT_METHOD_LABEL,
  CONFIDENCE_HINT,
  CONFIDENCE_LABEL,
  CONFIDENCE_LEVELS,
  DIMENSIONS,
  DIMENSION_DEF,
  EVIDENCE_TYPE_LABEL,
  LEVELS,
  LEVEL_DEF,
  evidenceWarnings,
  independenceLabel,
  independenceScore,
  levelCode,
  suggestedConfidence,
  type AiRating,
  type Dimension,
  type EvidenceType,
  type Level,
} from '@/lib/domain';
import { submitVerification } from '@/lib/actions';
import { Feedback, SubmitButton } from '@/components/forms';
import { LevelBadge } from '@/components/ui';
import { useActionState } from 'react';

export type EvidenceOption = {
  id: string;
  type: string;
  summary: string;
  occurredAt: string;
  citedCount: number;
};

const STEPS = [
  { key: 'level', label: 'Level', blurb: 'Where does the overall level land?' },
  { key: 'dimensions', label: 'Dimensions', blurb: 'Score only what you observed.' },
  { key: 'evidence', label: 'Evidence', blurb: 'What backs this level?' },
  { key: 'ai', label: 'Independence', blurb: 'How much do they control the solution?' },
  { key: 'record', label: 'Record', blurb: 'Notes, next steps and confidence.' },
] as const;

/**
 * The assessment is long by nature — spec 2 asks for a level, six dimensions,
 * evidence, five AI-dependency checks and a written record. Splitting it into
 * steps keeps each screen answerable, while every input stays mounted so a
 * single submit carries the whole form.
 */
export function AssessWizard({
  memberId,
  memberName,
  skillId,
  skillName,
  currentVerified,
  selfLevel,
  selfDimensions = [],
  evidence,
  sessions = [],
  sessionId,
  onDoneHref,
}: {
  memberId: string;
  memberName: string;
  skillId: string;
  skillName: string;
  currentVerified: number | null;
  selfLevel: number | null;
  selfDimensions?: { dimension: string; level: number }[];
  evidence: EvidenceOption[];
  sessions?: { id: string; title: string; date: string }[];
  sessionId?: string;
  onDoneHref?: string;
}) {
  const [state, formAction] = useActionState(submitVerification, null);
  const [step, setStep] = useState(0);
  const topRef = useRef<HTMLOListElement>(null);

  // Steps vary a lot in height, so keep the rail in view when one changes —
  // otherwise Next can leave you staring at blank space below a short step.
  const goToStep = useCallback((next: number) => {
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const [level, setLevel] = useState<number>(currentVerified ?? selfLevel ?? 0);
  const [dims, setDims] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<string[]>([]);
  const [confidence, setConfidence] = useState('');
  const [ai, setAi] = useState<Record<string, AiRating>>(
    Object.fromEntries(AI_CRITERIA.map((c) => [c, 'NOT_ASSESSED' as AiRating])),
  );

  const firstName = memberName.split(' ')[0];
  const selfByDim = new Map(selfDimensions.map((d) => [d.dimension, d.level]));

  const citedTypes = useMemo(
    () =>
      checked.map((id) => evidence.find((e) => e.id === id)?.type).filter(Boolean) as EvidenceType[],
    [checked, evidence],
  );

  const warnings = evidenceWarnings(citedTypes, level);
  const supported = suggestedConfidence(citedTypes, level);
  const independence = independenceScore(AI_CRITERIA.map((c) => ai[c]));
  const scoredDims = DIMENSIONS.filter((d) => dims[d] !== undefined && dims[d] !== '').length;
  const aiAssessed = AI_CRITERIA.filter((c) => ai[c] !== 'NOT_ASSESSED').length;

  const order = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const capped = confidence !== '' && order[confidence as keyof typeof order] > order[supported];

  const done: Record<string, string | null> = {
    level: levelCode(level),
    dimensions: scoredDims > 0 ? `${scoredDims}/6` : null,
    evidence: checked.length > 0 ? `${checked.length} cited` : null,
    ai: aiAssessed > 0 ? `${Math.round((independence ?? 0) * 100)}%` : null,
    record: null,
  };

  if (state?.ok) {
    return (
      <div className="card-body">
        <div className="note note-ok mb-4">{state.message ?? 'Assessment recorded.'}</div>
        <div className="flex flex-wrap gap-2">
          {onDoneHref && (
            <a href={onDoneHref} className="btn btn-primary">
              Back to {skillName} workspace
            </a>
          )}
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Record another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="skillId" value={skillId} />
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}

      {/* ------------------------------------------------------- step rail */}
      <ol ref={topRef} className="flex scroll-mt-24 gap-1 overflow-x-auto border-b border-line px-5 pb-0">
        {STEPS.map((s, i) => {
          const active = i === step;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => goToStep(i)}
                aria-current={active ? 'step' : undefined}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'border-brand text-ink'
                    : 'border-transparent text-muted hover:border-line hover:text-ink'
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-2xs font-semibold ${
                    active ? 'bg-brand text-white' : 'bg-hair text-muted'
                  }`}
                >
                  {i + 1}
                </span>
                {s.label}
                {done[s.key] && !active && (
                  <span className="chip chip-plain">{done[s.key]}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="px-5 py-5">
        <p className="mb-4 text-sm text-muted">{STEPS[step].blurb}</p>

        {/* ------------------------------------------------------ 1. level */}
        <section hidden={step !== 0} className="space-y-4">
          <div className="note note-warn">
            Assess understanding, not output. A developer who shipped the feature with AI has not,
            by that fact, demonstrated the skill — check that {firstName} can explain the solution,
            read the code, debug it and justify the decisions.
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {LEVELS.map((l) => (
              <label key={l} className={`choice ${level === l ? 'choice-on' : ''}`}>
                <input
                  type="radio"
                  name="level"
                  value={l}
                  checked={level === l}
                  onChange={() => setLevel(l)}
                  className="mt-1"
                />
                <span className="text-xs">
                  <strong className="block text-sm text-ink">
                    {LEVEL_DEF[l as Level].code} · {LEVEL_DEF[l as Level].name}
                  </strong>
                  <span className="mt-0.5 block leading-relaxed text-muted">
                    {LEVEL_DEF[l as Level].summary}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Currently verified <LevelBadge level={currentVerified} /> · they self-assessed{' '}
            <LevelBadge level={selfLevel} />
          </p>
        </section>

        {/* ------------------------------------------------- 2. dimensions */}
        <section hidden={step !== 1} className="space-y-2">
          <p className="hint mb-3">
            Leave a dimension blank if this assessment did not cover it — a blank is more honest
            than a guess, and blanks show as gaps rather than zeros.
          </p>
          {DIMENSIONS.map((d) => {
            const theirs = selfByDim.get(d);
            return (
              <div
                key={d}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line px-3.5 py-2.5"
              >
                <label htmlFor={`dim-${d}`} className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {DIMENSION_DEF[d as Dimension].label}
                  </span>
                  <span className="block text-xs text-muted">
                    {DIMENSION_DEF[d as Dimension].question}
                  </span>
                </label>
                {theirs !== undefined && (
                  <span className="flex items-center gap-1 text-2xs text-faint">
                    self <LevelBadge level={theirs} />
                  </span>
                )}
                <select
                  id={`dim-${d}`}
                  name={`dim_${d}`}
                  value={dims[d] ?? ''}
                  onChange={(e) => setDims((p) => ({ ...p, [d]: e.target.value }))}
                  className="field w-auto py-1.5 text-xs"
                >
                  <option value="">Not assessed</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_DEF[l as Level].code} — {LEVEL_DEF[l as Level].name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </section>

        {/* --------------------------------------------------- 3. evidence */}
        <section hidden={step !== 2} className="space-y-3">
          {evidence.length === 0 ? (
            <div className="note note-warn">
              No evidence is on file for {memberName} in {skillName}. A level should be supported by
              evidence — record some on their workspace first.
            </div>
          ) : (
            <div className="space-y-1.5">
              {evidence.map((e) => {
                const on = checked.includes(e.id);
                return (
                  <label key={e.id} className={`choice ${on ? 'choice-on' : ''}`}>
                    <input
                      type="checkbox"
                      name="evidenceIds"
                      value={e.id}
                      checked={on}
                      onChange={(ev) =>
                        setChecked((prev) =>
                          ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id),
                        )
                      }
                      className="mt-1"
                    />
                    <span className="min-w-0 text-xs">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="text-sm text-ink">
                          {EVIDENCE_TYPE_LABEL[e.type as EvidenceType] ?? e.type}
                        </strong>
                        <span className="text-faint">{e.occurredAt}</span>
                        {e.citedCount > 0 && (
                          <span className="chip chip-plain">
                            in {e.citedCount} earlier assessment{e.citedCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block leading-relaxed text-muted">{e.summary}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {warnings.map((w) => (
            <p key={w} className="note note-warn">
              {w}
            </p>
          ))}
          {warnings.length === 0 && checked.length > 0 && (
            <p className="note note-ok">
              {checked.length} item{checked.length === 1 ? '' : 's'} cited across{' '}
              {new Set(citedTypes).size} form{new Set(citedTypes).size === 1 ? '' : 's'} of evidence.
            </p>
          )}
        </section>

        {/* --------------------------------------------------------- 4. AI */}
        <section hidden={step !== 3} className="space-y-2">
          <p className="hint mb-3">
            Using AI is not a negative. What matters is whether they understand and control the
            solution.
          </p>
          {AI_CRITERIA.map((c) => (
            <div
              key={c}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg border border-line px-3.5 py-2.5"
            >
              <label htmlFor={`ai-${c}`} className="text-sm text-ink">
                {AI_CRITERION_LABEL[c]}
              </label>
              <select
                id={`ai-${c}`}
                name={`ai_${c}`}
                value={ai[c]}
                onChange={(e) => setAi((p) => ({ ...p, [c]: e.target.value as AiRating }))}
                className="field w-auto py-1.5 text-xs"
              >
                {AI_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {AI_RATING_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className={`note ${independence === null ? 'note-info' : 'note-ok'} mt-3`}>
            {independence === null
              ? 'Not assessed yet — leave it blank if this review did not cover it.'
              : `${independenceLabel(independence)} (${Math.round(independence * 100)}%).`}
          </p>
        </section>

        {/* ----------------------------------------------------- 5. record */}
        <section hidden={step !== 4} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="aw-method">
                Assessment type
              </label>
              <select
                id="aw-method"
                name="method"
                className="field"
                defaultValue={sessionId ? 'SESSION_REVIEW' : 'OWNER_REVIEW'}
              >
                {ASSESSMENT_METHODS.filter((m) => m !== 'SELF_ASSESSMENT').map((m) => (
                  <option key={m} value={m}>
                    {ASSESSMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="aw-confidence">
                Confidence
              </label>
              <select
                id="aw-confidence"
                name="confidence"
                className="field"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
              >
                <option value="">Let the evidence decide ({CONFIDENCE_LABEL[supported]})</option>
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {CONFIDENCE_LABEL[c]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted">
                {capped
                  ? `The cited evidence only supports ${CONFIDENCE_LABEL[
                      supported
                    ].toLowerCase()} confidence; that is what will be saved.`
                  : CONFIDENCE_HINT[supported]}
              </p>
            </div>
          </div>

          {sessions.length > 0 && !sessionId && (
            <div>
              <label className="label" htmlFor="aw-session">
                From session (optional)
              </label>
              <select id="aw-session" name="sessionId" className="field" defaultValue="">
                <option value="">Not tied to a session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} — {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="aw-comment">
              Comment
            </label>
            <textarea
              id="aw-comment"
              name="comment"
              rows={3}
              className="field"
              placeholder="What they demonstrated, in concrete terms."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="aw-weak">
                Weak areas
              </label>
              <textarea
                id="aw-weak"
                name="weakAreas"
                rows={2}
                className="field"
                placeholder="e.g. indexes, transaction isolation"
              />
            </div>
            <div>
              <label className="label" htmlFor="aw-learn">
                Recommended learning
              </label>
              <textarea
                id="aw-learn"
                name="recommendedLearning"
                rows={2}
                className="field"
                placeholder="What to work on before the next assessment."
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="aw-next">
              Next assessment
            </label>
            <input
              id="aw-next"
              name="nextAssessmentDate"
              type="date"
              className="field sm:w-56"
            />
          </div>

          {/* A last look at everything before it becomes a permanent record. */}
          <dl className="grid gap-x-6 gap-y-2 rounded-lg bg-wash px-4 py-3 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <dt className="text-muted">Level</dt>
              <dd>
                <LevelBadge level={level} withName />
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted">Dimensions scored</dt>
              <dd className="font-medium text-ink">{scoredDims} of 6</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted">Evidence cited</dt>
              <dd className="font-medium text-ink">
                {checked.length} ({new Set(citedTypes).size} form
                {new Set(citedTypes).size === 1 ? '' : 's'})
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted">Independence</dt>
              <dd className="font-medium text-ink">
                {independence === null ? 'not assessed' : `${Math.round(independence * 100)}%`}
              </dd>
            </div>
          </dl>

          {warnings.length > 0 && (
            <div className="space-y-1.5">
              {warnings.map((w) => (
                <p key={w} className="note note-warn">
                  {w}
                </p>
              ))}
            </div>
          )}
        </section>

        <Feedback state={state} />
      </div>

      {/* ---------------------------------------------------------- footer */}
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => goToStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        <span className="text-xs text-faint">
          Step {step + 1} of {STEPS.length}
        </span>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => goToStep(step + 1)}>
            Next
          </button>
        ) : (
          <SubmitButton pendingLabel="Recording…">Record {levelCode(level)}</SubmitButton>
        )}
      </div>
    </form>
  );
}
