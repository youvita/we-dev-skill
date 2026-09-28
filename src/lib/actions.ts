'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { ACTING_COOKIE, requireActingUser } from './session';
import {
  AI_CRITERIA,
  AI_RATINGS,
  ASSESSMENT_METHODS,
  CHECKLIST_STATUSES,
  CONFIDENCE_LEVELS,
  DIMENSIONS,
  DOC_KINDS,
  EVIDENCE_TYPES,
  NOTE_KINDS,
  OWNER_ONLY_CHECKLIST_STATUSES,
  SESSION_STATUSES,
  SESSION_TYPES,
  isLevel,
  slugify,
  suggestedConfidence,
  verifyDenialReason,
  type AiCriterion,
  type AiRating,
  type ChecklistStatus,
  type Dimension,
  type EvidenceType,
} from './domain';
import type { ActionResult } from './types';


function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? '').toString().trim();
}

function num(fd: FormData, key: string): number {
  return Number(str(fd, key));
}

function refreshAll() {
  revalidatePath('/', 'layout');
}

/* ------------------------------------------------------------------ viewing as */

export async function switchMember(formData: FormData): Promise<void> {
  const id = str(formData, 'memberId');
  const member = await prisma.member.findUnique({ where: { id }, select: { id: true } });
  if (member) {
    const store = await cookies();
    store.set(ACTING_COOKIE, member.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  refreshAll();
}

/* ------------------------------------------------------------- assessments §8 */

/** A member records their own level. This never touches the verified level. */
export async function submitSelfAssessment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const skillId = str(formData, 'skillId');
  const level = num(formData, 'level');
  const evidence = str(formData, 'evidence');

  if (!isLevel(level)) return { ok: false, error: 'Pick a level between L0 and L4.' };
  if (memberId !== actor.id && actor.role !== 'ADMIN') {
    return { ok: false, error: 'You can only record a self assessment for yourself.' };
  }

  const link = await prisma.memberSkill.findUnique({
    where: { memberId_skillId: { memberId, skillId } },
  });
  if (!link) return { ok: false, error: 'This member is not tracking that skill yet.' };

  // The member may also rate themselves per dimension, which makes the gap
  // against the owner's review specific rather than a single number.
  const dimensions: { dimension: Dimension; level: number; note: string }[] = [];
  for (const d of DIMENSIONS) {
    const raw = str(formData, `dim_${d}`);
    if (raw === '') continue;
    const value = Number(raw);
    if (!isLevel(value)) return { ok: false, error: `Invalid score for ${d}.` };
    dimensions.push({ dimension: d, level: value, note: '' });
  }

  await prisma.$transaction([
    prisma.assessment.create({
      data: {
        memberId,
        skillId,
        type: 'SELF',
        level,
        evidence,
        method: 'SELF_ASSESSMENT',
        dimensions: { create: dimensions },
      },
    }),
    prisma.memberSkill.update({
      where: { memberId_skillId: { memberId, skillId } },
      data: { selfLevel: level },
    }),
  ]);

  refreshAll();
  return { ok: true, message: 'Self assessment recorded. It now waits for owner verification.' };
}

/**
 * The skill owner (or an admin) records the official verified level, together
 * with the evidence and per-dimension scores that back it. Spec 2 is explicit
 * that a level must rest on evidence and that AI-assisted delivery is not, by
 * itself, proof of skill — so the dimensions and the AI-dependency checks are
 * part of the same write, not an optional afterthought.
 */
export async function submitVerification(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const skillId = str(formData, 'skillId');
  const level = num(formData, 'level');
  const comment = str(formData, 'comment');
  const sessionId = str(formData, 'sessionId') || null;

  if (!isLevel(level)) return { ok: false, error: 'Pick a level between L0 and L4.' };

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { ownerId: true } });
  if (!skill) return { ok: false, error: 'Unknown skill.' };

  const denial = verifyDenialReason({
    actorId: actor.id,
    actorRole: actor.role,
    skillOwnerId: skill.ownerId,
    subjectId: memberId,
  });
  if (denial) return { ok: false, error: denial };

  const link = await prisma.memberSkill.findUnique({
    where: { memberId_skillId: { memberId, skillId } },
  });
  if (!link) return { ok: false, error: 'This member is not tracking that skill yet.' };

  const method = str(formData, 'method');
  if (method && !ASSESSMENT_METHODS.includes(method as never)) {
    return { ok: false, error: 'Unknown assessment method.' };
  }

  const confidence = str(formData, 'confidence');
  if (confidence && !CONFIDENCE_LEVELS.includes(confidence as never)) {
    return { ok: false, error: 'Confidence must be Low, Medium or High.' };
  }

  // Per-dimension scores. A dimension left blank is simply not recorded.
  const dimensions: { dimension: Dimension; level: number; note: string }[] = [];
  for (const d of DIMENSIONS) {
    const raw = str(formData, `dim_${d}`);
    if (raw === '') continue;
    const value = Number(raw);
    if (!isLevel(value)) return { ok: false, error: `Invalid score for ${d}.` };
    dimensions.push({ dimension: d, level: value, note: str(formData, `dimnote_${d}`) });
  }

  // AI-dependency checks.
  const aiChecks: { criterion: AiCriterion; rating: AiRating }[] = [];
  for (const c of AI_CRITERIA) {
    const raw = str(formData, `ai_${c}`) || 'NOT_ASSESSED';
    if (!AI_RATINGS.includes(raw as never)) return { ok: false, error: `Invalid rating for ${c}.` };
    aiChecks.push({ criterion: c, rating: raw as AiRating });
  }

  // Evidence already on file that this assessment cites.
  const evidenceIds = [...new Set(formData.getAll('evidenceIds').map((v) => v.toString()))];
  const cited = evidenceIds.length
    ? await prisma.evidence.findMany({
        where: { id: { in: evidenceIds }, memberId, skillId },
        select: { id: true, type: true },
      })
    : [];
  if (cited.length !== evidenceIds.length) {
    return { ok: false, error: 'Some of the selected evidence does not belong to this member and skill.' };
  }

  // Spec 2, "Important Rule": a level should not rest on one quiz score. The
  // assessor may still proceed, but the recorded confidence is capped at what
  // the evidence actually supports.
  const supported = suggestedConfidence(cited.map((e) => e.type as EvidenceType), level);
  const order = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const finalConfidence =
    confidence && order[confidence as keyof typeof order] <= order[supported]
      ? confidence
      : supported;

  const dueRaw = str(formData, 'nextAssessmentDate');
  const nextAssessmentDate = dueRaw ? new Date(dueRaw) : null;
  if (nextAssessmentDate && Number.isNaN(nextAssessmentDate.getTime())) {
    return { ok: false, error: 'That next-assessment date is not valid.' };
  }

  const assessment = await prisma.$transaction(async (tx) => {
    const created = await tx.assessment.create({
      data: {
        memberId,
        skillId,
        type: 'VERIFICATION',
        level,
        comment,
        reviewerId: actor.id,
        sessionId,
        method: method || (sessionId ? 'SESSION_REVIEW' : 'OWNER_REVIEW'),
        confidence: finalConfidence,
        weakAreas: str(formData, 'weakAreas'),
        recommendedLearning: str(formData, 'recommendedLearning'),
        nextAssessmentDate,
        dimensions: { create: dimensions },
        aiChecks: { create: aiChecks },
        evidenceItems: { connect: evidenceIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });

    await tx.memberSkill.update({
      where: { memberId_skillId: { memberId, skillId } },
      data: { verifiedLevel: level },
    });

    return created;
  });

  void assessment;
  refreshAll();

  const note =
    finalConfidence !== confidence && confidence
      ? ` Confidence was recorded as ${finalConfidence.toLowerCase()} rather than ${confidence.toLowerCase()}, because ${cited.length === 0 ? 'no evidence was cited' : 'the cited evidence does not support more'}.`
      : '';
  return { ok: true, message: `Verified level recorded.${note}` };
}

/* ---------------------------------------------------------------- evidence */

/** Record a piece of evidence for a member in a skill. */
export async function addEvidence(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const skillId = str(formData, 'skillId');
  const type = str(formData, 'type');
  const summary = str(formData, 'summary');

  if (!EVIDENCE_TYPES.includes(type as never)) return { ok: false, error: 'Pick an evidence type.' };
  if (!summary) return { ok: false, error: 'Describe what the evidence was.' };

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { ownerId: true } });
  const allowed = actor.role === 'ADMIN' || skill?.ownerId === actor.id || actor.id === memberId;
  if (!allowed) {
    return { ok: false, error: 'Only the member, the skill owner or an admin can record evidence here.' };
  }

  const occurredRaw = str(formData, 'occurredAt');
  const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date();
  if (Number.isNaN(occurredAt.getTime())) return { ok: false, error: 'That date is not valid.' };

  await prisma.evidence.create({
    data: {
      memberId,
      skillId,
      type,
      summary,
      detail: str(formData, 'detail'),
      url: str(formData, 'url'),
      occurredAt,
      recordedById: actor.id,
      sessionId: str(formData, 'sessionId') || null,
    },
  });

  refreshAll();
  return { ok: true, message: 'Evidence recorded.' };
}

