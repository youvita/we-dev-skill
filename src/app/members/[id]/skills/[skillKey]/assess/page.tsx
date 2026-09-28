import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { canVerify, levelCode, verifyDenialReason } from '@/lib/domain';
import { Card, LevelBadge, PageHeader, Progress, formatDate } from '@/components/ui';
import { AssessWizard, type EvidenceOption } from '@/components/assess-wizard';
import { DimensionBars, EvidenceList } from '@/components/assessment-view';

const DONE = ['COMPLETED', 'VERIFIED'];

export default async function AssessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; skillKey: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id, skillKey } = await params;
  const { session: sessionId } = await searchParams;
  const me = await requireActingUser();

  const [member, skill] = await Promise.all([
    prisma.member.findUnique({ where: { id }, select: { id: true, name: true, title: true } }),
    prisma.skill.findUnique({
      where: { key: skillKey },
      select: {
        id: true,
        key: true,
        name: true,
        ownerId: true,
        owner: { select: { id: true, name: true } },
        _count: { select: { checklistItems: true } },
      },
    }),
  ]);
  if (!member || !skill) notFound();

  const backHref = `/members/${member.id}/skills/${skill.key}`;

  const denial = verifyDenialReason({
    actorId: me.id,
    actorRole: me.role,
    skillOwnerId: skill.ownerId,
    subjectId: member.id,
  });

  if (denial) {
    return (
      <>
        <PageHeader
          back={{ href: backHref, label: `${member.name} — ${skill.name}` }}
          title="Assessment not available"
        />
        <Card className="mx-auto max-w-lg" padded>
          <p className="note note-bad">{denial}</p>
          {skill.owner && (
            <p className="mt-3 text-sm text-muted">
              Skill owner:{' '}
              <Link href={`/members/${skill.owner.id}`} className="link">
                {skill.owner.name}
              </Link>
            </p>
          )}
        </Card>
      </>
    );
  }

  const [link, evidence, lastSelf, lastVerification, sessions, checklistDone] = await Promise.all([
    prisma.memberSkill.findUnique({
      where: { memberId_skillId: { memberId: member.id, skillId: skill.id } },
    }),
    prisma.evidence.findMany({
      where: { memberId: member.id, skillId: skill.id },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        type: true,
        summary: true,
        detail: true,
        url: true,
        occurredAt: true,
        recordedBy: { select: { name: true } },
        session: { select: { id: true, title: true } },
        _count: { select: { assessments: true } },
      },
    }),
    prisma.assessment.findFirst({
      where: { memberId: member.id, skillId: skill.id, type: 'SELF' },
      orderBy: { createdAt: 'desc' },
      select: {
        level: true,
        evidence: true,
        createdAt: true,
        dimensions: { select: { dimension: true, level: true, note: true } },
      },
    }),
    prisma.assessment.findFirst({
      where: { memberId: member.id, skillId: skill.id, type: 'VERIFICATION' },
      orderBy: { createdAt: 'desc' },
      select: {
        level: true,
        comment: true,
        weakAreas: true,
        recommendedLearning: true,
        createdAt: true,
        reviewer: { select: { name: true } },
      },
    }),
    prisma.session.findMany({
      where: { skillId: skill.id, participants: { some: { memberId: member.id } } },
      orderBy: { date: 'desc' },
      take: 20,
      select: { id: true, title: true, date: true },
    }),
    prisma.checklistProgress.count({
      where: { memberId: member.id, status: { in: DONE }, item: { skillId: skill.id } },
    }),
  ]);

  if (!link) notFound();

  const options: EvidenceOption[] = evidence.map((e) => ({
    id: e.id,
    type: e.type,
    summary: e.summary,
    occurredAt: formatDate(e.occurredAt),
    citedCount: e._count.assessments,
  }));

  const activeSession = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;

  return (
    <>
      <PageHeader
        back={{ href: backHref, label: `${member.name} — ${skill.name}` }}
        title={`Assess ${member.name}`}
        subtitle={
          activeSession
            ? `${skill.name}, from the session “${activeSession.title}”.`
            : `${skill.name}. Everything recorded here becomes a permanent entry in their history.`
        }
        meta={
          <>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              verified <LevelBadge level={link.verifiedLevel} />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              self <LevelBadge level={link.selfLevel} />
            </span>
            <span className="text-xs text-muted">target {levelCode(link.targetLevel)}</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <AssessWizard
            memberId={member.id}
            memberName={member.name}
            skillId={skill.id}
            skillName={skill.name}
            currentVerified={link.verifiedLevel}
            selfLevel={link.selfLevel}
            selfDimensions={lastSelf?.dimensions ?? []}
            evidence={options}
            sessions={sessions.map((s) => ({
              id: s.id,
              title: s.title,
              date: formatDate(s.date),
            }))}
            sessionId={activeSession?.id}
            onDoneHref={backHref}
          />
        </Card>

        <aside className="space-y-5">
          <Card title="What they claim" padded>
            {lastSelf ? (
              <>
                <p className="mb-3 flex items-center gap-2 text-sm">
                  <LevelBadge level={lastSelf.level} withName />
                  <span className="text-xs text-muted">{formatDate(lastSelf.createdAt)}</span>
                </p>
                {lastSelf.evidence && (
                  <p className="mb-3 whitespace-pre-line rounded-lg bg-wash p-3 text-xs leading-relaxed">
                    {lastSelf.evidence}
                  </p>
                )}
                {lastSelf.dimensions.length > 0 && <DimensionBars scores={lastSelf.dimensions} />}
              </>
            ) : (
              <p className="text-sm text-muted">No self assessment on file.</p>
            )}
          </Card>

          {lastVerification && (
            <Card title="Last review" padded>
              <p className="mb-2 flex items-center gap-2 text-sm">
                <LevelBadge level={lastVerification.level} withName />
                <span className="text-xs text-muted">
                  {formatDate(lastVerification.createdAt)}
                </span>
              </p>
              {lastVerification.comment && (
                <p className="text-xs leading-relaxed text-muted">{lastVerification.comment}</p>
              )}
              {lastVerification.recommendedLearning && (
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  <span className="font-medium text-ink">Was told to:</span>{' '}
                  {lastVerification.recommendedLearning}
                </p>
              )}
            </Card>
          )}

          <Card title="Checklist" padded>
            <Progress done={checklistDone} total={skill._count.checklistItems} />
            <Link href={backHref} className="link mt-2.5 inline-block text-xs">
              Open the full checklist
            </Link>
          </Card>

          <Card title="Not sure what a level means?" padded>
            <Link href="/levels" className="btn btn-sm">
              Open the level guide
            </Link>
          </Card>

          <Card title={`Evidence on file (${evidence.length})`}>
            <EvidenceList items={evidence.slice(0, 4)} />
            {evidence.length > 4 && (
              <p className="px-5 pb-4 text-xs text-muted">
                +{evidence.length - 4} more, all selectable in step 3.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
