import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { PageHeader, Tabs } from '@/components/ui';
import { SkillsBrowser, type SkillRow } from '@/components/skills-browser';
import { MatrixView } from '@/components/matrix-view';

const TAB_KEYS = ['areas', 'team'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const { tab: rawTab, view } = await searchParams;
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as TabKey)
    : 'areas';
  const me = await requireActingUser();

  const [skills, members, evidenceRows] = await Promise.all([
    prisma.skill.findMany({
      where: { archived: false },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        owner: { select: { id: true, name: true } },
        _count: { select: { docs: true, checklistItems: true, sessions: true } },
        memberSkills: { select: { verifiedLevel: true, targetLevel: true } },
      },
    }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.evidence.groupBy({ by: ['skillId'], _count: { _all: true } }),
  ]);

  const evidenceBy = new Map(evidenceRows.map((e) => [e.skillId, e._count._all]));

  const rows: SkillRow[] = skills.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    description: s.description,
    owner: s.owner,
    guides: s._count.docs,
    checklistItems: s._count.checklistItems,
    sessions: s._count.sessions,
    // "At target" is the honest health signal for a skill: how many of the
    // people tracking it have actually reached the level they are aiming for.
    atTarget: s.memberSkills.filter((l) => (l.verifiedLevel ?? 0) >= l.targetLevel).length,
    trackedBy: s.memberSkills.length,
    evidence: evidenceBy.get(s.id) ?? 0,
  }));

  const unowned = rows.filter((s) => !s.owner).length;

  return (
    <>
      <PageHeader
        title="Skills"
        subtitle={
          tab === 'team'
            ? "Where the team's knowledge sits today, and where the gaps are. This is not a ranking — it exists to show what to teach next."
            : 'The knowledge itself: the concepts and development standards for each area, written and owned by its skill owner, plus the checklist people learn against.'
        }
        meta={
          <>
            <span className="chip chip-plain">{rows.length} skills</span>
            {unowned > 0 && (
              <span className="chip border-amber-200 bg-amber-50 text-amber-800">
                {unowned} without an owner
              </span>
            )}
          </>
        }
      />

      <Tabs
        current={tab}
        tabs={[
          { key: 'areas', href: '/skills', label: 'Skill areas', count: rows.length },
          { key: 'team', href: '/skills?tab=team', label: 'Team skills' },
        ]}
      />

      {tab === 'team' ? (
        <MatrixView rawView={view} />
      ) : (
        <SkillsBrowser skills={rows} members={members} isAdmin={me.role === 'ADMIN'} />
      )}
    </>
  );
}