export async function deleteEvidence(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  const id = str(formData, 'id');
  const item = await prisma.evidence.findUnique({
    where: { id },
    select: {
      memberId: true,
      skill: { select: { ownerId: true } },
      _count: { select: { assessments: true } },
    },
  });
  if (!item) return;
  // Evidence cited by an assessment stays put — the history is a record.
  if (item._count.assessments > 0) return;
  const allowed =
    actor.role === 'ADMIN' || item.skill.ownerId === actor.id || item.memberId === actor.id;
  if (!allowed) return;
  await prisma.evidence.delete({ where: { id } });
  refreshAll();
}

export async function setTargetLevel(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const skillId = str(formData, 'skillId');
  const level = num(formData, 'targetLevel');
  if (!isLevel(level)) return { ok: false, error: 'Pick a level between L0 and L4.' };

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { ownerId: true } });
  const allowed = actor.role === 'ADMIN' || actor.id === memberId || skill?.ownerId === actor.id;
  if (!allowed) return { ok: false, error: 'Only the member, the skill owner or an admin can set a target.' };

  await prisma.memberSkill.update({
    where: { memberId_skillId: { memberId, skillId } },
    data: { targetLevel: level },
  });
  refreshAll();
  return { ok: true, message: 'Target level updated.' };
}

