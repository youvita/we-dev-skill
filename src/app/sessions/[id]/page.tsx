import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import {
  SESSION_TYPE_HINT,
  SESSION_TYPE_LABEL,
  canVerify,
  type SessionType,
} from '@/lib/domain';
import { Card, Empty, LevelBadge, PageHeader, formatDate, formatDateTime } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { ConfidenceChip } from '@/components/assessment-view';
import {
  addMaterial,
  addParticipant,
  removeMaterial,
  removeParticipant,
  setSessionStatus,
  toggleAttendance,
} from '@/lib/actions';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireActingUser();

  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      topic: true,
      type: true,
      date: true,
      duration: true,
      location: true,
      description: true,
      status: true,
      skill: { select: { id: true, key: true, name: true, ownerId: true, owner: { select: { name: true } } } },
      presenter: { select: { id: true, name: true, title: true } },
      participants: {
        orderBy: { member: { name: 'asc' } },
        select: {
          id: true,
          attended: true,
          member: { select: { id: true, name: true } },
        },
      },
      materials: { select: { id: true, label: true, url: true } },
      assessments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          level: true,
          comment: true,
          confidence: true,
          createdAt: true,
          member: { select: { id: true, name: true } },
          reviewer: { select: { name: true } },
        },
      },
    },
  });
  if (!session) notFound();

  const allMembers = await prisma.member.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  // Each participant's current standing in this session's skill.
  const links = await prisma.memberSkill.findMany({
    where: {
      skillId: session.skill.id,
      memberId: { in: session.participants.map((p) => p.member.id) },
    },
    select: { memberId: true, selfLevel: true, verifiedLevel: true },
  });

  const isOwnerOrAdmin = me.role === 'ADMIN' || session.skill.ownerId === me.id;
  const isPresenter = session.presenter?.id === me.id;
  const canManage = isOwnerOrAdmin || isPresenter;
  const participantIds = new Set(session.participants.map((p) => p.member.id));
  const notYetParticipating = allMembers.filter((m) => !participantIds.has(m.id));

  // Who this reviewer could record a level for out of this session.
  const reviewable = session.participants
    .filter((p) =>
      canVerify({
        actorId: me.id,
        actorRole: me.role,
        skillOwnerId: session.skill.ownerId,
        subjectId: p.member.id,
      }),
    )
    .map((p) => {
      const link = links.find((l) => l.memberId === p.member.id);
      return {
        ...p,
        selfLevel: link?.selfLevel ?? null,
        verifiedLevel: link?.verifiedLevel ?? null,
      };
    });

  return (
    <>
      <PageHeader
        back={{ href: '/sessions', label: 'Sessions' }}
        title={session.title}
        subtitle={
          <>
            {formatDateTime(session.date)} &middot; {session.duration} min &middot;{' '}
            <Link href={`/skills/${session.skill.key}`} className="link">
              {session.skill.name}
            </Link>{' '}
            &middot; {SESSION_TYPE_LABEL[session.type as SessionType]}
            {session.topic && <> &middot; {session.topic}</>}
          </>
        }
        action={
          canManage && (
            <div className="flex gap-2">
              {session.status !== 'COMPLETED' && (
                <form action={setSessionStatus}>
                  <input type="hidden" name="id" value={session.id} />
                  <input type="hidden" name="status" value="COMPLETED" />
                  <SubmitButton className="btn btn-primary">Mark completed</SubmitButton>
                </form>
              )}
              {session.status === 'PLANNED' && (
                <form action={setSessionStatus}>
                  <input type="hidden" name="id" value={session.id} />
                  <input type="hidden" name="status" value="CANCELLED" />
                  <SubmitButton className="btn">Cancel</SubmitButton>
                </form>
              )}
              {session.status !== 'PLANNED' && (
                <form action={setSessionStatus}>
                  <input type="hidden" name="id" value={session.id} />
                  <input type="hidden" name="status" value="PLANNED" />
                  <SubmitButton className="btn">Reopen</SubmitButton>
                </form>
              )}
            </div>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Details"
            action={
              <span
                className={`chip ${
                  session.status === 'COMPLETED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : session.status === 'CANCELLED'
                      ? 'border-line bg-wash text-muted'
                      : 'border-sky-200 bg-sky-50 text-sky-700'
                }`}
              >
                {session.status.toLowerCase()}
              </span>
            }
          >
            <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="label">Presenter</dt>
                <dd>
                  {session.presenter ? (
                    <Link href={`/members/${session.presenter.id}`} className="link">
                      {session.presenter.name}
                    </Link>
                  ) : (
                    <span className="text-muted">Not assigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="label">Location / link</dt>
                <dd>
                  {session.location ? (
                    session.location.startsWith('http') ? (
                      <a href={session.location} target="_blank" rel="noreferrer noopener" className="link break-all">
                        {session.location}
                      </a>
                    ) : (
                      session.location
                    )
                  ) : (
                    <span className="text-muted">Not set</span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="label">Session type</dt>
                <dd>
                  {SESSION_TYPE_LABEL[session.type as SessionType]}
                  <span className="ml-2 text-xs text-muted">
                    {SESSION_TYPE_HINT[session.type as SessionType]}
                  </span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="label">Description</dt>
                <dd className="whitespace-pre-line text-sm">
                  {session.description || <span className="text-muted">No description.</span>}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title={`Participants (${session.participants.length})`}>
            {session.participants.length === 0 ? (
              <Empty>Nobody has been added yet.</Empty>
            ) : (
              <ul className="divide-rows">
                {session.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link href={`/members/${p.member.id}`} className="text-sm hover:text-brand">
                      {p.member.name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span
                        className={`chip ${
                          p.attended
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-line bg-wash text-muted'
                        }`}
                      >
                        {p.attended ? 'attended' : 'not marked'}
                      </span>
                      {canManage && (
                        <>
                          <form action={toggleAttendance}>
                            <input type="hidden" name="id" value={p.id} />
                            <SubmitButton className="btn btn-sm" pendingLabel="...">
                              {p.attended ? 'Unmark' : 'Mark attended'}
                            </SubmitButton>
                          </form>
                          <form action={removeParticipant}>
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="text-xs text-muted hover:text-red-600" title="Remove">
                              &times;
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canManage && notYetParticipating.length > 0 && (
              <form action={addParticipant} className="flex items-center gap-2 border-t border-hair p-4">
                <input type="hidden" name="sessionId" value={session.id} />
                <label className="sr-only" htmlFor="add-participant">Add participant</label>
                <select id="add-participant" name="memberId" className="field w-auto py-1 text-xs">
                  {notYetParticipating.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn btn-sm">Add participant</SubmitButton>
              </form>
            )}
          </Card>

          <Card title="Assessments from this session">
            {session.assessments.length === 0 ? (
              <Empty>No verified levels have been recorded from this session.</Empty>
            ) : (
              <ul className="divide-rows">
                {session.assessments.map((a) => (
                  <li key={a.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/members/${a.member.id}`} className="text-sm font-medium hover:text-brand">
                        {a.member.name}
                      </Link>
                      <LevelBadge level={a.level} />
                      <ConfidenceChip confidence={a.confidence} />
                      <span className="ml-auto text-xs text-muted">
                        {a.reviewer?.name ?? 'reviewer removed'}
                      </span>
                    </div>
                    {a.comment && <p className="mt-1 text-xs text-muted">{a.comment}</p>}
                  </li>
                ))}
              </ul>
            )}

            {reviewable.length > 0 && (
              <div className="border-t border-hair px-5 py-4">
                <p className="label">Assess a participant</p>
                <p className="hint mb-3">
                  Opens the step-by-step assessment, tagged to this session.
                </p>
                <div className="flex flex-wrap gap-2">
                  {reviewable.map((p) => (
                    <Link
                      key={p.id}
                      href={`/members/${p.member.id}/skills/${session.skill.key}/assess?session=${session.id}`}
                      className="btn btn-sm"
                    >
                      {p.member.name}
                      <LevelBadge level={p.verifiedLevel} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Materials">
            {session.materials.length === 0 ? (
              <Empty>No materials attached.</Empty>
            ) : (
              <ul className="divide-rows">
                {session.materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    {m.url ? (
                      <a href={m.url} target="_blank" rel="noreferrer noopener" className="link text-sm">
                        {m.label}
                      </a>
                    ) : (
                      <span className="text-sm">{m.label}</span>
                    )}
                    {canManage && (
                      <form action={removeMaterial}>
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" className="text-xs text-muted hover:text-red-600" title="Remove">
                          &times;
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
              <form action={addMaterial} className="space-y-2 border-t border-hair p-4">
                <input type="hidden" name="sessionId" value={session.id} />
                <div>
                  <label className="label" htmlFor="mat-label">Label</label>
                  <input id="mat-label" name="label" className="field" placeholder="Slides, recording, sample code" required />
                </div>
                <div>
                  <label className="label" htmlFor="mat-url">Link</label>
                  <input id="mat-url" name="url" className="field" placeholder="https://..." />
                </div>
                <SubmitButton className="btn btn-sm">Add material</SubmitButton>
              </form>
            )}
          </Card>

          <Card title="Skill owner">
            <div className="card-body text-sm">
              <p>{session.skill.owner?.name ?? 'Unassigned'}</p>
              <p className="mt-1 text-xs text-muted">
                Owns {session.skill.name} and is the only person who can record a verified level in
                it.
              </p>
              <Link href={`/skills/${session.skill.key}`} className="link mt-2 inline-block text-xs">
                Open the {session.skill.name} checklist
              </Link>
            </div>
          </Card>

          {session.presenter && session.type === 'MEMBER_SHARING' && (
            <Card title="What to listen for">
              <ul className="list-disc space-y-1 p-4 pl-8 text-xs text-muted">
                <li>Can they explain what they understood in their own words?</li>
                <li>What did they actually practise, not just read about?</li>
                <li>Does the example work, and can they change it live?</li>
                <li>Can they answer questions outside the script?</li>
                <li>Do they know how to troubleshoot the common failures?</li>
              </ul>
              <p className="border-t border-hair px-5 py-3 text-xs text-muted">
                AI-generated code does not equal knowledge.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
