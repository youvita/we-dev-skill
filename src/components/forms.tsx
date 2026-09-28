'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/types';

export function SubmitButton({
  children,
  className = 'btn btn-primary',
  pendingLabel,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </button>
  );
}

export function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p role="status" className={`note mt-3 ${state.ok ? 'note-ok' : 'note-bad'}`}>
      {state.ok ? (state.message ?? 'Saved.') : state.error}
    </p>
  );
}

/**
 * Wraps a server action that returns an ActionResult so the form can show
 * inline success/error text instead of throwing.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode | ((state: ActionResult | null) => React.ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  if (resetOnSuccess && state?.ok) ref.current?.reset();

  return (
    <form ref={ref} action={formAction} className={className}>
      {typeof children === 'function' ? children(state) : children}
      <Feedback state={state} />
    </form>
  );
}

/** A <details> block that keeps a secondary form out of the way until needed. */
export function Disclosure({
  summary,
  children,
  open = false,
  bare = false,
}: {
  summary: string;
  children: React.ReactNode;
  open?: boolean;
  /** Inside an already-padded container: no card chrome, no edge-to-edge rules. */
  bare?: boolean;
}) {
  return (
    <details open={open} className="group">
      <summary
        className={`flex cursor-pointer select-none list-none items-center gap-1.5 text-sm font-medium text-brand transition marker:content-none hover:text-brand-hover ${
          bare ? '' : 'px-5 py-3.5'
        }`}
      >
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
          &rsaquo;
        </span>
        {summary}
      </summary>
      <div className={bare ? 'pt-3' : 'border-t border-hair px-5 py-4'}>{children}</div>
    </details>
  );
}