/* ------------------------------------------------------------- checklist §7 */

export async function updateChecklistProgress(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const itemId = str(formData, 'itemId');
  const status = str(formData, 'status') as ChecklistStatus;
  const notes = str(formData, 'notes');
  const evidenceUrl = str(formData, 'evidenceUrl');

  if (!CHECKLIST_STATUSES.includes(status)) return;

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { skill: { select: { ownerId: true } } },
  });
  if (!item) return;

  const isOwnerOrAdmin = actor.role === 'ADMIN' || item.skill.ownerId === actor.id;
  if (memberId !== actor.id && !isOwnerOrAdmin) return;
  // Only the owner marks an item Verified — the member cannot sign off their own.
  if (OWNER_ONLY_CHECKLIST_STATUSES.includes(status) && !isOwnerOrAdmin) return;

  await prisma.checklistProgress.upsert({
    where: { memberId_itemId: { memberId, itemId } },
    create: { memberId, itemId, status, notes, evidenceUrl },
    update: { status, notes, evidenceUrl },
  });
  refreshAll();
}

/* -------------------------------------------------------- learning log §11 */

export async function addLearningNote(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const skillId = str(formData, 'skillId');
  const kind = str(formData, 'kind');
  const title = str(formData, 'title');

  if (!title) return;
  if (!NOTE_KINDS.includes(kind as never)) return;
  if (memberId !== actor.id && actor.role !== 'ADMIN') return;

  await prisma.learningNote.create({
    data: { memberId, skillId, kind, title, body: str(formData, 'body'), url: str(formData, 'url') },
  });
  refreshAll();
}

export async function deleteLearningNote(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  const id = str(formData, 'id');
  const note = await prisma.learningNote.findUnique({ where: { id }, select: { memberId: true } });
  if (!note) return;
  if (note.memberId !== actor.id && actor.role !== 'ADMIN') return;
  await prisma.learningNote.delete({ where: { id } });
  refreshAll();
}

/* ------------------------------------------------------- assignments §11 */

