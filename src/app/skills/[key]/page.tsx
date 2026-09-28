import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import {
  DOC_KINDS,
  DOC_KIND_HINT,
  DOC_KIND_LABEL,
  LEVELS,
  LEVEL_DEF,
  SESSION_TYPE_LABEL,
  levelCode,
  type DocKind,
  type Level,
  type SessionType,
} from '@/lib/domain';
import {
  Card,
  Empty,
  LevelBadge,
  LevelLegend,
  PageHeader,
  Progress,
  Tabs,
  formatDate,
  relativeDate,
} from '@/components/ui';
import { ActionForm, Disclosure, SubmitButton } from '@/components/forms';
import {
  addChecklistItem,
  createSkillDoc,
  deleteChecklistItem,
  setSkillOwner,
  upsertAssignment,
} from '@/lib/actions';

const DONE = ['COMPLETED', 'VERIFIED'];
const TAB_KEYS = ['guides', 'checklist', 'team', 'sessions'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function SkillPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { key } = await params;
  const { tab: rawTab } = await searchParams;
  const me = await requireActingUser();

  const skill = await prisma.skill.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      ownerId: true,
      owner: { select: { id: true, name: true, title: true } },
      checklistItems: { orderBy: { order: 'asc' } },
      docs: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          kind: true,
          updatedAt: true,
          updatedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!skill) notFound();

  const isOwner = skill.ownerId === me.id;
  const canEdit = isOwner || me.role === 'ADMIN';

  const [links, members, sessions, assignments, progressRows, evidenceRows] = await Promise.all([
    prisma.memberSkill.findMany({
      where: { skillId: skill.id },
      orderBy: { member: { name: 'asc' } },
      select: {
        isPrimary: true,
        targetLevel: true,
        selfLevel: true,
        verifiedLevel: true,
        member: { select: { id: true, name: true, title: true } },
      },
    }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.session.findMany({
      where: { skillId: skill.id },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        status: true,
        presenter: { select: { name: true } },
        _count: { select: { participants: true } },
      },
    }),
    prisma.learningAssignment.findMany({
      where: { skillId: skill.id, status: 'ACTIVE' },
      select: {
        id: true,
        targetLevel: true,
        dueDate: true,
        member: { select: { id: true, name: true } },
      },
    }),
    prisma.checklistProgress.findMany({
      where: { status: { in: DONE }, item: { skillId: skill.id } },
      select: { memberId: true },
    }),
    prisma.evidence.groupBy({
      by: ['memberId'],
      where: { skillId: skill.id },
      _count: { _all: true },
    }),
  ]);

  const doneBy = new Map<string, number>();
  for (const p of progressRows) doneBy.set(p.memberId, (doneBy.get(p.memberId) ?? 0) + 1);
  const evidenceBy = new Map(evidenceRows.map((e) => [e.memberId, e._count._all]));
  const assignmentBy = new Map(assignments.map((a) => [a.member.id, a]));

  const groups = skill.checklistItems.reduce<Record<string, typeof skill.checklistItems>>(
    (acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    },
    {},
  );

  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as TabKey)
    : 'guides';
  const base = `/skills/${skill.key}`;

  return (
    <>
      <PageHeader
        back={{ href: '/skills', label: 'Skills' }}
        title={skill.name}
        subtitle={skill.description}
        meta={
          <>
            <span className="text-xs text-muted">
              Owner:{' '}
              {skill.owner ? (
                <Link href={`/members/${skill.owner.id}`} className="link font-medium">
                  {skill.owner.name}
                </Link>
              ) : (
                <span className="text-faint">unassigned</span>
              )}
            </span>
            <span className="chip chip-plain">{skill.docs.length} guides</span>
            <span className="chip chip-plain">{skill.checklistItems.length} checklist items</span>
            <span className="chip chip-plain">{sessions.length} sessions</span>
          </>
        }
        action={
          <Link href={`/sessions/new?skill=${skill.key}`} className="btn btn-primary">
            Schedule a session
          </Link>
        }
      />

      <Tabs
        current={tab}
        tabs={[
          { key: 'guides', href: `${base}?tab=guides`, label: 'Guides', count: skill.docs.length },
          {
            key: 'checklist',
            href: `${base}?tab=checklist`,
            label: 'Checklist',
            count: skill.checklistItems.length,
          },
          { key: 'team', href: `${base}?tab=team`, label: 'Team', count: links.length },
          { key: 'sessions', href: `${base}?tab=sessions`, label: 'Sessions', count: sessions.length },
        ]}
      />

      {/* ----------------------------------------------------------- guides */}
      {tab === 'guides' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card
            title={`Guides (${skill.docs.length})`}
            action={
              skill.docs.length > 0 && (
                <a href={`${base}/download`} className="btn btn-sm" download>
                  Download all .md
                </a>
              )
            }
          >
            {skill.docs.length === 0 ? (
              <Empty>
                No guides yet. This is where the concepts and the development standards for{' '}
                {skill.name} get written down — the material behind a Concept Sharing session.
              </Empty>
            ) : (
              <ul className="divide-rows">
                {skill.docs.map((d) => (
                  <li key={d.id} className="group relative">
                    <Link
                      href={`${base}/guides/${d.slug}`}
                      className="block px-5 py-3.5 transition hover:bg-wash"
                    >
                      <div className="flex flex-wrap items-center gap-2 pr-24">
                        <span className="text-sm font-semibold text-ink">{d.title}</span>
                        <span className="chip chip-plain">
                          {DOC_KIND_LABEL[d.kind as DocKind] ?? d.kind}
                        </span>
                        <span className="ml-auto text-2xs text-faint">
                          updated {relativeDate(d.updatedAt)}
                        </span>
                      </div>
                      {d.summary && (
                        <p className="mt-1 text-xs leading-relaxed text-muted">{d.summary}</p>
                      )}
                      {d.updatedBy && (
                        <p className="mt-1 text-2xs text-faint">by {d.updatedBy.name}</p>
                      )}
                    </Link>
                    {/* Outside the Link — an anchor cannot nest inside an anchor. */}
                    <a
                      href={`${base}/guides/${d.slug}/download`}
                      download
                      className="absolute right-5 top-3 rounded-md px-2 py-1 text-2xs font-medium text-muted transition hover:bg-hair hover:text-ink"
                      title={`Download ${d.title} as Markdown`}
                    >
                      .md
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <aside className="space-y-5">
            {canEdit ? (
              <Card title="Write a guide">
                <ActionForm action={createSkillDoc} className="card-body space-y-3.5">
                  <input type="hidden" name="skillId" value={skill.id} />
                  <div>
                    <label className="label" htmlFor="doc-new-title">
                      Title
                    </label>
                    <input
                      id="doc-new-title"
                      name="title"
                      className="field"
                      placeholder="e.g. Database Fundamentals"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="doc-new-kind">
                      Type
                    </label>
                    <select id="doc-new-kind" name="kind" className="field" defaultValue="CONCEPT">
                      {DOC_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {DOC_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="doc-new-summary">
                      Summary
                    </label>
                    <input
                      id="doc-new-summary"
                      name="summary"
                      className="field"
                      placeholder="One line for the list."
                    />
                  </div>
                  <SubmitButton>Create and edit</SubmitButton>
                </ActionForm>
                <ul className="space-y-2 border-t border-hair px-5 py-3.5">
                  {DOC_KINDS.map((k) => (
                    <li key={k} className="text-2xs leading-relaxed text-muted">
                      <span className="font-semibold text-ink">{DOC_KIND_LABEL[k]}</span> —{' '}
                      {DOC_KIND_HINT[k]}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Card padded>
                <p className="hint">
                  {skill.owner
                    ? `${skill.owner.name} owns these guides. Ask them if something is missing or out of date.`
                    : 'This skill has no owner yet, so nobody is maintaining its guides.'}
                </p>
              </Card>
            )}
          </aside>
        </div>
      )}

      {/* -------------------------------------------------------- checklist */}
      {tab === 'checklist' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title="Knowledge checklist">
            {skill.checklistItems.length === 0 ? (
              <Empty>No checklist items yet.</Empty>
            ) : (
              <div>
                {Object.entries(groups).map(([group, items]) => (
                  <div key={group} className="border-t border-hair first:border-t-0">
                    <h3 className="bg-wash px-5 py-2 text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
                      {group}
                    </h3>
                    <ul className="divide-rows">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink">{item.topic}</p>
                            {item.description && (
                              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span
                            className="chip chip-plain"
                            title={`Expected from ${levelCode(item.requiredLevel)} upward`}
                          >
                            {levelCode(item.requiredLevel)}+
                          </span>
                          {canEdit && (
                            <form action={deleteChecklistItem}>
                              <input type="hidden" name="id" value={item.id} />
                              <button
                                type="submit"
                                className="text-xs text-faint transition hover:text-rose-600"
                                title="Remove this item"
                                aria-label={`Remove ${item.topic}`}
                              >
                                &times;
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="border-t border-hair">
                <Disclosure summary="Add a checklist item">
                  <ActionForm action={addChecklistItem} className="space-y-3.5" resetOnSuccess>
                    <input type="hidden" name="skillId" value={skill.id} />
                    <div className="grid gap-3.5 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="item-topic">
                          Topic
                        </label>
                        <input id="item-topic" name="topic" className="field" required />
                      </div>
                      <div>
                        <label className="label" htmlFor="item-level">
                          Required level
                        </label>
                        <select id="item-level" name="requiredLevel" className="field" defaultValue="2">
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {levelCode(l)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-3.5 sm:grid-cols-3">
                      <div>
                        <label className="label" htmlFor="item-group">
                          Group
                        </label>
                        <input
                          id="item-group"
                          name="group"
                          className="field"
                          list="existing-groups"
                          placeholder="General"
                        />
                        <datalist id="existing-groups">
                          {Object.keys(groups).map((g) => (
                            <option key={g} value={g} />
                          ))}
                        </datalist>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="item-description">
                          Description
                        </label>
                        <input id="item-description" name="description" className="field" />
                      </div>
                    </div>
                    <SubmitButton>Add item</SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
            )}
          </Card>

          <aside className="space-y-5">
            <Card title="Skill owner" padded>
              {skill.owner ? (
                <>
                  <Link
                    href={`/members/${skill.owner.id}`}
                    className="text-sm font-semibold text-ink transition hover:text-brand"
                  >
                    {skill.owner.name}
                  </Link>
                  {skill.owner.title && <p className="text-xs text-muted">{skill.owner.title}</p>}
                  <p className="hint mt-2.5">
                    Introduces the concepts, reviews other members&rsquo; learning, and is the only
                    person who can record a verified level in {skill.name}.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">No owner assigned.</p>
              )}

              {me.role === 'ADMIN' && (
                <form action={setSkillOwner} className="mt-3.5 flex gap-2">
                  <input type="hidden" name="skillId" value={skill.id} />
                  <label className="sr-only" htmlFor="owner-select">
                    Skill owner
                  </label>
                  <select
                    id="owner-select"
                    name="ownerId"
                    className="field py-1.5 text-xs"
                    defaultValue={skill.ownerId ?? ''}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="btn btn-sm">Set</SubmitButton>
                </form>
              )}
            </Card>

            <Card
              title="Level key"
              action={
                <Link href="/levels" className="text-xs font-medium text-brand hover:underline">
                  Guide &rarr;
                </Link>
              }
            >
              <LevelLegend compact />
            </Card>
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------------- team */}
      {tab === 'team' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title={`Team standing in ${skill.name}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem]">
                <thead>
                  <tr className="border-y border-hair bg-wash">
                    <th className="th">Member</th>
                    <th className="th text-center">Verified</th>
                    <th className="th text-center">Self</th>
                    <th className="th text-center">Target</th>
                    <th className="th w-36">Checklist</th>
                    <th className="th text-center">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-rows">
                  {links.map((l) => {
                    const assignment = assignmentBy.get(l.member.id);
                    return (
                      <tr key={l.member.id} className="transition hover:bg-wash">
                        <td className="td">
                          <Link
                            href={`/members/${l.member.id}/skills/${skill.key}`}
                            className="font-medium text-ink transition hover:text-brand"
                          >
                            {l.member.name}
                          </Link>
                          {l.isPrimary && (
                            <span className="ml-2 chip border-violet-200 bg-violet-50 text-violet-700">
                              Owner
                            </span>
                          )}
                          {assignment && (
                            <span className="ml-2 chip border-brand-ring/50 bg-brand-soft text-brand">
                              assigned {levelCode(assignment.targetLevel)}
                            </span>
                          )}
                        </td>
                        <td className="td text-center">
                          <LevelBadge level={l.verifiedLevel} />
                        </td>
                        <td className="td text-center">
                          <LevelBadge level={l.selfLevel} />
                        </td>
                        <td className="td text-center text-xs text-muted">
                          {levelCode(l.targetLevel)}
                        </td>
                        <td className="td">
                          <Progress
                            done={doneBy.get(l.member.id) ?? 0}
                            total={skill.checklistItems.length}
                          />
                        </td>
                        <td className="td text-center text-xs tabular-nums text-muted">
                          {evidenceBy.get(l.member.id) ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <aside>
            {canEdit ? (
              <Card title="Assign learning">
                <ActionForm action={upsertAssignment} className="card-body space-y-3.5">
                  <input type="hidden" name="skillId" value={skill.id} />
                  <div>
                    <label className="label" htmlFor="assign-member">
                      Member
                    </label>
                    <select id="assign-member" name="memberId" className="field" required>
                      {links
                        .filter((l) => l.member.id !== skill.ownerId)
                        .map((l) => (
                          <option key={l.member.id} value={l.member.id}>
                            {l.member.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="assign-target">
                        Target
                      </label>
                      <select id="assign-target" name="targetLevel" className="field" defaultValue="2">
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {LEVEL_DEF[l as Level].code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="assign-due">
                        Due
                      </label>
                      <input id="assign-due" name="dueDate" type="date" className="field" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="assign-note">
                      Note
                    </label>
                    <textarea id="assign-note" name="note" rows={3} className="field" />
                  </div>
                  <SubmitButton>Assign</SubmitButton>
                </ActionForm>
              </Card>
            ) : (
              <Card padded>
                <p className="text-sm text-muted">
                  Only the skill owner or an admin can assign learning in {skill.name}.
                </p>
              </Card>
            )}
          </aside>
        </div>
      )}

      {/* --------------------------------------------------------- sessions */}
      {tab === 'sessions' && (
        <Card title={`Sessions in ${skill.name}`}>
          {sessions.length === 0 ? (
            <Empty
              action={
                <Link href={`/sessions/new?skill=${skill.key}`} className="btn btn-sm">
                  Schedule the first one
                </Link>
              }
            >
              No sessions yet.
            </Empty>
          ) : (
            <ul className="divide-rows">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 transition hover:bg-wash"
                  >
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-sm font-medium text-ink">{s.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDate(s.date)} · {SESSION_TYPE_LABEL[s.type as SessionType]} ·{' '}
                        {s.presenter?.name ?? 'no presenter'} · {s._count.participants} people
                      </p>
                    </div>
                    <span
                      className={`chip ${
                        s.status === 'COMPLETED'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : s.status === 'CANCELLED'
                            ? 'chip-plain'
                            : 'border-sky-200 bg-sky-50 text-sky-700'
                      }`}
                    >
                      {s.status.toLowerCase()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
