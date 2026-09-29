'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { levelCode } from '@/lib/domain';
import { LevelBadge } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/forms';
import { createMember } from '@/lib/actions';

export type MemberSkillRow = {
  isPrimary: boolean;
  verifiedLevel: number | null;
  selfLevel: number | null;
  targetLevel: number;
  skill: { id: string; key: string; name: string };
};

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: string;
  memberSkills: MemberSkillRow[];
  ownedSkills: { id: string; name: string }[];
};

type View = 'card' | 'list';

export function MembersBrowser({
  members,
  skills,
  isAdmin,
}: {
  members: MemberRow[];
  skills: { id: string; key: string; name: string }[];
  isAdmin: boolean;
}) {
  const [view, setView] = useState<View>('card');
  const [query, setQuery] = useState('');
  const [skillKey, setSkillKey] = useState('');
  const [adding, setAdding] = useState(false);

  // Derived facts shown on each row.
  const rows = useMemo(
    () =>
      members.map((m) => {
        const primary = m.memberSkills.find((s) => s.isPrimary) ?? null;
        const gaps = m.memberSkills.filter((s) => (s.verifiedLevel ?? 0) < s.targetLevel).length;
        const awaiting = m.memberSkills.filter(
          (s) => s.selfLevel != null && s.selfLevel > (s.verifiedLevel ?? -1),
        ).length;
        return { ...m, primary, gaps, awaiting };
      }),
    [members],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((m) => {
        if (q) {
          const hay =
            `${m.name} ${m.email} ${m.title ?? ''} ${m.primary?.skill.name ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (skillKey && m.primary?.skill.key !== skillKey) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, query, skillKey]);

  const filtering = query.trim() !== '' || skillKey !== '';

  const clearAll = () => {
    setQuery('');
    setSkillKey('');
  };

  return (
    <>
      {/* ------------------------------------------------------------ toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[13rem] flex-1">
          <label className="sr-only" htmlFor="member-search">
            Search members
          </label>
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden
          >
            ⌕
          </span>
          <input
            id="member-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field pl-8"
            placeholder="Search by name, email, title or primary skill"
          />
        </div>

        <label className="sr-only" htmlFor="filter-skill">
          Primary skill
        </label>
        <select
          id="filter-skill"
          value={skillKey}
          onChange={(e) => setSkillKey(e.target.value)}
          className="field w-auto"
        >
          <option value="">Any primary skill</option>
          {skills.map((s) => (
            <option key={s.id} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>

        {/* View toggle */}
        <div
          className="flex rounded-lg border border-line bg-surface p-0.5 shadow-sm"
          role="group"
          aria-label="View"
        >
          {(['card', 'list'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                view === v ? 'bg-brand text-white' : 'text-muted hover:bg-hair hover:text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="btn btn-primary"
            aria-expanded={adding}
          >
            {adding ? 'Cancel' : '+ Add member'}
          </button>
        )}
      </div>

      {/* Only worth saying once a filter is narrowing the list. */}
      {filtering && (
        <p className="mb-4 text-xs text-muted">
          {filtered.length} of {members.length}
          {' · '}
          <button type="button" onClick={clearAll} className="link font-medium">
            clear filters
          </button>
        </p>
      )}

      {/* --------------------------------------------------------- add member */}
      {isAdmin && adding && (
        <section className="card mb-5">
          <header className="card-head">
            <h2 className="card-title">Add a member</h2>
          </header>
          <ActionForm action={createMember} className="card-body space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="member-name">
                  Name
                </label>
                <input id="member-name" name="name" className="field" required />
              </div>
              <div>
                <label className="label" htmlFor="member-email">
                  Email
                </label>
                <input id="member-email" name="email" type="email" className="field" required />
              </div>
              <div>
                <label className="label" htmlFor="member-title">
                  Title
                </label>
                <input
                  id="member-title"
                  name="title"
                  className="field"
                  placeholder="e.g. Backend Engineer"
                />
              </div>
              <div>
                <label className="label" htmlFor="member-primary">
                  Primary skill
                </label>
                <select id="member-primary" name="primarySkillId" className="field" defaultValue="">
                  <option value="">None yet</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="member-role">
                  Role
                </label>
                <select id="member-role" name="role" className="field" defaultValue="MEMBER">
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <p className="hint">
              They start tracking every skill with a default target of C in each.
            </p>
            <SubmitButton>Add member</SubmitButton>
          </ActionForm>
        </section>
      )}

      {/* --------------------------------------------------------------- rows */}
      {filtered.length === 0 ? (
        <div className="card px-5 py-12 text-center">
          <p className="text-sm text-muted">No members match those filters.</p>
          <button type="button" onClick={clearAll} className="btn btn-sm mt-3">
            Clear filters
          </button>
        </div>
      ) : view === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <article key={m.id} className="card flex flex-col p-4 transition hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Avatar name={m.name} />
                  <div className="min-w-0">
                    <Link
                      href={`/members/${m.id}`}
                      className="block truncate text-sm font-semibold text-ink transition hover:text-brand"
                    >
                      {m.name}
                    </Link>
                    <p className="truncate text-xs text-muted">{m.title ?? 'No title'}</p>
                    <p className="truncate text-2xs text-faint">{m.email}</p>
                  </div>
                </div>
                {m.role === 'ADMIN' && <span className="chip chip-plain shrink-0">admin</span>}
              </div>

              <ul className="mt-3.5 flex flex-wrap gap-1.5">
                {m.memberSkills.map((s) => (
                  <li key={s.skill.id}>
                    <Link
                      href={`/members/${m.id}/skills/${s.skill.key}`}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs transition hover:border-brand-ring hover:bg-wash"
                      title={`${s.skill.name} — target ${levelCode(s.targetLevel)}`}
                    >
                      <span className="text-muted">{s.skill.name}</span>
                      <LevelBadge level={s.verifiedLevel} primary={s.isPrimary} />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3.5">
                {m.primary && (
                  <span className="chip border-violet-200 bg-violet-50 text-violet-700">
                    {m.primary.skill.name} · primary
                  </span>
                )}
                {m.ownedSkills.length > 0 && (
                  <span className="chip chip-plain">owns {m.ownedSkills.length}</span>
                )}
                {m.awaiting > 0 && (
                  <span className="chip border-amber-200 bg-amber-50 text-amber-800">
                    {m.awaiting} awaiting review
                  </span>
                )}
                <span
                  className={`chip ${
                    m.gaps === 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'chip-plain'
                  }`}
                >
                  {m.gaps === 0 ? 'all targets met' : `${m.gaps} below target`}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[58rem]">
            <thead>
              <tr className="border-b border-hair bg-wash">
                <th className="th">Member</th>
                <th className="th">Primary</th>
                {/* One column per skill: five unlabelled chips in a single cell
                    are unreadable without hovering each one. */}
                {skills.map((s) => (
                  <th key={s.id} className="th text-center">
                    {s.name}
                  </th>
                ))}
                <th className="th text-center">Owns</th>
                <th className="th text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-rows">
              {filtered.map((m) => (
                <tr key={m.id} className="transition hover:bg-wash">
                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} />
                      <div className="min-w-0">
                        <Link
                          href={`/members/${m.id}`}
                          className="block font-medium text-ink transition hover:text-brand"
                        >
                          {m.name}
                          {m.role === 'ADMIN' && (
                            <span className="ml-2 chip chip-plain">admin</span>
                          )}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {m.title ?? 'No title'} · {m.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    {m.primary ? (
                      <span className="chip border-violet-200 bg-violet-50 text-violet-700">
                        {m.primary.skill.name}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">none</span>
                    )}
                  </td>
                  {skills.map((sk) => {
                    const s = m.memberSkills.find((x) => x.skill.id === sk.id);
                    return (
                      <td key={sk.id} className="td text-center">
                        {s ? (
                          <Link
                            href={`/members/${m.id}/skills/${sk.key}`}
                            title={`${sk.name} — verified ${levelCode(
                              s.verifiedLevel,
                            )}, self ${levelCode(s.selfLevel)}, target ${levelCode(s.targetLevel)}`}
                          >
                            <LevelBadge level={s.verifiedLevel} primary={s.isPrimary} />
                          </Link>
                        ) : (
                          <span className="text-xs text-faint">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="td text-center text-xs tabular-nums text-muted">
                    {m.ownedSkills.length || '—'}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap justify-center gap-1">
                      {m.awaiting > 0 && (
                        <span className="chip border-amber-200 bg-amber-50 text-amber-800">
                          {m.awaiting} awaiting
                        </span>
                      )}
                      <span
                        className={`chip ${
                          m.gaps === 0
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'chip-plain'
                        }`}
                      >
                        {m.gaps === 0 ? 'on target' : `${m.gaps} below`}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
      aria-hidden
    >
      {initials}
    </span>
  );
}