export async function upsertAssignment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const skillId = str(formData, 'skillId');
  const targetLevel = num(formData, 'targetLevel');
  const dueRaw = str(formData, 'dueDate');
  const note = str(formData, 'note');

  if (!memberId || !skillId) return { ok: false, error: 'Pick a member and a skill.' };
  if (!isLevel(targetLevel)) return { ok: false, error: 'Pick a target level.' };

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { ownerId: true } });
  if (actor.role !== 'ADMIN' && skill?.ownerId !== actor.id) {
    return { ok: false, error: 'Only the skill owner or an admin can assign learning.' };
  }

  const dueDate = dueRaw ? new Date(dueRaw) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return { ok: false, error: 'That due date is not valid.' };

  await prisma.$transaction([
    prisma.learningAssignment.upsert({
      where: { memberId_skillId: { memberId, skillId } },
      create: { memberId, skillId, targetLevel, dueDate, note, status: 'ACTIVE' },
      update: { targetLevel, dueDate, note, status: 'ACTIVE' },
    }),
    prisma.memberSkill.updateMany({
      where: { memberId, skillId },
      data: { targetLevel },
    }),
  ]);
  refreshAll();
  return { ok: true, message: 'Assignment saved.' };
}

export async function setAssignmentStatus(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  const id = str(formData, 'id');
  const status = str(formData, 'status');
  if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) return;

  const assignment = await prisma.learningAssignment.findUnique({
    where: { id },
    select: { memberId: true, skill: { select: { ownerId: true } } },
  });
  if (!assignment) return;
  const allowed =
    actor.role === 'ADMIN' || assignment.skill.ownerId === actor.id || assignment.memberId === actor.id;
  if (!allowed) return;

  await prisma.learningAssignment.update({ where: { id }, data: { status } });
  refreshAll();
}

/* ------------------------------------------------------------ sessions §9 */

export async function createSession(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireActingUser();
  const title = str(formData, 'title');
  const skillId = str(formData, 'skillId');
  const type = str(formData, 'type');
  const dateRaw = str(formData, 'date');
  const presenterId = str(formData, 'presenterId') || null;
  const participantIds = formData.getAll('participantIds').map((v) => v.toString());

  if (!title) return { ok: false, error: 'Give the session a title.' };
  if (!skillId) return { ok: false, error: 'Pick a skill.' };
  if (!SESSION_TYPES.includes(type as never)) return { ok: false, error: 'Pick a session type.' };
  const date = new Date(dateRaw);
  if (!dateRaw || Number.isNaN(date.getTime())) return { ok: false, error: 'Pick a valid date and time.' };

  const duration = num(formData, 'duration') || 60;

  const created = await prisma.session.create({
    data: {
      title,
      skillId,
      type,
      date,
      presenterId,
      duration,
      topic: str(formData, 'topic'),
      location: str(formData, 'location'),
      description: str(formData, 'description'),
      status: 'PLANNED',
      participants: {
        create: [...new Set(participantIds)].map((memberId) => ({ memberId })),
      },
    },
    select: { id: true },
  });

  refreshAll();
  redirect(`/sessions/${created.id}`);
}

export async function setSessionStatus(formData: FormData): Promise<void> {
  await requireActingUser();
  const id = str(formData, 'id');
  const status = str(formData, 'status');
  if (!SESSION_STATUSES.includes(status as never)) return;
  await prisma.session.update({ where: { id }, data: { status } });
  refreshAll();
}

export async function toggleAttendance(formData: FormData): Promise<void> {
  await requireActingUser();
  const id = str(formData, 'id');
  const row = await prisma.sessionParticipant.findUnique({ where: { id }, select: { attended: true } });
  if (!row) return;
  await prisma.sessionParticipant.update({ where: { id }, data: { attended: !row.attended } });
  refreshAll();
}

export async function addParticipant(formData: FormData): Promise<void> {
  await requireActingUser();
  const sessionId = str(formData, 'sessionId');
  const memberId = str(formData, 'memberId');
  if (!memberId) return;
  await prisma.sessionParticipant.upsert({
    where: { sessionId_memberId: { sessionId, memberId } },
    create: { sessionId, memberId },
    update: {},
  });
  refreshAll();
}

