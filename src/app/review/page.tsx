import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { getPendingReviews } from '@/lib/queries';
import { isReassessmentDue, levelCode } from '@/lib/domain';
import {
  Card,
  Empty,
  LevelBadge,
  PageHeader,
  Progress,
  formatDate,
  relativeDate,
} from '@/components/ui';

const DONE = ['COMPLETED', 'VERIFIED'];

export default async function ReviewPage() {
  const me = await requireActingUser();
  const isAdmin = me.role === 'ADMIN';

  const [pending, ownedSkills] = await Promise.all([
    getPendingReviews(me.id, isAdmin),
    prisma.skill.findMany({
      where: isAdmin ? { archived: false } : { archived: false, ownerId: me.id },
      orderBy: { order: 'asc' },
      select: { id: true, key: true, name: true, _count: { select: { checklistItems: true } } },
    }),
  ]);

  const memberIds = [...new Set(pending.map((p) => p.member.id))];
  const skillIds = [...new Set(pending.map((p) => p.skill.id))];

  const [progressRows, evidenceRows] = await Promise.all([
    memberIds.length === 0
      ? []
      : prisma.checklistProgress.findMany({
          where: {
            status: { in: DONE },
            memberId: { in: memberIds },
            item: { skillId: { in: skillIds } },
          },
          select: { memberId: true, item: { select: { skillId: true } } },
        }),
    memberIds.length === 0
      ? []
      : prisma.evidence.groupBy({
          by: ['memberId', 'skillId'],
          where: { memberId: { in: memberIds }, skillId: { in: skillIds } },
          _count: { _all: true },
        }),
  ]);

  const doneBy = new Map<string, number>();
  for (const p of progressRows) {
    const key = `${p.memberId}:${p.item.skillId}`;
    doneBy.set(key, (doneBy.get(key) ?? 0) + 1);
  }
  const evidenceBy = new Map(evidenceRows.map((e) => [`${e.memberId}:${e.skillId}`, e._count._all]));
  const totals = new Map(ownedSkills.map((s) => [s.id, s._count.checklistItems]));

  // Overdue reassessments first, then the biggest self-vs-verified gaps.
  const sorted = [...pending].sort((a, b) => {
    const aDue = isReassessmentDue(a.nextAssessmentDate) ? 1 : 0;
    const bDue = isReassessmentDue(b.nextAssessmentDate) ? 1 : 0;
    if (aDue !== bDue) return bDue - aDue;
    const aGap = (a.selfLevel ?? 0) - (a.verifiedLevel ?? 0);
    const bGap = (b.selfLevel ?? 0) - (b.verifiedLevel ?? 0);
    return bGap - aGap;
  });

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle={
          isAdmin
            ? 'Self assessments sitting above their verified level, plus anyone whose reassessment is due. As an admin you can review any of them.'
            : ownedSkills.length > 0
              ? `Waiting on you as owner of ${ownedSkills.map((s) => s.name).join(', ')}.`
              : 'You do not own a skill, so nothing is queued for you.'
        }
        meta={
          sorted.length > 0 && (
            <span className="chip chip-plain">
              {sorted.length} waiting
            </span>
          )
        }
      />

      {ownedSkills.length === 0 && !isAdmin ? (
        <Card>
          <Empty
            action={
              <Link href="/skills" className="btn">
                See the skills
              </Link>
            }
          >
            Reviews are done by skill owners. If you think you should own a skill, ask an admin.
          </Empty>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <Empty>Nothing is waiting for review. Every verified level is current.</Empty>
        </Card>
      ) : (
        <Card>
          <ul className="divide-rows">
            {sorted.map((p) => {
              const key = `${p.member.id}:${p.skill.id}`;
              const total = totals.get(p.skill.id) ?? 0;
              const done = doneBy.get(key) ?? 0;
              const evidenceCount = evidenceBy.get(key) ?? 0;
              const due = isReassessmentDue(p.nextAssessmentDate);
              const gap = (p.selfLevel ?? 0) - (p.verifiedLevel ?? 0);

              return (
                <li key={key}>
                  <Link
                    href={`/members/${p.member.id}/skills/${p.skill.key}/assess`}
                    className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition hover:bg-wash"
                  >
                    <div className="min-w-[11rem] flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{p.member.name}</span>
                        <span className="text-sm text-muted">{p.skill.name}</span>
                        {due && (
                          <span className="chip border-amber-200 bg-amber-50 text-amber-800">
                            reassess
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {due && p.nextAssessmentDate
                          ? `Due ${relativeDate(p.nextAssessmentDate)}`
                          : p.submittedAt
                            ? `Self-assessed ${relativeDate(p.submittedAt)}`
                            : 'No self assessment on file'}
                        {' · '}
                        {evidenceCount} evidence item{evidenceCount === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted">
                      <LevelBadge level={p.verifiedLevel} />
                      <span aria-hidden className="text-faint">
                        &rarr;
                      </span>
                      <LevelBadge level={p.selfLevel} />
                      {gap > 0 && (
                        <span className="chip border-amber-200 bg-amber-50 text-amber-800">
                          +{gap}
                        </span>
                      )}
                    </div>

                    <div className="w-28">
                      <Progress done={done} total={total} />
                    </div>

                    <span className="text-xs font-medium text-brand">Assess &rarr;</span>
                  </Link>

                  {p.evidence && (
                    <p className="-mt-1 px-5 pb-4 text-xs leading-relaxed text-muted">
                      <span className="font-medium text-body">They say:</span> {p.evidence}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="What a review is checking" className="mt-6">
        <div className="card-body">
          <ul className="grid gap-x-8 gap-y-1.5 text-sm text-muted sm:grid-cols-2">
            <li>Can they explain the concept in their own words?</li>
            <li>Can they implement a solution?</li>
            <li>Can they read existing or AI-generated code?</li>
            <li>Can they identify and solve problems?</li>
            <li>Can they make reasonable technical decisions?</li>
            <li>Can they explain why a solution was chosen?</li>
          </ul>
          <p className="note note-warn mt-4">
            AI can help a developer produce the solution, but the developer must demonstrate
            understanding of it. Do not raise a level only because code was generated successfully,
            and do not settle a level on one quiz score.
          </p>
        </div>
      </Card>

      <p className="mt-4 text-xs text-muted">
        Last checked {formatDate(new Date())}.
      </p>
    </>
  );
}
