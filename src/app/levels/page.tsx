import Link from 'next/link';
import {
  AI_CRITERIA,
  AI_CRITERION_LABEL,
  AI_RATINGS,
  AI_RATING_LABEL,
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_LABEL,
  CONFIDENCE_HINT,
  CONFIDENCE_LABEL,
  CONFIDENCE_LEVELS,
  DIFFICULTIES,
  DIFFICULTY_DEF,
  DIMENSIONS,
  DIMENSION_DEF,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABEL,
  LEARNING_CYCLE,
  LEVELS,
  LEVEL_DEF,
  MIN_QUESTIONS_ASKED,
  SESSION_TYPES,
  SESSION_TYPE_HINT,
  SESSION_TYPE_LABEL,
  WEAK_ALONE_EVIDENCE,
  type EvidenceType,
} from '@/lib/domain';
import { Card, LevelBadge, PageHeader, StatusChip } from '@/components/ui';
import { ConfidenceChip } from '@/components/assessment-view';

export const metadata = { title: 'Level guide · Dev Skill Programme' };

export default function LevelsPage() {
  return (
    <>
      <PageHeader
        title="Level guide"
        subtitle="The single definition of every grade, dimension and evidence type the programme uses. Everything else in the app links here rather than repeating it."
      />

      {/* ------------------------------------------------------- the scoring */}
      <Card title="How a grade is scored" className="mb-6">
        <div className="card-body grid gap-5 md:grid-cols-2">
          <div>
            <p className="hint mb-3">
              Each skill has a prepared Q&amp;A (the Q&amp;A tab on the skill). In a review the
              skill owner asks the questions and marks every answer Correct (full points), Partial
              (half) or Wrong (none). Harder questions carry more weight:
            </p>
            <ul className="space-y-1 text-xs text-muted">
              {DIFFICULTIES.map((d) => (
                <li key={d}>
                  <span className="font-medium text-ink">{DIFFICULTY_DEF[d].label}</span> —{' '}
                  {DIFFICULTY_DEF[d].weight} point{DIFFICULTY_DEF[d].weight === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
            <p className="hint mt-3">
              Score = points earned ÷ points possible over the questions asked (at least{' '}
              {MIN_QUESTIONS_ASKED}). The score sets the verified grade.
            </p>
          </div>
          <table className="w-full self-start text-sm">
            <thead>
              <tr className="border-y border-hair bg-wash">
                <th className="th">Score</th>
                <th className="th">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-rows">
              {[...LEVELS].reverse().map((l) => (
                <tr key={l}>
                  <td className="td tabular-nums">{LEVEL_DEF[l].band}</td>
                  <td className="td">
                    <LevelBadge level={l} withName />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --------------------------------------------------------- the ladder */}
      <section className="mb-8">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[...LEVELS].reverse().map((l) => (
            <article key={l} className="card p-5">
              <header className="mb-2.5 flex items-center gap-2.5">
                <LevelBadge level={l} />
                <h2 className="text-base font-semibold text-ink">{LEVEL_DEF[l].name}</h2>
                <span className="ml-auto text-xs tabular-nums text-muted">
                  score {LEVEL_DEF[l].band}
                </span>
              </header>
              <p className="mb-3 text-sm leading-relaxed text-muted">{LEVEL_DEF[l].summary}</p>
              <p className="label">Can</p>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
                {LEVEL_DEF[l].can.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="note note-info mt-4">
          <strong>A dash is not E.</strong> A dash means the skill has never been assessed. E means
          someone was assessed and scored below 60. The app shows them differently on purpose.
        </p>
      </section>

      {/* ------------------------------------------------------- what is scored */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Assessment dimensions">
          <div className="card-body">
            <p className="hint mb-3">
              A single number hides which part of a skill is missing, so every assessment can carry
              a score per dimension. A dimension may be left blank — “not assessed” is more honest
              than a guess, and blanks render as gaps rather than zeros.
            </p>
            <dl className="divide-rows rounded-lg border border-line">
              {DIMENSIONS.map((d) => (
                <div key={d} className="px-3.5 py-2.5">
                  <dt className="text-sm font-medium text-ink">{DIMENSION_DEF[d].label}</dt>
                  <dd className="text-xs text-muted">{DIMENSION_DEF[d].question}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card title="Independence from AI">
          <div className="card-body">
            <p className="hint mb-3">
              Using AI is not a negative factor. What is recorded is how much of the solution the
              developer demonstrably controls. Each criterion is rated{' '}
              {AI_RATINGS.map((r) => AI_RATING_LABEL[r]).join(' · ')}, and the rated ones roll up to
              a percentage.
            </p>
            <ul className="divide-rows rounded-lg border border-line">
              {AI_CRITERIA.map((c) => (
                <li key={c} className="px-3.5 py-2.5 text-sm text-ink">
                  {AI_CRITERION_LABEL[c]}
                </li>
              ))}
            </ul>
            <p className="note note-warn mt-3">
              AI can help a developer produce the solution, but the developer must demonstrate
              understanding of the solution.
            </p>
          </div>
        </Card>

        <Card title="Evidence types">
          <div className="card-body">
            <p className="hint mb-3">
              A level should rest on evidence. Types marked{' '}
              <span className="chip border-amber-200 bg-amber-50 text-amber-800">
                not enough alone
              </span>{' '}
              show recall or AI output rather than demonstrated skill — a level never rests on those
              by themselves.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {EVIDENCE_TYPES.map((t) => (
                <li
                  key={t}
                  className={`chip ${
                    WEAK_ALONE_EVIDENCE.includes(t as EvidenceType)
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'chip-plain'
                  }`}
                >
                  {EVIDENCE_TYPE_LABEL[t]}
                </li>
              ))}
            </ul>
            <p className="note note-info mt-3">
              The Q&amp;A sets the grade and is recorded as Knowledge questions evidence. Cite other
              forms of evidence alongside it to raise the confidence in that grade.
            </p>
          </div>
        </Card>

        <Card title="Confidence">
          <div className="card-body">
            <p className="hint mb-3">
              How well-evidenced a verified grade is. Confidence is capped by the evidence actually
              cited: picking High with one item on file records what the evidence supports instead.
            </p>
            <dl className="space-y-2">
              {CONFIDENCE_LEVELS.map((c) => (
                <div key={c} className="flex items-start gap-2.5">
                  <dt className="mt-0.5 shrink-0">
                    <ConfidenceChip confidence={c} compact />
                  </dt>
                  <dd className="text-xs leading-relaxed text-muted">{CONFIDENCE_HINT[c]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card title="Checklist statuses">
          <div className="card-body">
            <ul className="flex flex-wrap gap-1.5">
              {CHECKLIST_STATUSES.map((s) => (
                <li key={s}>
                  <StatusChip status={s} />
                </li>
              ))}
            </ul>
            <p className="hint mt-3">
              A member moves their own items through {CHECKLIST_STATUS_LABEL.LEARNING} and{' '}
              {CHECKLIST_STATUS_LABEL.COMPLETED}. Only the skill owner can mark an item{' '}
              {CHECKLIST_STATUS_LABEL.VERIFIED} — the same separation that keeps people from setting
              their own level.
            </p>
          </div>
        </Card>

        <Card title="Session types">
          <div className="card-body">
            <dl className="divide-rows rounded-lg border border-line">
              {SESSION_TYPES.map((t) => (
                <div key={t} className="px-3.5 py-2.5">
                  <dt className="text-sm font-medium text-ink">{SESSION_TYPE_LABEL[t]}</dt>
                  <dd className="text-xs leading-relaxed text-muted">{SESSION_TYPE_HINT[t]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------- learning cycle */}
      <Card title="The learning cycle" className="mt-6">
        <div className="card-body">
          <p className="hint mb-3.5">
            Four stages, but only three of them schedule a session — self learning is individual
            work.
          </p>
          <ol className="divide-rows rounded-lg border border-line">
            {LEARNING_CYCLE.map((stage, i) => (
              <li key={stage.key} className="px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-hair text-2xs font-semibold text-muted">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-ink">{stage.title}</span>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {stage.sessionTypes.length === 0 ? (
                      <span className="chip border-dashed border-line text-faint">no session</span>
                    ) : (
                      stage.sessionTypes.map((t) => (
                        <span key={t} className="chip chip-plain">
                          {SESSION_TYPE_LABEL[t]}
                        </span>
                      ))
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{stage.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <p className="mt-6 text-sm text-muted">
        Back to the{' '}
        <Link href="/skills?tab=team" className="link">
          team skills matrix
        </Link>{' '}
        or the{' '}
        <Link href="/skills" className="link">
          skill areas
        </Link>
        .
      </p>
    </>
  );
}