export async function removeParticipant(formData: FormData): Promise<void> {
  await requireActingUser();
  await prisma.sessionParticipant.deleteMany({ where: { id: str(formData, 'id') } });
  refreshAll();
}

export async function addMaterial(formData: FormData): Promise<void> {
  await requireActingUser();
  const sessionId = str(formData, 'sessionId');
  const label = str(formData, 'label');
  if (!label) return;
  await prisma.sessionMaterial.create({ data: { sessionId, label, url: str(formData, 'url') } });
  refreshAll();
}

export async function removeMaterial(formData: FormData): Promise<void> {
  await requireActingUser();
  await prisma.sessionMaterial.deleteMany({ where: { id: str(formData, 'id') } });
  refreshAll();
}

/* -------------------------------------------------------- administration §4 */

export async function createMember(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  if (actor.role !== 'ADMIN') return { ok: false, error: 'Only an admin can add members.' };

  const name = str(formData, 'name');
  const email = str(formData, 'email').toLowerCase();
  const primarySkillId = str(formData, 'primarySkillId');
  if (!name) return { ok: false, error: 'Enter a name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  const clash = await prisma.member.findUnique({ where: { email }, select: { id: true } });
  if (clash) return { ok: false, error: 'A member with that email already exists.' };

  const skills = await prisma.skill.findMany({ where: { archived: false }, select: { id: true } });
  const member = await prisma.member.create({
    data: {
      name,
      email,
      title: str(formData, 'title') || null,
      role: str(formData, 'role') === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      // Everyone tracks every skill: the programme is about breadth, so a new
      // member starts with a row (and an L2 target) in each one.
      memberSkills: {
        create: skills.map((s) => ({
          skillId: s.id,
          isPrimary: s.id === primarySkillId,
          targetLevel: s.id === primarySkillId ? 4 : 2,
        })),
      },
    },
    select: { id: true },
  });

  refreshAll();
  redirect(`/members/${member.id}`);
}

export async function setPrimarySkill(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  const memberId = str(formData, 'memberId');
  const skillId = str(formData, 'skillId');
  if (actor.role !== 'ADMIN') return;

  await prisma.$transaction([
    prisma.memberSkill.updateMany({ where: { memberId }, data: { isPrimary: false } }),
    prisma.memberSkill.updateMany({ where: { memberId, skillId }, data: { isPrimary: true } }),
  ]);
  refreshAll();
}

export async function createSkill(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  if (actor.role !== 'ADMIN') return { ok: false, error: 'Only an admin can add a skill.' };

  const name = str(formData, 'name');
  if (!name) return { ok: false, error: 'Enter a skill name.' };
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!key) return { ok: false, error: 'That name has no usable letters or digits.' };

  const clash = await prisma.skill.findUnique({ where: { key }, select: { id: true } });
  if (clash) return { ok: false, error: 'A skill with that name already exists.' };

  const count = await prisma.skill.count();
  const members = await prisma.member.findMany({ where: { active: true }, select: { id: true } });

  const skill = await prisma.skill.create({
    data: {
      key,
      name,
      description: str(formData, 'description'),
      ownerId: str(formData, 'ownerId') || null,
      order: count,
      memberSkills: { create: members.map((m) => ({ memberId: m.id, targetLevel: 2 })) },
    },
    select: { key: true },
  });

  refreshAll();
  redirect(`/skills/${skill.key}`);
}

export async function setSkillOwner(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  if (actor.role !== 'ADMIN') return;
  const skillId = str(formData, 'skillId');
  const ownerId = str(formData, 'ownerId') || null;
  await prisma.skill.update({ where: { id: skillId }, data: { ownerId } });
  refreshAll();
}

