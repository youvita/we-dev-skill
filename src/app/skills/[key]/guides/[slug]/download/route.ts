import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { docToMarkdown, markdownHeaders } from '@/lib/export';

/** Download one skill guide as a .md file. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string; slug: string }> },
) {
  await requireActingUser();
  const { key, slug } = await params;

  const skill = await prisma.skill.findUnique({
    where: { key },
    select: { id: true, key: true, name: true, owner: { select: { name: true } } },
  });
  if (!skill) return new Response('Skill not found', { status: 404 });

  const doc = await prisma.skillDoc.findFirst({
    where: { skillId: skill.id, slug },
    select: {
      title: true,
      slug: true,
      summary: true,
      body: true,
      kind: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });
  if (!doc) return new Response('Guide not found', { status: 404 });

  return new Response(docToMarkdown(doc, skill), {
    headers: markdownHeaders(`${skill.key}-${doc.slug}.md`),
  });
}
