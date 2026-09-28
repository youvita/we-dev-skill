import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import {
  DIMENSIONS,
  DIMENSION_DEF,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABEL,
  LEVELS,
  LEVEL_DEF,
  NOTE_KINDS,
  NOTE_KIND_LABEL,
  canVerify,
  isReassessmentDue,
  levelCode,
  verifyDenialReason,
  type ChecklistStatus,
  type Level,
  type NoteKind,
} from '@/lib/domain';
import {
  Card,
  Empty,
  LevelBadge,
  PageHeader,
  Progress,
  StatTile,
  Tabs,
  formatDate,
  relativeDate,
} from '@/components/ui';
import { ActionForm, Disclosure, SubmitButton } from '@/components/forms';
import { ChecklistRow, type ChecklistRowData } from '@/components/checklist-row';
import {
  AssessmentEntry,
  ConfidenceChip,
  DimensionBars,
  EvidenceList,
  assessmentSelect,
} from '@/components/assessment-view';
import {
  addEvidence,
  addLearningNote,
  deleteEvidence,
  deleteLearningNote,
  setAssignmentStatus,
  submitSelfAssessment,
  setTargetLevel,
} from '@/lib/actions';

const DONE = ['COMPLETED', 'VERIFIED'];
const TAB_KEYS = ['checklist', 'evidence', 'learning', 'history', 'assess'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; skillKey: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id, skillKey } = await params;
  const { tab: rawTab } = await searchParams;
  const me = await requireActingUser();

  const [member, skill] = await Promise.all([
    prisma.member.findUnique({
      where: { id },
      select: { id: true, name: true, title: true },
    }),
    prisma.skill.findUnique({
      where: { key: skillKey },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        ownerId: true,
        owner: { select: { id: true, name: true } },
        checklistItems: { orderBy: { order: 'asc' } },
      },
    }),
  ]);
  if (!member || !skill) notFound();

  const [link, progress, notes, history, assignment, sessions, evidence] = await Promise.all([
    prisma.memberSkill.findUnique({
      where: { memberId_skillId: { memberId: member.id, skillId: skill.id } },
    }),
    prisma.checklistProgress.findMany({
      where: { memberId: member.id, item: { skillId: skill.id } },
    }),
    prisma.learningNote.findMany({
      where: { memberId: member.id, skillId: skill.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.assessment.findMany({
      where: { memberId: member.id, skillId: skill.id },
      orderBy: { createdAt: 'desc' },
      select: assessmentSelect,
    }),
    prisma.learningAssignment.findUnique({
      where: { memberId_skillId: { memberId: member.id, skillId: skill.id } },
    }),
    prisma.session.findMany({
      where: { skillId: skill.id, participants: { some: { memberId: member.id } } },
      orderBy: { date: 'desc' },
      take: 20,
      select: { id: true, title: true, date: true },
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
  ]);

  if (!link) notFound();

  const progressById = new Map(progress.map((p) => [p.itemId, p]));
  const rows: ChecklistRowData[] = skill.checklistItems.map((item) => {
    const p = progressById.get(item.id);
    return {
      itemId: item.id,
      topic: item.topic,
      description: item.description,
      requiredLevel: item.requiredLevel,
      status: (p?.status ?? 'NOT_STARTED') as ChecklistStatus,
      notes: p?.notes ?? '',
      evidenceUrl: p?.evidenceUrl ?? '',
    };
  });

  const done = rows.filter((r) => DONE.includes(r.status)).length;
  const needsReview = rows.filter((r) => r.status === 'NEEDS_REVIEW').length;

  const isSelf = me.id === member.id;
  const isOwnerOrAdmin = me.role === 'ADMIN' || skill.ownerId === me.id;
  const canEditChecklist = isSelf || isOwnerOrAdmin;
  const canRecordEvidence = isSelf || isOwnerOrAdmin;
  const mayVerify = canVerify({
    actorId: me.id,
    actorRole: me.role,
    skillOwnerId: skill.ownerId,
    subjectId: member.id,
  });
  const verifyDenial = verifyDenialReason({
    actorId: me.id,
    actorRole: me.role,
    skillOwnerId: skill.ownerId,
    subjectId: member.id,
  });

  const groups = rows.reduce<Record<string, ChecklistRowData[]>>((acc, row) => {
    const item = skill.checklistItems.find((i) => i.id === row.itemId)!;
    (acc[item.group] ??= []).push(row);
    return acc;
  }, {});

  const awaitingReview = link.selfLevel != null && link.selfLevel > (link.verifiedLevel ?? -1);
  const latestVerification = history.find((a) => a.type === 'VERIFICATION');
  const latestSelf = history.find((a) => a.type === 'SELF');
  const reassessmentDue = isReassessmentDue(latestVerification?.nextAssessmentDate ?? null);

  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as TabKey)
    : 'checklist';
  const base = `/members/${member.id}/skills/${skill.key}`;

  return (
    <>
      <PageHeader
        back={{ href: `/members/${member.id}`, label: member.name }}
        title={`${member.name} · ${skill.name}`}
        subtitle={skill.description}
        action={
          <>
            <Link href={`/skills/${skill.key}`} className="btn">
              Skill page
            </Link>
            {mayVerify && (
              <Link href={`${base}/assess`} className="btn btn-primary">
                Assess
              </Link>
            )}
          </>
        }
      />

      {/* ---------------------------------------------------------- at a glance */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Verified level"
          value={
            <span className="flex flex-wrap items-center gap-1.5">
              <LevelBadge level={link.verifiedLevel} primary={link.isPrimary} withName />
              {latestVerification && <ConfidenceChip confidence={latestVerification.confidence} />}
            </span>
          }
          hint={
            latestVerification
              ? `Reviewed ${relativeDate(latestVerification.createdAt)} by ${latestVerification.reviewer?.name ?? 'someone since removed'}.`
              : 'Never assessed.'
          }
        />
        <StatTile
          label="Self assessment"
          value={<LevelBadge level={link.selfLevel} withName />}
          tone={awaitingReview ? 'warn' : 'plain'}
          hint={
            link.selfLevel === null
              ? 'Not recorded yet.'
              : awaitingReview
                ? 'Above the verified level — waiting on an owner review.'
                : 'At or below the verified level.'
          }
        />
        <StatTile
          label="Target"
          value={
            <span className="flex items-center gap-1.5">
              <LevelBadge level={link.verifiedLevel} />
              <span aria-hidden className="text-faint">
                &rarr;
              </span>
              <LevelBadge level={link.targetLevel} />
            </span>
          }
          tone={(link.verifiedLevel ?? 0) >= link.targetLevel ? 'ok' : 'plain'}
          hint={
            (link.verifiedLevel ?? 0) >= link.targetLevel
              ? 'Target met.'
              : `${link.targetLevel - (link.verifiedLevel ?? 0)} level(s) to go.`
          }
        />
        <StatTile
          label="Checklist"
          value={
            <span className="block w-full">
              <Progress done={done} total={rows.length} />
            </span>
          }
          tone={needsReview > 0 ? 'warn' : 'plain'}
          hint={
            needsReview > 0
              ? `${needsReview} item${needsReview === 1 ? '' : 's'} flagged for review.`
              : 'Nothing flagged.'
          }
        />
      </div>

      {(reassessmentDue || (assignment && assignment.status === 'ACTIVE')) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {reassessmentDue && (
            <p className="note note-warn">
              Reassessment was due {relativeDate(latestVerification!.nextAssessmentDate!)} (
              {formatDate(latestVerification!.nextAssessmentDate!)}).
            </p>
          )}
          {assignment && assignment.status === 'ACTIVE' && (
            <div className="note note-info flex flex-wrap items-center justify-between gap-2">
              <span>
                Assigned to reach <strong>{levelCode(assignment.targetLevel)}</strong>
                {assignment.dueDate && <> by {formatDate(assignment.dueDate)}</>}
                {assignment.note && <> — {assignment.note}</>}
              </span>
              {(isSelf || isOwnerOrAdmin) && (
                <form action={setAssignmentStatus}>
                  <input type="hidden" name="id" value={assignment.id} />
                  <input type="hidden" name="status" value="COMPLETED" />
                  <SubmitButton className="btn btn-sm">Mark complete</SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- tabs */}
      <Tabs
        current={tab}
        tabs={[
          { key: 'checklist', href: `${base}?tab=checklist`, label: 'Checklist', count: rows.length },
          { key: 'evidence', href: `${base}?tab=evidence`, label: 'Evidence', count: evidence.length },
          { key: 'learning', href: `${base}?tab=learning`, label: 'Learning log', count: notes.length },
          { key: 'history', href: `${base}?tab=history`, label: 'History', count: history.length },
          { key: 'assess', href: `${base}?tab=assess`, label: 'Assessment' },
        ]}
      />

      {/* -------------------------------------------------------- checklist */}
      {tab === 'checklist' && (
        <Card
          title={`Knowledge checklist — ${done} of ${rows.length} done`}
          action={
            <span className="text-xs text-muted">
              {!canEditChecklist
                ? 'Read only'
                : isOwnerOrAdmin && !isSelf
                  ? 'Editing as skill owner'
                  : null}
            </span>
          }
        >
          {rows.length === 0 ? (
            <Empty>
              This skill has no checklist items yet.
              {isOwnerOrAdmin && (
                <>
                  {' '}
                  <Link href={`/skills/${skill.key}`} className="link">
                    Add some on the skill page.
                  </Link>
                </>
              )}
            </Empty>
          ) : (
            <div>
              {Object.entries(groups).map(([group, groupRows]) => (
                <div key={group} className="border-t border-hair first:border-t-0">
                  <h3 className="flex items-center gap-2 bg-wash px-5 py-2">
                    <span className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
                      {group}
                    </span>
                    <span className="text-2xs tabular-nums text-faint">
                      {groupRows.filter((r) => DONE.includes(r.status)).length}/{groupRows.length}
                    </span>
                  </h3>
                  <ul className="divide-rows">
                    {groupRows.map((row) => (
                      <ChecklistRow
                        key={row.itemId}
                        row={row}
                        memberId={member.id}
                        canEdit={canEditChecklist}
                        isOwnerOrAdmin={isOwnerOrAdmin}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* --------------------------------------------------------- evidence */}
      {tab === 'evidence' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card
            title={`Evidence (${evidence.length})`}
            action={
              <span className="text-xs text-muted">
                {evidence.filter((e) => e._count.assessments === 0).length} not yet cited
              </span>
            }
          >
            {evidence.length === 0 ? (
              <Empty>
                Nothing recorded yet. A skill level should be supported by evidence — knowledge
                questions, a code review, a debugging task, a real contribution.
              </Empty>
            ) : (
              <EvidenceList items={evidence} onDelete={canRecordEvidence ? deleteEvidence : undefined} />
            )}
          </Card>

          <aside className="space-y-5">
            {canRecordEvidence ? (
              <Card title="Record evidence">
                <ActionForm action={addEvidence} className="card-body space-y-3.5" resetOnSuccess>
                  <input type="hidden" name="memberId" value={member.id} />
                  <input type="hidden" name="skillId" value={skill.id} />
                  <div>
                    <label className="label" htmlFor="ev-type">
                      Type
                    </label>
                    <select id="ev-type" name="type" className="field" defaultValue="PRACTICAL_TASK">
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {EVIDENCE_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="ev-summary">
                      What happened
                    </label>
                    <input
                      id="ev-summary"
                      name="summary"
                      className="field"
                      placeholder="Debugged a slow report query and explained the fix"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="ev-detail">
                      Detail
                    </label>
                    <textarea
                      id="ev-detail"
                      name="detail"
                      rows={3}
                      className="field"
                      placeholder="What was asked, what they did, what they could and could not explain."
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="ev-date">
                        Date
                      </label>
                      <input id="ev-date" name="occurredAt" type="date" className="field" />
                    </div>
                    <div>
                      <label className="label" htmlFor="ev-url">
                        Link
                      </label>
                      <input id="ev-url" name="url" className="field" placeholder="PR, doc, video" />
                    </div>
                  </div>
                  {sessions.length > 0 && (
                    <div>
                      <label className="label" htmlFor="ev-session">
                        From session
                      </label>
                      <select id="ev-session" name="sessionId" className="field" defaultValue="">
                        <option value="">Not tied to a session</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatDate(s.date)} — {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <SubmitButton>Record evidence</SubmitButton>
                </ActionForm>
              </Card>
            ) : (
              <Card padded>
                <p className="text-sm text-muted">
                  Only {member.name}, the skill owner or an admin can record evidence here.
                </p>
              </Card>
            )}
          </aside>
        </div>
      )}

      {/* --------------------------------------------------------- learning */}
      {tab === 'learning' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title={`Learning log (${notes.length})`}>
            {notes.length === 0 ? (
              <Empty>
                No notes, links, examples or questions yet. This is where self-research gets
                recorded — including the questions to bring to the skill owner.
              </Empty>
            ) : (
              <ul className="divide-rows">
                {notes.map((n) => (
                  <li key={n.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip chip-plain">
                        {NOTE_KIND_LABEL[n.kind as NoteKind] ?? n.kind}
                      </span>
                      <span className="text-sm font-medium text-ink">{n.title}</span>
                      <span className="ml-auto text-2xs text-faint">{formatDate(n.createdAt)}</span>
                      {(isSelf || me.role === 'ADMIN') && (
                        <form action={deleteLearningNote}>
                          <input type="hidden" name="id" value={n.id} />
                          <button
                            type="submit"
                            className="text-xs text-faint transition hover:text-rose-600"
                            title="Delete"
                            aria-label={`Delete ${n.title}`}
                          >
                            &times;
                          </button>
                        </form>
                      )}
                    </div>
                    {n.body && (
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-wash p-3 font-sans text-xs leading-relaxed text-body">
                        {n.body}
                      </pre>
                    )}
                    {n.url && (
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="link mt-1.5 inline-block break-all text-xs"
                      >
                        {n.url}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <aside>
            {isSelf ? (
              <Card title="Add an entry">
                <form action={addLearningNote} className="card-body space-y-3.5">
                  <input type="hidden" name="memberId" value={member.id} />
                  <input type="hidden" name="skillId" value={skill.id} />
                  <div>
                    <label className="label" htmlFor="note-kind">
                      Kind
                    </label>
                    <select id="note-kind" name="kind" className="field" defaultValue="NOTE">
                      {NOTE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {NOTE_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="note-title">
                      Title
                    </label>
                    <input id="note-title" name="title" className="field" required />
                  </div>
                  <div>
                    <label className="label" htmlFor="note-body">
                      Body
                    </label>
                    <textarea
                      id="note-body"
                      name="body"
                      rows={5}
                      className="field"
                      placeholder="Explanation, code example, or a question for the skill owner."
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="note-url">
                      Link
                    </label>
                    <input id="note-url" name="url" className="field" placeholder="https://..." />
                  </div>
                  <SubmitButton>Add entry</SubmitButton>
                </form>
              </Card>
            ) : (
              <Card padded>
                <p className="text-sm text-muted">
                  The learning log belongs to {member.name} — only they can add to it.
                </p>
              </Card>
            )}
          </aside>
        </div>
      )}

      {/* ---------------------------------------------------------- history */}
      {tab === 'history' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title={`Assessment history (${history.length})`}>
            {history.length === 0 ? (
              <Empty>Nothing recorded yet.</Empty>
            ) : (
              <ol className="divide-rows">
                {history.map((a) => (
                  <AssessmentEntry key={a.id} a={a} />
                ))}
              </ol>
            )}
            <p className="border-t border-hair px-5 py-3 text-xs text-muted">
              Append-only — a new assessment never overwrites an old one.
            </p>
          </Card>

          <aside className="space-y-5">
            {latestVerification && latestVerification.dimensions.length > 0 && (
              <Card title="Latest verified dimensions" padded>
                <DimensionBars scores={latestVerification.dimensions} />
                <p className="mt-2.5 text-xs text-muted">
                  From the review on {formatDate(latestVerification.createdAt)}.
                </p>
              </Card>
            )}
            {latestSelf && latestSelf.dimensions.length > 0 && (
              <Card title="Their own dimension view" padded>
                <DimensionBars scores={latestSelf.dimensions} />
              </Card>
            )}
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------- assessment */}
      {tab === 'assess' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Self assessment">
            {isSelf || me.role === 'ADMIN' ? (
              <ActionForm action={submitSelfAssessment} className="card-body space-y-4">
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="skillId" value={skill.id} />
                <fieldset>
                  <legend className="label">Where do you place yourself?</legend>
                  <div className="space-y-1.5">
                    {LEVELS.map((l) => (
                      <label
                        key={l}
                        className={`choice ${l === (link.selfLevel ?? 0) ? '' : ''}`}
                      >
                        <input
                          type="radio"
                          name="level"
                          value={l}
                          defaultChecked={l === (link.selfLevel ?? 0)}
                          className="mt-1"
                        />
                        <span className="text-xs">
                          <strong className="block text-sm text-ink">
                            {LEVEL_DEF[l as Level].code} · {LEVEL_DEF[l as Level].name}
                          </strong>
                          <span className="mt-0.5 block leading-relaxed text-muted">
                            {LEVEL_DEF[l as Level].summary}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Disclosure summary="Rate yourself per dimension (optional)" bare>
                  <div className="space-y-1.5">
                    {DIMENSIONS.map((d) => (
                      <div
                        key={d}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                      >
                        <label
                          htmlFor={`self-dim-${d}`}
                          className="text-xs text-ink"
                          title={DIMENSION_DEF[d].question}
                        >
                          {DIMENSION_DEF[d].label}
                        </label>
                        <select
                          id={`self-dim-${d}`}
                          name={`dim_${d}`}
                          defaultValue=""
                          className="field w-auto py-1 text-xs"
                        >
                          <option value="">—</option>
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {LEVEL_DEF[l as Level].code}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </Disclosure>

                <div>
                  <label className="label" htmlFor="self-evidence">
                    Evidence or explanation
                  </label>
                  <textarea
                    id="self-evidence"
                    name="evidence"
                    rows={3}
                    className="field"
                    placeholder="What you can explain, what you built, what you can demonstrate."
                  />
                </div>
                <p className="hint">
                  This records what you think. It does not change your verified level —
                  {skill.owner ? ` ${skill.owner.name}` : ' the skill owner'} does that after a
                  review.
                </p>
                <SubmitButton>Submit self assessment</SubmitButton>
              </ActionForm>
            ) : (
              <div className="card-body">
                <p className="flex items-center gap-2 text-sm">
                  Current: <LevelBadge level={link.selfLevel} withName />
                </p>
                {latestSelf && latestSelf.dimensions.length > 0 && (
                  <div className="mt-4">
                    <DimensionBars scores={latestSelf.dimensions} />
                  </div>
                )}
                <p className="hint mt-3">Only {member.name} can record their own self assessment.</p>
              </div>
            )}
          </Card>

          <div className="space-y-5">
            <Card title="Owner verification" padded>
              <p className="flex items-center gap-2 text-sm">
                Current: <LevelBadge level={link.verifiedLevel} withName />
                {latestVerification && <ConfidenceChip confidence={latestVerification.confidence} />}
              </p>
              {mayVerify ? (
                <>
                  <p className="hint mt-2.5">
                    Runs through level, dimensions, evidence, independence from AI and the written
                    record, one step at a time.
                  </p>
                  <Link href={`${base}/assess`} className="btn btn-primary mt-3.5">
                    Start an assessment
                  </Link>
                </>
              ) : (
                <>
                  <p className="note note-info mt-3">{verifyDenial}</p>
                  {skill.owner && (
                    <p className="hint mt-2.5">
                      Skill owner:{' '}
                      <Link href={`/members/${skill.owner.id}`} className="link">
                        {skill.owner.name}
                      </Link>
                    </p>
                  )}
                </>
              )}
            </Card>

            <Card title="Target level" padded>
              <ActionForm action={setTargetLevel} className="space-y-3">
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="skillId" value={skill.id} />
                <select
                  key={`target-${link.targetLevel}`}
                  name="targetLevel"
                  className="field"
                  defaultValue={link.targetLevel}
                  aria-label="Target level"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_DEF[l as Level].code} — {LEVEL_DEF[l as Level].name}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn btn-sm">Set target</SubmitButton>
              </ActionForm>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
