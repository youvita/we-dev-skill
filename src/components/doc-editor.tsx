'use client';

import { useState } from 'react';
import { DOC_KINDS, DOC_KIND_HINT, DOC_KIND_LABEL, type DocKind } from '@/lib/domain';
import { updateSkillDoc } from '@/lib/actions';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Markdown } from '@/components/markdown';

/** Write / Preview editor for one skill guide. */
export function DocEditor({
  doc,
}: {
  doc: { id: string; title: string; summary: string; body: string; kind: string };
}) {
  const [body, setBody] = useState(doc.body);
  const [kind, setKind] = useState(doc.kind);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <ActionForm action={updateSkillDoc} className="card-body space-y-4">
      <input type="hidden" name="id" value={doc.id} />

      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div>
          <label className="label" htmlFor="doc-title">
            Title
          </label>
          <input id="doc-title" name="title" defaultValue={doc.title} className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="doc-kind">
            Type
          </label>
          <select
            id="doc-kind"
            name="kind"
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {DOC_KINDS.map((k) => (
              <option key={k} value={k}>
                {DOC_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="hint -mt-2">{DOC_KIND_HINT[kind as DocKind]}</p>

      <div>
        <label className="label" htmlFor="doc-summary">
          Summary
        </label>
        <input
          id="doc-summary"
          name="summary"
          defaultValue={doc.summary}
          className="field"
          placeholder="One line shown in the guide list."
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="label mb-0">Body</span>
          <div
            className="flex rounded-lg border border-line bg-surface p-0.5"
            role="group"
            aria-label="Editor mode"
          >
            {(['write', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  tab === t ? 'bg-brand text-white' : 'text-muted hover:bg-hair hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* The textarea stays mounted while previewing so the form still submits
            its value and nothing is lost by toggling. */}
        <textarea
          id="doc-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={24}
          hidden={tab !== 'write'}
          className="field font-mono text-xs leading-relaxed"
          placeholder={'# Heading\n\nWrite the concepts, the standards, the examples.\n\n- Markdown works\n- Tables and code blocks too'}
        />

        {tab === 'preview' && (
          <div className="min-h-[24rem] rounded-lg border border-line bg-surface p-4">
            <Markdown>{body}</Markdown>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save guide</SubmitButton>
        <span className="hint">Markdown with tables, code blocks and task lists.</span>
      </div>
    </ActionForm>
  );
}
