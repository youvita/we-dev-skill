import { prisma } from './db';
import { CHECKLIST_STATUSES } from './domain';

const DONE_STATUSES = ['COMPLETED', 'VERIFIED'];

export type MatrixCell = {
  skillId: string;
  skillKey: string;
  isPrimary: boolean;
  verifiedLevel: number | null;
  selfLevel: number | null;
  targetLevel: number;
  checklistDone: number;
  checklistTotal: number;
  /** Confidence of the latest verification, null when never verified. */
  confidence: string | null;
  /** Evidence items on file for this member and skill. */
  evidenceCount: number;
  reassessmentDue: boolean;
};

export type MatrixRow = {
  memberId: string;
  memberName: string;
  title: string | null;
  cells: Record<string, MatrixCell>;
};

/** Everything the team skill matrix (§6) needs, in three queries. */
export async function getMatrix() {
  const [skills, members, links] = await Promise.all([
    prisma.skill.findMany({
      where: { archived: false },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        owner: { select: { id: true, name: true } },
        _count: { select: { checklistItems: true } },
      },
    }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, title: true },
    }),
    prisma.memberSkill.findMany({
      select: {
        memberId: true,
        skillId: true,
        isPrimary: true,
        targetLevel: true,
        selfLevel: true,
        verifiedLevel: true,
      },
    }),
  ]);

  const [perSkillProgress, verifications, evidenceRows] = await Promise.all([
    prisma.checklistProgress.findMany({
      where: { status: { in: DONE_STATUSES } },
      select: { memberId: true, item: { select: { skillId: true } } },
    }),
    prisma.assessment.findMany({
      where: { type: 'VERIFICATION' },
      orderBy: { createdAt: 'desc' },
      select: { memberId: true, skillId: true, confidence: true, nextAssessmentDate: true },
    }),
    prisma.evidence.groupBy({
      by: ['memberId', 'skillId'],
      _count: { _all: true },
    }),
  ]);

  // Latest verification per member+skill.
  const latest = new Map<string, (typeof verifications)[number]>();
  for (const v of verifications) {
    const key = `${v.memberId}:${v.skillId}`;
    if (!latest.has(key)) latest.set(key, v);
  }

  const evidenceBy = new Map(
    evidenceRows.map((e) => [`${e.memberId}:${e.skillId}`, e._count._all]),
  );

  const now = new Date();

  const doneBy = new Map<string, number>();
  for (const p of perSkillProgress) {
    const key = `${p.memberId}:${p.item.skillId}`;
    doneBy.set(key, (doneBy.get(key) ?? 0) + 1);
  }

  const totals = new Map(skills.map((s) => [s.id, s._count.checklistItems]));

  const rows: MatrixRow[] = members.map((m) => {
    const cells: Record<string, MatrixCell> = {};
    for (const s of skills) {
      const link = links.find((l) => l.memberId === m.id && l.skillId === s.id);
      const key = `${m.id}:${s.id}`;
      const verification = latest.get(key);
      cells[s.id] = {
        skillId: s.id,
        skillKey: s.key,
        isPrimary: link?.isPrimary ?? false,
        verifiedLevel: link?.verifiedLevel ?? null,
        selfLevel: link?.selfLevel ?? null,
        targetLevel: link?.targetLevel ?? 2,
        checklistDone: doneBy.get(key) ?? 0,
        checklistTotal: totals.get(s.id) ?? 0,
        confidence: verification?.confidence ?? null,
        evidenceCount: evidenceBy.get(key) ?? 0,
        reassessmentDue:
          verification?.nextAssessmentDate != null && verification.nextAssessmentDate <= now,
      };
    }
    return { memberId: m.id, memberName: m.name, title: m.title, cells };
  });

  return { skills, rows };
}

/** Checklist completion for one member in one skill. */
export async function getChecklistProgress(memberId: string, skillId: string) {
  const [total, done] = await Promise.all([
    prisma.checklistItem.count({ where: { skillId } }),
    prisma.checklistProgress.count({
      where: { memberId, status: { in: DONE_STATUSES }, item: { skillId } },
    }),
  ]);
  return { total, done };
}

/**
 * What a skill owner needs to look at: a self assessment sitting above the
 * verified level, or a verification whose next-assessment date has passed.
 */
export async function getPendingReviews(ownerId: string, isAdmin: boolean) {
  const skills = await prisma.skill.findMany({
    where: isAdmin ? { archived: false } : { archived: false, ownerId },
    select: { id: true, key: true, name: true, ownerId: true },
  });
  if (skills.length === 0) return [];

  const skillIds = skills.map((s) => s.id);

  const links = await prisma.memberSkill.findMany({
    where: { skillId: { in: skillIds } },
    select: {
      memberId: true,
      skillId: true,
      selfLevel: true,
      verifiedLevel: true,
      targetLevel: true,
      member: { select: { id: true, name: true } },
    },
  });

  // Latest verification per member+skill, for the reassessment-due check.
  const verifications = await prisma.assessment.findMany({
    where: { type: 'VERIFICATION', skillId: { in: skillIds } },
    orderBy: { createdAt: 'desc' },
    select: { memberId: true, skillId: true, nextAssessmentDate: true, createdAt: true },
  });
  const latestVerification = new Map<string, (typeof verifications)[number]>();
  for (const v of verifications) {
    const key = `${v.memberId}:${v.skillId}`;
    if (!latestVerification.has(key)) latestVerification.set(key, v);
  }

  const now = new Date();
  const candidates = links.filter((l) => {
    if (l.member.id === ownerId) return false; // nobody reviews themselves
    const aboveVerified = l.selfLevel != null && l.selfLevel > (l.verifiedLevel ?? -1);
    const next = latestVerification.get(`${l.memberId}:${l.skillId}`)?.nextAssessmentDate;
    const due = next != null && next <= now;
    return aboveVerified || due;
  });

  if (candidates.length === 0) return [];

  const selfAssessments = await prisma.assessment.findMany({
    where: {
      type: 'SELF',
      OR: candidates.map((c) => ({ memberId: c.memberId, skillId: c.skillId })),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      memberId: true,
      skillId: true,
      level: true,
      evidence: true,
      createdAt: true,
      dimensions: { select: { dimension: true, level: true, note: true } },
    },
  });

  return candidates.map((c) => {
    const skill = skills.find((s) => s.id === c.skillId)!;
    const self = selfAssessments.find((a) => a.memberId === c.memberId && a.skillId === c.skillId);
    return {
      member: c.member,
      skill,
      selfLevel: c.selfLevel,
      verifiedLevel: c.verifiedLevel,
      targetLevel: c.targetLevel,
      evidence: self?.evidence ?? '',
      submittedAt: self?.createdAt ?? null,
      selfDimensions: self?.dimensions ?? [],
      nextAssessmentDate:
        latestVerification.get(`${c.memberId}:${c.skillId}`)?.nextAssessmentDate ?? null,
    };
  });
}

export const ALL_STATUSES = CHECKLIST_STATUSES;
