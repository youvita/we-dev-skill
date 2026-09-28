import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireActingUser } from '@/lib/session';
import { DOC_KIND_LABEL, type DocKind } from '@/lib/domain';
import { Card, PageHeader, formatDate, relativeDate } from '@/components/ui';
import { Markdown } from '@/components/markdown';
import { DocEditor } from '@/components/doc-editor';
import { deleteSkillDoc } from '@/lib/actions';

export default async function SkillDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { key, slug } = await params;
  const { edit } = await searchParams;
  const me = await requireActingUser();

  const skill = await prisma.skill.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      name: true,
      ownerId: true,
      owner: { select: { id: true, name: true } },
      docs: { orderBy: { order: 'asc' }, select: { id: true, slug: true, title: true, kind: true } },
    },
  });
  if (!skill) notFound();

  const doc = await prisma.skillDoc.findFirst({
    where: { skillId: skill.id, slug },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      body: true,
      kind: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });
  if (!doc) notFound();

  const canEdit = me.role === 'ADMIN' || skill.ownerId === me.id;
  const editing = canEdit && edit === '1';
  const base = `/skills/${skill.key}/guides/${doc.slug}`;

  return (
    <>
      <PageHeader
        back={{ href: `/skills/${skill.key}?tab=guides`, label: `${skill.name} guides` }}
        title={doc.title}
        subtitle={doc.summary}
        meta={
          <>
            <span className="chip chip-plain">{DOC_KIND_LABEL[doc.kind as DocKind] ?? doc.kind}</span>
            <span className="text-xs text-muted">
              Updated {relativeDate(doc.updatedAt)} ({formatDate(doc.updatedAt)})
              {doc.updatedBy && <> by {doc.updatedBy.name}</>}
            </span>
          </>
        }
        action={
          <>
            {/* A plain <a>: this is a file download, not a client-side route. */}
            <a href={`${base}/download`} className="btn" download>
              Download .md
            </a>
            {canEdit && (
              <>
                {editing ? (
                  <Link href={base} className="btn">
                    Done editing
                  </Link>
                ) : (
                  <Link href={`${base}?edit=1`} className="btn btn-primary">
                    Edit
                  </Link>
                )}
                <form action={deleteSkillDoc}>
                  <input type="hidden" name="id" value={doc.id} />
                  <button type="submit" className="btn text-rose-600 hover:border-rose-300">
                    Delete
                  </button>
                </form>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Card>
          {editing ? <DocEditor doc={doc} /> : <div className="card-body pt-1"><Markdown>{doc.body}</Markdown></div>}
        </Card>

        <aside className="space-y-5">
          <Card title={`${skill.name} guides`}>
            <ul className="divide-rows">
              {skill.docs.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/skills/${skill.key}/guides/${d.slug}`}
                    aria-current={d.slug === doc.slug ? 'page' : undefined}
                    className={`block px-5 py-2.5 text-sm transition hover:bg-wash ${
                      d.slug === doc.slug ? 'bg-brand-soft font-medium text-ink' : 'text-muted'
                    }`}
                  >
                    {d.title}
                    <span className="mt-0.5 block text-2xs text-faint">
                      {DOC_KIND_LABEL[d.kind as DocKind] ?? d.kind}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-hair px-5 py-3">
              <Link href={`/skills/${skill.key}`} className="link text-xs">
                Back to {skill.name}
              </Link>
            </div>
          </Card>

          {!canEdit && skill.owner && (
            <Card padded>
              <p className="hint">
                Written and maintained by{' '}
                <Link href={`/members/${skill.owner.id}`} className="link font-medium">
                  {skill.owner.name}
                </Link>
                , the {skill.name} owner.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
