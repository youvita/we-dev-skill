'use client';

import { useRef } from 'react';
import { switchMember } from '@/lib/actions';

export function MemberSwitcher({
  members,
  current,
}: {
  members: { id: string; name: string; role: string }[];
  current: { id: string; name: string; role: string; title: string | null };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const initials = current.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <form ref={formRef} action={switchMember} className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-2xs font-semibold text-brand"
        aria-hidden
      >
        {initials}
      </span>
      <div className="leading-tight">
        <label htmlFor="acting-member" className="block text-2xs text-faint">
          Viewing as
        </label>
        <select
          id="acting-member"
          name="memberId"
          defaultValue={current.id}
          onChange={() => formRef.current?.requestSubmit()}
          className="-ml-1 cursor-pointer rounded border-0 bg-transparent py-0 pl-1 pr-6 text-sm font-medium text-ink focus:ring-2 focus:ring-brand-ring"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.role === 'ADMIN' ? ' (admin)' : ''}
            </option>
          ))}
        </select>
      </div>
      <noscript>
        <button type="submit" className="btn btn-sm">
          Switch
        </button>
      </noscript>
    </form>
  );
}
