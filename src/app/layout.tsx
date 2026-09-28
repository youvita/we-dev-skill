import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { prisma } from '@/lib/db';
import { getActingUser } from '@/lib/session';
import { getPendingReviews } from '@/lib/queries';
import { Nav } from '@/components/nav';
import { MemberSwitcher } from '@/components/member-switcher';

export const metadata: Metadata = {
  title: 'Dev Skill Programme',
  description: 'Knowledge sharing and cross-skill development for the development team.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [members, acting] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true },
    }),
    getActingUser(),
  ]);

  const reviewCount = acting ? (await getPendingReviews(acting.id, acting.role === 'ADMIN')).length : 0;

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
            <div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-3 px-5 pt-3">
              <Link href="/" className="group flex items-center gap-2.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-xs font-bold text-white"
                  aria-hidden
                >
                  DS
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold tracking-tight text-ink">
                    Dev Skill Programme
                  </span>
                  <span className="hidden text-2xs text-faint sm:block">
                    knowledge sharing &amp; cross-skill development
                  </span>
                </span>
              </Link>
              {acting && <MemberSwitcher members={members} current={acting} />}
            </div>
            <div className="mx-auto max-w-[78rem] px-5">
              <Nav reviewCount={reviewCount} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-[78rem] flex-1 px-5 py-7">
            {acting ? (
              children
            ) : (
              <div className="card mx-auto max-w-lg p-6 text-sm">
                <p className="font-semibold text-ink">No members found</p>
                <p className="mt-1.5 text-muted">
                  Run <code className="rounded bg-hair px-1.5 py-0.5 text-xs">npm run setup</code> to
                  create the database and seed the team.
                </p>
              </div>
            )}
          </main>

          <footer className="mx-auto w-full max-w-[78rem] px-5 pb-8 pt-2">
            <p className="border-t border-line pt-4 text-xs leading-relaxed text-faint">
              Levels measure whether someone can explain, use, demonstrate and troubleshoot a
              technology — not how much code they produced. There is no ranking here.{' '}
              <Link href="/levels" className="link font-medium">
                Level guide
              </Link>
              .
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
