import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { markdownHeaders, skillToMarkdown } from '@/lib/export';

/** Download every guide for a skill as one .md file. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  await requireActingUser();
  const { key } = await params;

  const skill = await prisma.skill.findUnique({
    where: { key },
    select: {
      key: true,
      name: true,
      description: true,
      owner: { select: { name: true } },
      docs: {
        orderBy: { order: 'asc' },
        select: {
          title: true,
          slug: true,
          summary: true,
          body: true,
          kind: true,
          updatedAt: true,
          updatedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!skill) return new Response('Skill not found', { status: 404 });

  return new Response(skillToMarkdown(skill.docs, skill), {
    headers: markdownHeaders(`${skill.key}-guides.md`),
  });
}
