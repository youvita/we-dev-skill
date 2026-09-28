import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { getPendingReviews } from '@/lib/queries';
import { SESSION_TYPE_LABEL, isReassessmentDue, levelCode, type SessionType } from '@/lib/domain';
import {
  Card,
  Empty,
  LevelBadge,
  PageHeader,
  Progress,
  SectionTitle,
  formatDate,
  relativeDate,
} from '@/components/ui';
import { ConfidenceChip } from '@/components/assessment-view';

const DONE = ['COMPLETED', 'VERIFIED'];

export default async function DashboardPage() {
  const me = await requireActingUser();

  const [links, assignments, upcoming, pending, recent, doneCounts, myVerifications] =
    await Promise.all([
      prisma.memberSkill.findMany({
        where: { memberId: me.id },
        orderBy: { skill: { order: 'asc' } },
        select: {
          isPrimary: true,
          targetLevel: true,
          selfLevel: true,
          verifiedLevel: true,
          skill: {
            select: { id: true, key: true, name: true, _count: { select: { checklistItems: true } } },
          },
        },
      }),
      prisma.learningAssignment.findMany({
        where: { memberId: me.id, status: 'ACTIVE' },
        orderBy: [{ dueDate: 'asc' }],
        select: {
          id: true,
          targetLevel: true,
          dueDate: true,
          note: true,
          skill: { select: { id: true, key: true, name: true } },
        },
      }),
      prisma.session.findMany({
        where: { status: 'PLANNED', date: { gte: new Date() } },
        orderBy: { date: 'asc' },
        take: 4,
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          skill: { select: { name: true, key: true } },
          presenter: { select: { name: true } },
          _count: { select: { participants: true } },
        },
      }),
      getPendingReviews(me.id, me.role === 'ADMIN'),
      prisma.assessment.findMany({
        where: { type: 'VERIFICATION' },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: {
          id: true,
          level: true,
          confidence: true,
          createdAt: true,
          member: { select: { id: true, name: true } },
          skill: { select: { name: true, key: true } },
          reviewer: { select: { name: true } },
        },
      }),
      prisma.checklistProgress.findMany({
        where: { memberId: me.id, status: { in: DONE } },
        select: { item: { select: { skillId: true } } },
      }),
      prisma.assessment.findMany({
        where: { memberId: me.id, type: 'VERIFICATION' },
        orderBy: { createdAt: 'desc' },
        select: {
          skillId: true,
          nextAssessmentDate: true,
          weakAreas: true,
          recommendedLearning: true,
          skill: { select: { key: true, name: true } },
        },
      }),
    ]);

  const doneBySkill = new Map<string, number>();
  for (const p of doneCounts) {
    doneBySkill.set(p.item.skillId, (doneBySkill.get(p.item.skillId) ?? 0) + 1);
  }

  const latestMine = new Map<string, (typeof myVerifications)[number]>();
  for (const v of myVerifications) if (!latestMine.has(v.skillId)) latestMine.set(v.skillId, v);
  const dueReassessments = [...latestMine.values()].filter((v) =>
    isReassessmentDue(v.nextAssessmentDate),
  );
  const nextSteps = [...latestMine.values()].filter((v) => v.recommendedLearning);

  const primary = links.find((l) => l.isPrimary);
  const gaps = links.filter((l) => (l.verifiedLevel ?? 0) < l.targetLevel);

  // One band at the top for anything actually waiting on this person.
  const attention: { href: string; label: string; detail: string; tone: 'warn' | 'info' }[] = [];
  if (pending.length > 0) {
    attention.push({
      href: '/review',
      label: `${pending.length} assessment${pending.length === 1 ? '' : 's'} to review`,
      detail: 'People are waiting on you as a skill owner.',
      tone: 'warn',
    });
  }
  for (const v of dueReassessments) {
    attention.push({
      href: `/members/${me.id}/skills/${v.skill.key}`,
      label: `${v.skill.name} reassessment due`,
      detail: `Was due ${relativeDate(v.nextAssessmentDate!)}.`,
      tone: 'warn',
    });
  }
  for (const a of assignments) {
    attention.push({
      href: `/members/${me.id}/skills/${a.skill.key}`,
      label: `${a.skill.name} → ${levelCode(a.targetLevel)}`,
      detail: a.dueDate ? `Assignment due ${relativeDate(a.dueDate)}.` : 'Learning assignment.',
      tone: 'info',
    });
  }

  return (
    <>
      <PageHeader
        title={`Hello, ${me.name}`}
        subtitle={
          primary
            ? `Your primary skill is ${primary.skill.name}. Everything else here is about understanding the full development flow well enough to contribute outside it.`
            : 'You do not have a primary skill yet — an admin can set one on your profile.'
        }
        action={
          <Link href={`/members/${me.id}`} className="btn">
            My profile
          </Link>
        }
      />

      {attention.length > 0 && (
        <section className="mb-7">
          <SectionTitle>Needs your attention</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {attention.slice(0, 6).map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className={`card px-4 py-3.5 transition hover:shadow-lift ${
                  a.tone === 'warn' ? 'ring-1 ring-amber-200' : 'ring-1 ring-brand-ring/40'
                }`}
              >
                <p className="text-sm font-semibold text-ink">{a.label}</p>
                <p className="mt-1 text-xs text-muted">{a.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <Card
            title="My skills"
            action={
              <Link href="/skills?tab=team" className="text-xs font-medium text-brand hover:underline">
                Team skills &rarr;
              </Link>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem]">
                <thead>
                  <tr className="border-y border-hair bg-wash">
                    <th className="th">Skill</th>
                    <th className="th text-center">Verified</th>
                    <th className="th text-center">Self</th>
                    <th className="th text-center">Target</th>
                    <th className="th w-40">Checklist</th>
                  </tr>
                </thead>
                <tbody className="divide-rows">
                  {links.map((l) => (
                    <tr key={l.skill.id} className="transition hover:bg-wash">
                      <td className="td">
                        <Link
                          href={`/members/${me.id}/skills/${l.skill.key}`}
                          className="font-medium text-ink transition hover:text-brand"
                        >
                          {l.skill.name}
                        </Link>
                        {l.isPrimary && (
                          <span className="ml-2 chip border-violet-200 bg-violet-50 text-violet-700">
                            Primary
                          </span>
                        )}
                      </td>
                      <td className="td text-center">
                        <LevelBadge level={l.verifiedLevel} />
                      </td>
                      <td className="td text-center">
                        <LevelBadge level={l.selfLevel} />
                      </td>
                      <td className="td text-center text-xs text-muted">
                        {levelCode(l.targetLevel)}
                      </td>
                      <td className="td">
                        <Progress
                          done={doneBySkill.get(l.skill.id) ?? 0}
                          total={l.skill._count.checklistItems}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {nextSteps.length > 0 && (
            <Card title="Recommended for me">
              <ul className="divide-rows">
                {nextSteps.map((v) => (
                  <li key={v.skillId} className="px-5 py-3.5">
                    <Link
                      href={`/members/${me.id}/skills/${v.skill.key}`}
                      className="text-sm font-medium text-ink transition hover:text-brand"
                    >
                      {v.skill.name}
                    </Link>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {v.recommendedLearning}
                    </p>
                    {v.weakAreas && (
                      <p className="mt-1 text-xs text-faint">Weak areas: {v.weakAreas}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card
            title="Upcoming sessions"
            action={
              <Link href="/sessions" className="text-xs font-medium text-brand hover:underline">
                All &rarr;
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <Empty
                action={
                  <Link href="/sessions/new" className="btn btn-sm">
                    Schedule one
                  </Link>
                }
              >
                Nothing scheduled.
              </Empty>
            ) : (
              <ul className="divide-rows">
                {upcoming.map((s) => (
                  <li key={s.id} className="px-5 py-3.5">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="text-sm font-medium text-ink transition hover:text-brand"
                    >
                      {s.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(s.date)} · {s.skill.name}
                    </p>
                    <p className="text-2xs text-faint">
                      {SESSION_TYPE_LABEL[s.type as SessionType]} ·{' '}
                      {s.presenter?.name ?? 'no presenter'} · {s._count.participants} people
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="My gaps to target">
            {gaps.length === 0 ? (
              <Empty>Every skill is at or above its target.</Empty>
            ) : (
              <ul className="divide-rows">
                {gaps.map((g) => (
                  <li key={g.skill.id}>
                    <Link
                      href={`/members/${me.id}/skills/${g.skill.key}`}
                      className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm transition hover:bg-wash"
                    >
                      <span className="text-ink">{g.skill.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <LevelBadge level={g.verifiedLevel} />
                        <span aria-hidden className="text-faint">
                          &rarr;
                        </span>
                        <LevelBadge level={g.targetLevel} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent verifications">
            {recent.length === 0 ? (
              <Empty>No verifications recorded yet.</Empty>
            ) : (
              <ul className="divide-rows">
                {recent.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Link
                        href={`/members/${a.member.id}`}
                        className="font-medium text-ink transition hover:text-brand"
                      >
                        {a.member.name}
                      </Link>
                      <span className="text-muted">
                        reached {levelCode(a.level)} in {a.skill.name}
                      </span>
                      <ConfidenceChip confidence={a.confidence} />
                    </p>
                    <p className="mt-0.5 text-2xs text-faint">
                      {a.reviewer ? `reviewed by ${a.reviewer.name}` : 'reviewer removed'} ·{' '}
                      {relativeDate(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
