import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CHECKLIST_STATUS_LABEL,
  LEVEL_DEF,
  LEVELS,
  levelCode,
  type ChecklistStatus,
  type Level,
} from '@/lib/domain';

export function Card({
  title,
  action,
  children,
  className = '',
  padded = false,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Wrap children in the standard body padding. Leave off for tables and lists. */
  padded?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {typeof title === 'string' ? <h2 className="card-title">{title}</h2> : title}
          {action}
        </header>
      )}
      {padded ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
  meta,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-2.5 inline-flex items-center gap-1 text-xs font-medium text-muted transition hover:text-ink"
        >
          <span aria-hidden>&larr;</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
    </header>
  );
}

/* --------------------------------------------------------------------- tabs */

export function Tabs({
  tabs,
  current,
}: {
  tabs: { key: string; href: string; label: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="mb-5 overflow-x-auto">
      <nav className="flex gap-1 border-b border-line" aria-label="Sections">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                active
                  ? 'border-brand text-ink'
                  : 'border-transparent text-muted hover:border-line hover:text-ink'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums ${
                    active ? 'bg-brand-soft text-brand' : 'bg-hair text-muted'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------- levels */

const LEVEL_STYLE: Record<number, string> = {
  0: 'border-rose-200 bg-rose-50 text-rose-700',
  1: 'border-slate-200 bg-slate-100 text-slate-700',
  2: 'border-sky-200 bg-sky-50 text-sky-700',
  3: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  4: 'border-violet-200 bg-violet-50 text-violet-700',
};

export function LevelBadge({
  level,
  primary = false,
  title,
  withName = false,
}: {
  level: number | null | undefined;
  primary?: boolean;
  title?: string;
  withName?: boolean;
}) {
  // A null level has never been assessed, which is not the same as grade E.
  if (level === null || level === undefined) {
    return (
      <span className="chip border-dashed border-line text-faint" title={title ?? 'Never assessed'}>
        &ndash;
      </span>
    );
  }
  const def = LEVEL_DEF[level as Level];
  return (
    <span
      className={`chip ${LEVEL_STYLE[level] ?? LEVEL_STYLE[1]} ${
        primary ? 'ring-1 ring-violet-300 ring-offset-1' : ''
      }`}
      title={title ?? `${def.code} (${def.band}) — ${def.name}: ${def.summary}`}
    >
      {def.code}
      {withName && <span className="font-medium opacity-80">{def.name}</span>}
      {primary && (
        <span aria-label="Primary skill" title="Primary skill">
          &#9733;
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------- status chips */

const STATUS_STYLE: Record<ChecklistStatus, string> = {
  NOT_STARTED: 'border-line bg-wash text-faint',
  LEARNING: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border-sky-200 bg-sky-50 text-sky-700',
  NEEDS_REVIEW: 'border-orange-200 bg-orange-50 text-orange-700',
  VERIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function StatusChip({ status }: { status: string }) {
  const s = status as ChecklistStatus;
  return (
    <span className={`chip ${STATUS_STYLE[s] ?? STATUS_STYLE.NOT_STARTED}`}>
      {CHECKLIST_STATUS_LABEL[s] ?? status}
    </span>
  );
}

/* ----------------------------------------------------------------- progress */

export function Progress({
  done,
  total,
  showCount = true,
}: {
  done: number;
  total: number;
  showCount?: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-full min-w-[64px] overflow-hidden rounded-full bg-hair"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-brand'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showCount && (
        <span className="whitespace-nowrap text-2xs font-medium tabular-nums text-muted">
          {done}/{total}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- states */

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm text-muted">{children}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'plain' | 'warn' | 'ok';
}) {
  const ring =
    tone === 'warn'
      ? 'ring-1 ring-amber-200'
      : tone === 'ok'
        ? 'ring-1 ring-emerald-200'
        : '';
  return (
    <div className={`card px-4 py-3.5 ${ring}`}>
      <p className="label mb-2">{label}</p>
      <div className="flex min-h-[26px] items-center">{value}</div>
      {hint && <p className="mt-2 text-xs leading-snug text-muted">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-tight text-ink">{children}</h2>
      {aside}
    </div>
  );
}

export function LevelLegend({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 pb-5">
        {LEVELS.map((l) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-muted">
            <LevelBadge level={l} />
            {LEVEL_DEF[l].name}
          </span>
        ))}
      </div>
    );
  }
  return (
    <dl className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
      {LEVELS.map((l) => (
        <div key={l} className="rounded-lg border border-line p-3.5">
          <dt className="mb-1.5 flex items-center gap-2">
            <LevelBadge level={l} />
            <span className="text-sm font-semibold text-ink">{LEVEL_DEF[l].name}</span>
          </dt>
          <dd className="text-xs leading-relaxed text-muted">
            <p className="mb-1.5">{LEVEL_DEF[l].summary}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {LEVEL_DEF[l].can.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------- dates */

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "in 5 days" / "3 months ago" — friendlier than a bare date for due items. */
export function relativeDate(d: Date | string): string {
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';

  const phrase = (n: number, unit: string) => {
    const plural = `${n} ${unit}${n === 1 ? '' : 's'}`;
    return days > 0 ? `in ${plural}` : `${plural} ago`;
  };

  const abs = Math.abs(days);
  if (abs < 30) return phrase(abs, 'day');
  const months = Math.round(abs / 30);
  if (months < 12) return phrase(months, 'month');
  return phrase(Math.round(abs / 365), 'year');
}

export { levelCode };
