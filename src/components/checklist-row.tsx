'use client';

import { useRef, useState } from 'react';
import {
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_LABEL,
  OWNER_ONLY_CHECKLIST_STATUSES,
  levelCode,
  type ChecklistStatus,
} from '@/lib/domain';
import { updateChecklistProgress } from '@/lib/actions';
import { StatusChip } from '@/components/ui';
import { SubmitButton } from '@/components/forms';

export type ChecklistRowData = {
  itemId: string;
  topic: string;
  description: string;
  requiredLevel: number;
  status: ChecklistStatus;
  notes: string;
  evidenceUrl: string;
};

const DOT: Record<ChecklistStatus, string> = {
  NOT_STARTED: 'bg-line',
  LEARNING: 'bg-amber-400',
  COMPLETED: 'bg-sky-500',
  NEEDS_REVIEW: 'bg-orange-500',
  VERIFIED: 'bg-emerald-500',
};

export function ChecklistRow({
  row,
  memberId,
  canEdit,
  isOwnerOrAdmin,
}: {
  row: ChecklistRowData;
  memberId: string;
  canEdit: boolean;
  isOwnerOrAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const statusForm = useRef<HTMLFormElement>(null);
  const hasDetail = !!row.notes || !!row.evidenceUrl;

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${DOT[row.status]}`}
          title={CHECKLIST_STATUS_LABEL[row.status]}
          aria-hidden
        />

        <div className="min-w-[12rem] flex-1">
          <p className="text-sm font-medium text-ink">{row.topic}</p>
          {row.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{row.description}</p>
          )}
        </div>

        <span
          className="chip chip-plain"
          title={`Expected from ${levelCode(row.requiredLevel)} upward`}
        >
          {levelCode(row.requiredLevel)}+
        </span>

        {canEdit ? (
          /* Changing the select saves immediately — no second click for the
             most frequent action in the app. */
          <form ref={statusForm} action={updateChecklistProgress} className="contents">
            <input type="hidden" name="memberId" value={memberId} />
            <input type="hidden" name="itemId" value={row.itemId} />
            <input type="hidden" name="notes" value={row.notes} />
            <input type="hidden" name="evidenceUrl" value={row.evidenceUrl} />
            <label className="sr-only" htmlFor={`status-${row.itemId}`}>
              Status for {row.topic}
            </label>
            {/* Keyed on the persisted status so the revalidated render remounts
                the select — otherwise React keeps the stale defaultValue and the
                row appears to snap back even though the save succeeded. */}
            <select
              key={row.status}
              id={`status-${row.itemId}`}
              name="status"
              defaultValue={row.status}
              onChange={() => statusForm.current?.requestSubmit()}
              className="field w-auto py-1 text-xs"
            >
              {CHECKLIST_STATUSES.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={OWNER_ONLY_CHECKLIST_STATUSES.includes(s) && !isOwnerOrAdmin}
                >
                  {CHECKLIST_STATUS_LABEL[s]}
                  {OWNER_ONLY_CHECKLIST_STATUSES.includes(s) && !isOwnerOrAdmin
                    ? ' (owner only)'
                    : ''}
                </option>
              ))}
            </select>
            <noscript>
              <button type="submit" className="btn btn-sm">
                Save
              </button>
            </noscript>
          </form>
        ) : (
          <StatusChip status={row.status} />
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn btn-ghost btn-sm text-muted"
          aria-expanded={open}
        >
          {open ? 'Hide' : hasDetail ? 'Notes ✓' : 'Notes'}
        </button>
      </div>

      {open && (
        <form
          action={updateChecklistProgress}
          className="mt-3 space-y-3 rounded-lg bg-wash p-3.5"
        >
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="itemId" value={row.itemId} />
          <input type="hidden" name="status" value={row.status} />
          <div>
            <label className="label" htmlFor={`notes-${row.itemId}`}>
              Notes
            </label>
            <textarea
              id={`notes-${row.itemId}`}
              name="notes"
              rows={3}
              defaultValue={row.notes}
              readOnly={!canEdit}
              className="field"
              placeholder="What you understood, what you practised, what is still unclear."
            />
          </div>
          <div>
            <label className="label" htmlFor={`evidence-${row.itemId}`}>
              Evidence link
            </label>
            <input
              id={`evidence-${row.itemId}`}
              name="evidenceUrl"
              defaultValue={row.evidenceUrl}
              readOnly={!canEdit}
              className="field"
              placeholder="A PR, a wiki page, a demo recording"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && <SubmitButton className="btn btn-sm btn-primary">Save notes</SubmitButton>}
            {row.evidenceUrl && (
              <a
                href={row.evidenceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="link text-xs"
              >
                Open evidence
              </a>
            )}
          </div>
        </form>
      )}
    </li>
  );
}