export async function addChecklistItem(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireActingUser();
  const skillId = str(formData, 'skillId');
  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { ownerId: true } });
  if (!skill) return { ok: false, error: 'Unknown skill.' };
  if (actor.role !== 'ADMIN' && skill.ownerId !== actor.id) {
    return { ok: false, error: 'Only the skill owner or an admin can edit the checklist.' };
  }

  const topic = str(formData, 'topic');
  if (!topic) return { ok: false, error: 'Enter a topic.' };
  const requiredLevel = num(formData, 'requiredLevel');
  if (!isLevel(requiredLevel)) return { ok: false, error: 'Pick a required level.' };

  const last = await prisma.checklistItem.findFirst({
    where: { skillId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  await prisma.checklistItem.create({
    data: {
      skillId,
      topic,
      group: str(formData, 'group') || 'General',
      description: str(formData, 'description'),
      requiredLevel,
      order: (last?.order ?? -1) + 1,
    },
  });
  refreshAll();
  return { ok: true, message: 'Checklist item added.' };
}

export async function deleteChecklistItem(formData: FormData): Promise<void> {
  const actor = await requireActingUser();
  const id = str(formData, 'id');
  const item = await prisma.checklistItem.findUnique({
    where: { id },
    select: { skill: { select: { ownerId: true } } },
  });
  if (!item) return;
  if (actor.role !== 'ADMIN' && item.skill.ownerId !== actor.id) return;
  await prisma.checklistItem.delete({ where: { id } });
  refreshAll();
}


/* --------------------------------------------------------------- skill docs */

/** Only the skill's owner (or an admin) writes the guides for that skill. */
async function assertCanEditDocs(skillId: string) {
  const actor = await requireActingUser();
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    select: { ownerId: true },
  });
  if (!skill) return { ok: false as const, error: 'Unknown skill.' };
  if (actor.role !== 'ADMIN' && skill.ownerId !== actor.id) {
    return { ok: false as const, error: 'Only the skill owner or an admin can edit these guides.' };
  }
  return { ok: true as const, actorId: actor.id };
}

export async function createSkillDoc(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const skillId = str(formData, 'skillId');
  const guard = await assertCanEditDocs(skillId);
  if (!guard.ok) return guard;

  const title = str(formData, 'title');
  if (!title) return { ok: false, error: 'Give the guide a title.' };

  const kind = str(formData, 'kind') || 'CONCEPT';
  if (!DOC_KINDS.includes(kind as never)) return { ok: false, error: 'Unknown guide type.' };

  const slug = slugify(title);
  if (!slug) return { ok: false, error: 'That title has no usable letters or digits.' };

  const clash = await prisma.skillDoc.findFirst({
    where: { skillId, slug },
    select: { id: true },
  });
  if (clash) return { ok: false, error: 'A guide with that title already exists for this skill.' };

  const last = await prisma.skillDoc.findFirst({
    where: { skillId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { key: true } });

  await prisma.skillDoc.create({
    data: {
      skillId,
      title,
      slug,
      kind,
      summary: str(formData, 'summary'),
      body: str(formData, 'body'),
      order: (last?.order ?? -1) + 1,
      updatedById: guard.actorId,
    },
  });

  refreshAll();
  redirect(`/skills/${skill!.key}/guides/${slug}?edit=1`);
}

export async function updateSkillDoc(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = str(formData, 'id');
  const doc = await prisma.skillDoc.findUnique({
    where: { id },
    select: { skillId: true, slug: true },
  });
  if (!doc) return { ok: false, error: 'That guide no longer exists.' };

  const guard = await assertCanEditDocs(doc.skillId);
  if (!guard.ok) return guard;

  const title = str(formData, 'title');
  if (!title) return { ok: false, error: 'Give the guide a title.' };

  const kind = str(formData, 'kind') || 'CONCEPT';
  if (!DOC_KINDS.includes(kind as never)) return { ok: false, error: 'Unknown guide type.' };

  await prisma.skillDoc.update({
    where: { id },
    data: {
      title,
      kind,
      summary: str(formData, 'summary'),
      body: str(formData, 'body'),
      updatedById: guard.actorId,
    },
  });

  refreshAll();
  return { ok: true, message: 'Guide saved.' };
}

export async function deleteSkillDoc(formData: FormData): Promise<void> {
  const id = str(formData, 'id');
  const doc = await prisma.skillDoc.findUnique({
    where: { id },
    select: { skillId: true, skill: { select: { key: true } } },
  });
  if (!doc) return;
  const guard = await assertCanEditDocs(doc.skillId);
  if (!guard.ok) return;

  await prisma.skillDoc.delete({ where: { id } });
  refreshAll();
  redirect(`/skills/${doc.skill.key}?tab=guides`);
}
