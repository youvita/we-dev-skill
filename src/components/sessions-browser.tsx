'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  SESSION_TYPES,
  SESSION_TYPE_HINT,
  SESSION_TYPE_LABEL,
  type SessionType,
} from '@/lib/domain';
import { Card, Empty } from '@/components/ui';

export type SessionRow = {
  id: string;
  title: string;
  topic: string;
  type: string;
  date: string; // pre-formatted for display
  iso: string; // for the upcoming/past split
  duration: number;
  status: string;
  skillKey: string;
  skillName: string;
  presenterName: string | null;
  participants: number;
  materials: number;
};

export function SessionsBrowser({
  sessions,
  skills,
}: {
  sessions: SessionRow[];
  skills: { id: string; key: string; name: string }[];
}) {
  const [skillKey, setSkillKey] = useState('');
  const [type, setType] = useState('');

  const filtered = useMemo(
    () =>
      sessions.filter((s) => {
        if (skillKey && s.skillKey !== skillKey) return false;
        if (type && s.type !== type) return false;
        return true;
      }),
    [sessions, skillKey, type],
  );

  const now = Date.now();
  const upcoming = filtered
    .filter((s) => s.status === 'PLANNED' && new Date(s.iso).getTime() >= now)
    .reverse();
  const past = filtered.filter(
    (s) => !(s.status === 'PLANNED' && new Date(s.iso).getTime() >= now),
  );

  const filtering = skillKey !== '' || type !== '';
  const clearAll = () => {
    setSkillKey('');
    setType('');
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <label className="sr-only" htmlFor="filter-skill">
          Skill
        </label>
        <select
          id="filter-skill"
          value={skillKey}
          onChange={(e) => setSkillKey(e.target.value)}
          className="field w-auto"
        >
          <option value="">Any skill</option>
          {skills.map((s) => (
            <option key={s.id} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="filter-type">
          Session type
        </label>
        <select
          id="filter-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="field w-auto"
        >
          <option value="">Any type</option>
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t}>
              {SESSION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>

        {type && <span className="hint">{SESSION_TYPE_HINT[type as SessionType]}</span>}
      </div>

      {filtering && (
        <p className="mb-4 text-xs text-muted">
          {filtered.length} of {sessions.length}
          {' · '}
          <button type="button" onClick={clearAll} className="link font-medium">
            clear filters
          </button>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Upcoming (${upcoming.length})`}>
          {upcoming.length === 0 ? (
            <Empty
              action={
                <Link href="/sessions/new" className="btn btn-sm">
                  Schedule one
                </Link>
              }
            >
              Nothing scheduled{filtering ? ' that matches those filters' : ''}.
            </Empty>
          ) : (
            <SessionList sessions={upcoming} />
          )}
        </Card>
        <Card title={`Past and closed (${past.length})`}>
          {past.length === 0 ? (
            <Empty>No past sessions{filtering ? ' that match those filters' : ''}.</Empty>
          ) : (
            <SessionList sessions={past} />
          )}
        </Card>
      </div>
    </>
  );
}

function SessionList({ sessions }: { sessions: SessionRow[] }) {
  return (
    <ul className="divide-rows">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link href={`/sessions/${s.id}`} className="block px-5 py-3.5 transition hover:bg-wash">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-sm font-medium text-ink">{s.title}</span>
              <span
                className={`chip ${
                  s.status === 'COMPLETED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : s.status === 'CANCELLED'
                      ? 'chip-plain line-through'
                      : 'border-sky-200 bg-sky-50 text-sky-700'
                }`}
              >
                {s.status.toLowerCase()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {s.date} · {s.duration} min · {s.skillName} ·{' '}
              {SESSION_TYPE_LABEL[s.type as SessionType]}
            </p>
            <p className="text-2xs text-faint">
              {s.presenterName ?? 'no presenter'} · {s.participants} participants
              {s.materials > 0 && <> · {s.materials} materials</>}
            </p>
            {s.topic && <p className="mt-1 text-xs text-muted">Topic: {s.topic}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
