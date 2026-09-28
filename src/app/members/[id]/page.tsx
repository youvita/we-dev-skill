import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { SESSION_TYPE_LABEL, isReassessmentDue, levelCode, type SessionType } from '@/lib/domain';
import {
  Card,
  Empty,
  LevelBadge,
  PageHeader,
  Progress,
  formatDate,
} from '@/components/ui';
import { AssessmentEntry, assessmentSelect } from '@/components/assessment-view';
import { setPrimarySkill } from '@/lib/actions';

const DONE = ['COMPLETED', 'VERIFIED'];

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireActingUser();

  const member = await prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      role: true,
      ownedSkills: { select: { id: true, key: true, name: true } },
      memberSkills: {
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
      },
    },
  });
  if (!member) notFound();

  const [history, assignments, presented, attended, progressRows] = await Promise.all([
    prisma.assessment.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { ...assessmentSelect, skill: { select: { name: true, key: true } } },
    }),
    prisma.learningAssignment.findMany({
      where: { memberId: member.id, status: 'ACTIVE' },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        targetLevel: true,
        dueDate: true,
        note: true,
        skill: { select: { key: true, name: true } },
      },
    }),
    prisma.session.findMany({
      where: { presenterId: member.id },
      orderBy: { date: 'desc' },
      take: 6,
      select: { id: true, title: true, type: true, date: true, status: true, skill: { select: { name: true } } },
    }),
    prisma.sessionParticipant.count({ where: { memberId: member.id, attended: true } }),
    prisma.checklistProgress.findMany({
      where: { memberId: member.id, status: { in: DONE } },
      select: { item: { select: { skillId: true } } },
    }),
  ]);

  const doneBySkill = new Map<string, number>();
  for (const p of progressRows) {
    doneBySkill.set(p.item.skillId, (doneBySkill.get(p.item.skillId) ?? 0) + 1);
  }

  const primary = member.memberSkills.find((s) => s.isPrimary);

  // Latest verification per skill, so the table can flag a due reassessment.
  const latestVerificationBySkill = new Map<string, (typeof history)[number]>();
  for (const a of history) {
    if (a.type !== 'VERIFICATION') continue;
    if (!latestVerificationBySkill.has(a.skill.key)) latestVerificationBySkill.set(a.skill.key, a);
  }

  return (
    <>
      <PageHeader
        back={{ href: '/members', label: 'Members' }}
        title={member.name}
        subtitle={
          <>
            {member.title ?? 'No title'} &middot; {member.email}
            {primary && <> &middot; primary skill: {primary.skill.name}</>}
            {member.ownedSkills.length > 0 && (
              <> &middot; owns {member.ownedSkills.map((s) => s.name).join(', ')}</>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Skills">
            <table className="w-full">
              <thead className="border-y border-hair bg-wash">
                <tr>
                  <th className="th">Skill</th>
                  <th className="th text-center">Verified</th>
                  <th className="th text-center">Self</th>
                  <th className="th text-center">Target</th>
                  <th className="th w-40">Checklist</th>
                  {me.role === 'ADMIN' && <th className="th">Primary</th>}
                </tr>
              </thead>
              <tbody className="divide-rows">
                {member.memberSkills.map((s) => (
                  <tr key={s.skill.id}>
                    <td className="td">
                      <Link
                        href={`/members/${member.id}/skills/${s.skill.key}`}
                        className="font-medium hover:text-brand"
                      >
                        {s.skill.name}
                      </Link>
                      {s.isPrimary && (
                        <span className="ml-2 chip border-violet-200 bg-violet-50 text-violet-700">
                          Primary
                        </span>
                      )}
                      {isReassessmentDue(
                        latestVerificationBySkill.get(s.skill.key)?.nextAssessmentDate ?? null,
                      ) && (
                        <span
                          className="ml-2 chip border-amber-200 bg-amber-50 text-amber-800"
                          title="The next assessment date set by the last review has passed."
                        >
                          reassess
                        </span>
                      )}
                    </td>
                    <td className="td text-center">
                      <LevelBadge level={s.verifiedLevel} />
                    </td>
                    <td className="td text-center">
                      <LevelBadge
                        level={s.selfLevel}
                        title={
                          s.selfLevel && s.selfLevel > (s.verifiedLevel ?? 0)
                            ? 'Self assessment is above the verified level — awaiting owner review.'
                            : undefined
                        }
                      />
                    </td>
                    <td className="td text-center text-xs text-muted">{levelCode(s.targetLevel)}</td>
                    <td className="td">
                      <Progress
                        done={doneBySkill.get(s.skill.id) ?? 0}
                        total={s.skill._count.checklistItems}
                      />
                    </td>
                    {me.role === 'ADMIN' && (
                      <td className="td">
                        {!s.isPrimary && (
                          <form action={setPrimarySkill}>
                            <input type="hidden" name="memberId" value={member.id} />
                            <input type="hidden" name="skillId" value={s.skill.id} />
                            <button type="submit" className="btn btn-sm">
                              Make primary
                            </button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Assessment history">
            {history.length === 0 ? (
              <Empty>No assessments recorded yet.</Empty>
            ) : (
              <ol className="divide-rows">
                {history.map((a) => (
                  <AssessmentEntry key={a.id} a={a} skillName={a.skill.name} />
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Active assignments">
            {assignments.length === 0 ? (
              <Empty>No active assignments.</Empty>
            ) : (
              <ul className="divide-rows">
                {assignments.map((a) => (
                  <li key={a.id} className="px-5 py-3.5">
                    <Link
                      href={`/members/${member.id}/skills/${a.skill.key}`}
                      className="text-sm font-medium hover:text-brand"
                    >
                      {a.skill.name} &rarr; {levelCode(a.targetLevel)}
                    </Link>
                    <p className="text-xs text-muted">
                      {a.dueDate ? `due ${formatDate(a.dueDate)}` : 'no due date'}
                    </p>
                    {a.note && <p className="mt-1 text-xs text-muted">{a.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Sessions presented">
            {presented.length === 0 ? (
              <Empty>Has not presented a session yet.</Empty>
            ) : (
              <ul className="divide-rows">
                {presented.map((s) => (
                  <li key={s.id} className="px-5 py-3">
                    <Link href={`/sessions/${s.id}`} className="text-sm font-medium hover:text-brand">
                      {s.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {formatDate(s.date)} &middot; {s.skill.name} &middot;{' '}
                      {SESSION_TYPE_LABEL[s.type as SessionType]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-hair px-5 py-3 text-xs text-muted">
              Attended {attended} session{attended === 1 ? '' : 's'}.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
