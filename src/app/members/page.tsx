import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { MembersBrowser } from '@/components/members-browser';

export default async function MembersPage() {
  const me = await requireActingUser();

  const [members, skills] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        role: true,
        memberSkills: {
          orderBy: { skill: { order: 'asc' } },
          select: {
            isPrimary: true,
            verifiedLevel: true,
            selfLevel: true,
            targetLevel: true,
            skill: { select: { id: true, key: true, name: true } },
          },
        },
        ownedSkills: { select: { id: true, name: true } },
      },
    }),
    prisma.skill.findMany({
      where: { archived: false },
      orderBy: { order: 'asc' },
      select: { id: true, key: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Everyone tracks every skill. One of them is their primary specialization; the rest are about understanding the full development flow."
        meta={
          <>
            <span className="chip chip-plain">{members.length} active</span>
            <span className="chip chip-plain">
              {members.filter((m) => m.ownedSkills.length > 0).length} skill owners
            </span>
          </>
        }
      />
      {/* Filtering happens in the browser: the team is small enough that an
          instant filter beats a round trip per keystroke. */}
      <MembersBrowser members={members} skills={skills} isAdmin={me.role === 'ADMIN'} />
    </>
  );
}
