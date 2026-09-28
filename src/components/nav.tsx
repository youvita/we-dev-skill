'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/skills', label: 'Skills' },
  { href: '/members', label: 'Members' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/review', label: 'Review' },
];

export function Nav({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="-mb-px flex gap-0.5 overflow-x-auto" aria-label="Main">
      {LINKS.map((l) => {
        // /matrix redirects into the Skills tab, so it still lights up Skills.
        const active =
          l.href === '/'
            ? pathname === '/'
            : pathname.startsWith(l.href) || (l.href === '/skills' && pathname === '/matrix');
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:border-line hover:text-ink'
            }`}
          >
            {l.label}
            {l.href === '/review' && reviewCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-amber-800">
                {reviewCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
