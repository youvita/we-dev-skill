'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LEARNING_CYCLE,
  SESSION_TYPES,
  SESSION_TYPE_HINT,
  SESSION_TYPE_LABEL,
  cycleStageFor,
  type SessionType,
} from '@/lib/domain';
import { createSession } from '@/lib/actions';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card } from '@/components/ui';

export function NewSessionForm({
  skills,
  members,
  defaults,
}: {
  skills: { id: string; key: string; name: string; ownerId: string | null }[];
  members: { id: string; name: string }[];
  defaults: { skillId?: string; type: SessionType; presenterId: string; date: string };
}) {
  const [type, setType] = useState<SessionType>(defaults.type);
  const [skillId, setSkillId] = useState(defaults.skillId ?? skills[0]?.id);
  const activeStage = cycleStageFor(type);
  const skill = skills.find((s) => s.id === skillId) ?? skills[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Card>
        <ActionForm action={createSession} className="card-body space-y-5 pt-1">
          <div>
            <label className="label" htmlFor="s-title">
              Title
            </label>
            <input
              id="s-title"
              name="title"
              className="field"
              placeholder="e.g. What I Learned About Database"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="s-skill">
                Skill
              </label>
              <select
                id="s-skill"
                name="skillId"
                className="field"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                required
              >
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-topic">
                Topic
              </label>
              <input
                id="s-topic"
                name="topic"
                className="field"
                placeholder="e.g. Database Fundamentals"
              />
            </div>
          </div>

          <fieldset>
            <legend className="label">Session type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SESSION_TYPES.map((t) => (
                <label key={t} className={`choice ${type === t ? 'choice-on' : ''}`}>
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="mt-1"
                    required
                  />
                  <span className="text-xs">
                    <strong className="block text-sm text-ink">{SESSION_TYPE_LABEL[t]}</strong>
                    <span className="mt-0.5 block leading-relaxed text-muted">
                      {SESSION_TYPE_HINT[t]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="s-presenter">
                Presenter
              </label>
              <select
                id="s-presenter"
                name="presenterId"
                className="field"
                defaultValue={defaults.presenterId}
              >
                <option value="">No presenter</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-date">
                Date and time
              </label>
              <input
                id="s-date"
                name="date"
                type="datetime-local"
                className="field"
                defaultValue={defaults.date}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="s-duration">
                Duration (min)
              </label>
              <input
                id="s-duration"
                name="duration"
                type="number"
                min={15}
                step={15}
                defaultValue={60}
                className="field"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="s-location">
              Location / meeting link
            </label>
            <input
              id="s-location"
              name="location"
              className="field"
              placeholder="Meeting Room 1, or https://..."
            />
          </div>

          <div>
            <label className="label" htmlFor="s-description">
              Description
            </label>
            <textarea
              id="s-description"
              name="description"
              rows={4}
              className="field"
              placeholder="What will be covered, and what participants should be able to do afterwards."
            />
          </div>

          <fieldset>
            <legend className="label">Participants</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-wash"
                >
                  <input type="checkbox" name="participantIds" value={m.id} defaultChecked />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton>Create session</SubmitButton>
        </ActionForm>
      </Card>

      <aside>
        <Card title="Where this fits">
          <p className="px-5 pb-3 text-xs leading-relaxed text-muted">
            The cycle has four stages, but only three of them schedule a session. Self learning is
            individual work — it still has a home, just not on this page.
          </p>
          <ol className="divide-rows border-t border-hair">
            {LEARNING_CYCLE.map((stage, i) => {
              const active = stage.key === activeStage;
              const noSession = stage.sessionTypes.length === 0;
              return (
                <li
                  key={stage.key}
                  className={`px-5 py-3.5 transition ${active ? 'bg-brand-soft' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-2xs font-semibold ${
                        active
                          ? 'bg-brand text-white'
                          : noSession
                            ? 'bg-hair text-faint'
                            : 'bg-hair text-muted'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-ink">{stage.title}</span>
                    {active && <span className="chip chip-plain ml-auto">you are here</span>}
                  </div>

                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{stage.detail}</p>

                  {noSession ? (
                    <div className="mt-2 space-y-1.5">
                      <span className="chip border-dashed border-line text-faint">
                        no session to schedule
                      </span>
                      {skill && (
                        <p className="text-xs leading-relaxed text-muted">
                          Hand it out with{' '}
                          <Link href={`/skills/${skill.key}?tab=team`} className="link font-medium">
                            Assign learning
                          </Link>{' '}
                          on the {skill.name} page. Members then work the{' '}
                          <span className="font-medium text-body">Checklist</span> and keep a{' '}
                          <span className="font-medium text-body">Learning log</span> in their own
                          workspace.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {stage.sessionTypes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`chip transition ${
                            type === t
                              ? 'border-brand bg-brand text-white'
                              : 'chip-plain hover:border-brand-ring'
                          }`}
                        >
                          {SESSION_TYPE_LABEL[t]}
                        </button>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      </aside>
    </div>
  );
}
