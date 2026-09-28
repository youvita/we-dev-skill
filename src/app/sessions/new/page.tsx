import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { SESSION_TYPES, type SessionType } from '@/lib/domain';
import { PageHeader } from '@/components/ui';
import { NewSessionForm } from '@/components/new-session-form';

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; type?: string; presenter?: string }>;
}) {
  const { skill: skillKey, type, presenter } = await searchParams;
  const me = await requireActingUser();

  const [skills, members] = await Promise.all([
    prisma.skill.findMany({
      where: { archived: false },
      orderBy: { order: 'asc' },
      select: { id: true, key: true, name: true, ownerId: true },
    }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const defaultSkill = skills.find((s) => s.key === skillKey) ?? skills[0];
  const defaultType: SessionType = SESSION_TYPES.includes(type as never)
    ? (type as SessionType)
    : 'CONCEPT_SHARING';

  // A concept session is the skill owner's to give; everything else defaults to you.
  const defaultPresenter =
    members.find((m) => m.id === presenter)?.id ??
    (defaultType === 'CONCEPT_SHARING' ? (defaultSkill?.ownerId ?? me.id) : me.id);

  // Default the date to 09:00 a week out, in the local format the input expects.
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(9, 0, 0, 0);
  const defaultDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <>
      <PageHeader
        back={{ href: '/sessions', label: 'Sessions' }}
        title="Schedule a session"
        subtitle="Pick the session type that matches where the team is in the learning cycle."
      />
      <NewSessionForm
        skills={skills}
        members={members}
        defaults={{
          skillId: defaultSkill?.id,
          type: defaultType,
          presenterId: defaultPresenter,
          date: defaultDate,
        }}
      />
    </>
  );
}
