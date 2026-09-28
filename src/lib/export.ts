import { DOC_KIND_LABEL, type DocKind } from './domain';

export type ExportableDoc = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  kind: string;
  updatedAt: Date;
  updatedBy: { name: string } | null;
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YAML front matter, so a downloaded guide is self-describing in a repo. */
function frontMatter(fields: Record<string, string | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== '')
    // Quote anything that could be misread as YAML.
    .map(([k, v]) => `${k}: ${/[:#]/.test(v!) ? JSON.stringify(v) : v}`);
  return ['---', ...lines, '---'].join('\n');
}

/** One guide as a standalone Markdown file. */
export function docToMarkdown(
  doc: ExportableDoc,
  skill: { name: string; key: string; owner: { name: string } | null },
): string {
  const head = frontMatter({
    skill: skill.name,
    title: doc.title,
    type: DOC_KIND_LABEL[doc.kind as DocKind] ?? doc.kind,
    summary: doc.summary,
    owner: skill.owner?.name,
    updated_by: doc.updatedBy?.name,
    updated: isoDay(doc.updatedAt),
  });
  return `${head}\n\n${doc.body.trim()}\n`;
}

/** Every guide for a skill, concatenated into one file with a contents list. */
export function skillToMarkdown(
  docs: ExportableDoc[],
  skill: { name: string; key: string; description: string; owner: { name: string } | null },
): string {
  const head = frontMatter({
    skill: skill.name,
    description: skill.description,
    owner: skill.owner?.name,
    guides: String(docs.length),
    exported: isoDay(new Date()),
  });

  if (docs.length === 0) {
    return `${head}\n\n# ${skill.name}\n\nNo guides have been written yet.\n`;
  }

  const contents = docs
    .map((d) => `- [${d.title}](#${d.slug}) — ${DOC_KIND_LABEL[d.kind as DocKind] ?? d.kind}`)
    .join('\n');

  const sections = docs
    .map((d) => {
      const meta = [
        DOC_KIND_LABEL[d.kind as DocKind] ?? d.kind,
        d.updatedBy ? `written by ${d.updatedBy.name}` : null,
        `updated ${isoDay(d.updatedAt)}`,
      ]
        .filter(Boolean)
        .join(' · ');

      // A guide body normally opens with its own title as an H1, which would
      // duplicate the heading we just wrote — drop it. Any later H1 is demoted
      // so nothing competes with the guide title in the combined file.
      const body = d.body
        .trim()
        .replace(/^#\s+.*(\r?\n)+/, '')
        .replace(/^# (?!#)/gm, '## ');

      return `<a id="${d.slug}"></a>\n\n# ${d.title}\n\n_${meta}_\n\n${
        d.summary ? `> ${d.summary}\n\n` : ''
      }${body}`;
    })
    .join('\n\n---\n\n');

  return `${head}\n\n# ${skill.name}\n\n${skill.description}\n\n## Contents\n\n${contents}\n\n---\n\n${sections}\n`;
}

/** Response headers that make a browser save the file rather than render it. */
export function markdownHeaders(filename: string): HeadersInit {
  return {
    'Content-Type': 'text/markdown; charset=utf-8',
    // Quote the filename and strip anything that could break the header.
    'Content-Disposition': `attachment; filename="${filename.replace(/["\\\r\n]/g, '')}"`,
    'Cache-Control': 'no-store',
  };
}
