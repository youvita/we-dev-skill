import { cookies } from 'next/headers';
import { prisma } from './db';

export const ACTING_COOKIE = 'acting_member_id';

export type ActingUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
};

/**
 * There is no password auth in this build — the app ships with a "viewing as"
 * switcher so the role rules in src/lib/domain.ts can be exercised. Swap this
 * one function for a real session lookup to put the app behind SSO.
 */
export async function getActingUser(): Promise<ActingUser | null> {
  const store = await cookies();
  const id = store.get(ACTING_COOKIE)?.value;

  if (id) {
    const found = await prisma.member.findFirst({
      where: { id, active: true },
      select: { id: true, name: true, email: true, role: true, title: true },
    });
    if (found) return found;
  }

  // Fall back to the first admin so a fresh browser is never locked out.
  return prisma.member.findFirst({
    where: { active: true, role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, title: true },
  });
}

export async function requireActingUser(): Promise<ActingUser> {
  const user = await getActingUser();
  if (!user) throw new Error('No members exist yet. Run `npm run db:seed`.');
  return user;
}
