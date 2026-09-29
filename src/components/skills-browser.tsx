'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Progress } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/forms';
import { createSkill } from '@/lib/actions';

export type SkillRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  owner: { id: string; name: string } | null;
  guides: number;
  checklistItems: number;
  sessions: number;
  atTarget: number;
  trackedBy: number;
  evidence: number;
};

type View = 'card' | 'list';

export function SkillsBrowser({
  skills,
  members,
  isAdmin,
}: {
  skills: SkillRow[];
  members: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const [view, setView] = useState<View>('card');
  const [query, setQuery] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.description} ${s.owner?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (ownerId === 'none' && s.owner) return false;
      if (ownerId && ownerId !== 'none' && s.owner?.id !== ownerId) return false;
      return true;
    });
  }, [skills, query, ownerId]);

  const filtering = query.trim() !== '' || ownerId !== '';
  const clearAll = () => {
    setQuery('');
    setOwnerId('');
  };

  return (
    <>
      {/* ------------------------------------------------------------ toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[13rem] flex-1">
          <label className="sr-only" htmlFor="skill-search">
            Search skills
          </label>
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden
          >
            ⌕
          </span>
          <input
            id="skill-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field pl-8"
            placeholder="Search by name, description or owner"
          />
        </div>

        <label className="sr-only" htmlFor="filter-owner">
          Owner
        </label>
        <select
          id="filter-owner"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="field w-auto"
        >
          <option value="">Any owner</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value="none">Unassigned</option>
        </select>

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
            {adding ? 'Cancel' : '+ Add skill'}
          </button>
        )}
      </div>

      {filtering && (
        <p className="mb-4 text-xs text-muted">
          {filtered.length} of {skills.length}
          {' · '}
          <button type="button" onClick={clearAll} className="link font-medium">
            clear filters
          </button>
        </p>
      )}

      {/* ---------------------------------------------------------- add skill */}
      {isAdmin && adding && (
        <section className="card mb-5">
          <header className="card-head">
            <h2 className="card-title">Add a skill</h2>
          </header>
          <ActionForm action={createSkill} className="card-body space-y-4" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="skill-name">
                  Name
                </label>
                <input
                  id="skill-name"
                  name="name"
                  className="field"
                  placeholder="e.g. DevOps"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="skill-owner">
                  Skill owner
                </label>
                <select id="skill-owner" name="ownerId" className="field" defaultValue="">
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="skill-description">
                Description
              </label>
              <textarea id="skill-description" name="description" rows={2} className="field" />
            </div>
            <p className="hint">
              Every active member gets a row in the new skill with a default target of C.
            </p>
            <SubmitButton>Add skill</SubmitButton>
          </ActionForm>
        </section>
      )}

      {/* --------------------------------------------------------------- rows */}
      {filtered.length === 0 ? (
        <div className="card px-5 py-12 text-center">
          <p className="text-sm text-muted">
            {skills.length === 0 ? 'No skills yet.' : 'No skills match those filters.'}
          </p>
          {filtering && (
            <button type="button" onClick={clearAll} className="btn btn-sm mt-3">
              Clear filters
            </button>
          )}
        </div>
      ) : view === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/skills/${s.key}`}
              className="card flex flex-col p-4 transition hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">{s.name}</h2>
                {!s.owner && (
                  <span className="chip border-dashed border-line text-faint">no owner</span>
                )}
              </div>
              <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
                {s.description || 'No description yet.'}
              </p>

              <dl className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {s.owner && (
                  <div>
                    <dt className="inline">Owner: </dt>
                    <dd className="inline font-medium text-ink">{s.owner.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline">Guides: </dt>
                  <dd className={`inline tabular-nums ${s.guides === 0 ? 'text-amber-700' : ''}`}>
                    {s.guides}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Checklist: </dt>
                  <dd className="inline tabular-nums">{s.checklistItems}</dd>
                </div>
                <div>
                  <dt className="inline">Sessions: </dt>
                  <dd className="inline tabular-nums">{s.sessions}</dd>
                </div>
              </dl>

              <div className="mt-auto pt-3.5">
                <p className="label mb-1.5">At target</p>
                <Progress done={s.atTarget} total={s.trackedBy} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[48rem]">
            <thead>
              <tr className="border-b border-hair bg-wash">
                <th className="th">Skill</th>
                <th className="th">Owner</th>
                <th className="th text-center">Guides</th>
                <th className="th text-center">Checklist</th>
                <th className="th text-center">Sessions</th>
                <th className="th text-center">Evidence</th>
                <th className="th w-40">At target</th>
              </tr>
            </thead>
            <tbody className="divide-rows">
              {filtered.map((s) => (
                <tr key={s.id} className="transition hover:bg-wash">
                  <td className="td">
                    <Link
                      href={`/skills/${s.key}`}
                      className="font-medium text-ink transition hover:text-brand"
                    >
                      {s.name}
                    </Link>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{s.description}</p>
                    )}
                  </td>
                  <td className="td">
                    {s.owner ? (
                      <Link href={`/members/${s.owner.id}`} className="link text-sm">
                        {s.owner.name}
                      </Link>
                    ) : (
                      <span className="chip border-dashed border-line text-faint">unassigned</span>
                    )}
                  </td>
                  <td
                    className={`td text-center text-xs tabular-nums ${
                      s.guides === 0 ? 'text-amber-700' : 'text-muted'
                    }`}
                  >
                    {s.guides}
                  </td>
                  <td className="td text-center text-xs tabular-nums text-muted">
                    {s.checklistItems}
                  </td>
                  <td className="td text-center text-xs tabular-nums text-muted">{s.sessions}</td>
                  <td className="td text-center text-xs tabular-nums text-muted">{s.evidence}</td>
                  <td className="td">
                    <Progress done={s.atTarget} total={s.trackedBy} />
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
