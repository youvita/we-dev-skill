import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PageHeader, formatDateTime } from '@/components/ui';
import { SessionsBrowser, type SessionRow } from '@/components/sessions-browser';

export default async function SessionsPage() {
  const [skills, sessions] = await Promise.all([
    prisma.skill.findMany({
      where: { archived: false },
      orderBy: { order: 'asc' },
      select: { id: true, key: true, name: true },
    }),
    prisma.session.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        title: true,
        topic: true,
        type: true,
        date: true,
        duration: true,
        status: true,
        skill: { select: { key: true, name: true } },
        presenter: { select: { name: true } },
        _count: { select: { participants: true, materials: true } },
      },
    }),
  ]);

  const rows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    topic: s.topic,
    type: s.type,
    date: formatDateTime(s.date),
    iso: s.date.toISOString(),
    duration: s.duration,
    status: s.status,
    skillKey: s.skill.key,
    skillName: s.skill.name,
    presenterName: s.presenter?.name ?? null,
    participants: s._count.participants,
    materials: s._count.materials,
  }));

  return (
    <>
      <PageHeader
        title="Knowledge Sharing Sessions"
        subtitle="Concept sharing by the skill owner, member sharing after self learning, practical challenges, and reviews."
        meta={<span className="chip chip-plain">{rows.length} sessions</span>}
        action={
          <Link href="/sessions/new" className="btn btn-primary">
            Schedule a session
          </Link>
        }
      />
      <SessionsBrowser sessions={rows} skills={skills} />
    </>
  );
}
