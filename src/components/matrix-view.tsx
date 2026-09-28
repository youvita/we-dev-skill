import Link from 'next/link';
import { getMatrix } from '@/lib/queries';
import { LEVEL_DEF, levelCode, type Level } from '@/lib/domain';
import { Card, LevelBadge, LevelLegend, Progress } from '@/components/ui';
import { ConfidenceChip } from '@/components/assessment-view';

const VIEWS = [
  { key: 'verified', label: 'Verified level', hint: 'The official level, set by the skill owner.' },
  { key: 'self', label: 'Self vs verified', hint: 'Where a member rates themselves above their verified level.' },
  { key: 'target', label: 'Target level', hint: 'Where each member is heading in this skill.' },
  { key: 'progress', label: 'Checklist progress', hint: 'How much of the knowledge checklist is done.' },
  {
    key: 'confidence',
    label: 'Evidence & confidence',
    hint: 'How well-evidenced each level is. A level with thin evidence is provisional.',
  },
] as const;

type ViewKey = (typeof VIEWS)[number]['key'];

/**
 * The team skill matrix. Lives inside the Skills page as the "Team skills" tab,
 * so the lens links keep `tab=team` alongside their own `view`.
 */
export async function MatrixView({ rawView }: { rawView?: string }) {
  const view = (VIEWS.find((v) => v.key === rawView)?.key ?? 'verified') as ViewKey;
  const { skills, rows } = await getMatrix();

  const activeView = VIEWS.find((v) => v.key === view)!;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/skills?tab=team&view=${v.key}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              v.key === view
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {v.label}
          </Link>
        ))}
        <span className="text-xs text-muted">{activeView.hint}</span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="border-y border-hair bg-wash">
            <tr>
              <th className="th sticky left-0 z-10 bg-wash">Member</th>
              {skills.map((s) => (
                <th key={s.id} className="th text-center">
                  <Link href={`/skills/${s.key}`} className="hover:text-ink">
                    {s.name}
                  </Link>
                  <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-muted">
                    {s.owner ? `owner: ${s.owner.name}` : 'no owner'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-rows">
            {rows.map((row) => (
              <tr key={row.memberId} className="hover:bg-wash/60">
                <th className="th sticky left-0 z-10 bg-surface font-medium normal-case tracking-normal">
                  <Link href={`/members/${row.memberId}`} className="text-sm text-ink hover:text-brand">
                    {row.memberName}
                  </Link>
                  {row.title && <div className="text-2xs font-normal text-muted">{row.title}</div>}
                </th>
                {skills.map((s) => {
                  const cell = row.cells[s.id];
                  const href = `/members/${row.memberId}/skills/${s.key}`;
                  return (
                    <td key={s.id} className="td text-center">
                      <Link href={href} className="inline-block align-middle">
                        {view === 'verified' && (
                          <LevelBadge
                            level={cell.verifiedLevel}
                            primary={cell.isPrimary}
                            title={cellTitle(cell, row.memberName, s.name)}
                          />
                        )}

                        {view === 'self' && (
                          <span className="inline-flex items-center gap-1">
                            <LevelBadge level={cell.selfLevel} primary={cell.isPrimary} />
                            {cell.selfLevel != null &&
                              cell.selfLevel > (cell.verifiedLevel ?? 0) && (
                                <span
                                  className="chip border-amber-200 bg-amber-50 text-amber-700"
                                  title={`Self ${levelCode(cell.selfLevel)} is above verified ${levelCode(cell.verifiedLevel)} — awaiting review.`}
                                >
                                  &gt; {levelCode(cell.verifiedLevel)}
                                </span>
                              )}
                          </span>
                        )}

                        {view === 'target' && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <LevelBadge level={cell.verifiedLevel} primary={cell.isPrimary} />
                            <span aria-hidden>&rarr;</span>
                            <span
                              className={`chip ${
                                (cell.verifiedLevel ?? 0) >= cell.targetLevel
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-line bg-wash text-muted'
                              }`}
                              title={
                                (cell.verifiedLevel ?? 0) >= cell.targetLevel
                                  ? 'Target met'
                                  : `Gap of ${cell.targetLevel - (cell.verifiedLevel ?? 0)} level(s)`
                              }
                            >
                              {levelCode(cell.targetLevel)}
                            </span>
                          </span>
                        )}

                        {view === 'progress' && (
                          <span className="mx-auto block w-28">
                            <Progress done={cell.checklistDone} total={cell.checklistTotal} />
                          </span>
                        )}

                        {view === 'confidence' && (
                          <span
                            className="inline-flex items-center gap-1.5"
                            title={`${cell.evidenceCount} evidence item(s) on file`}
                          >
                            <LevelBadge level={cell.verifiedLevel} primary={cell.isPrimary} />
                            {cell.confidence ? (
                              <ConfidenceChip confidence={cell.confidence} compact />
                            ) : (
                              <span className="chip border-dashed border-line text-faint">
                                unverified
                              </span>
                            )}
                            <span className="text-2xs tabular-nums text-faint">
                              {cell.evidenceCount}&times;
                            </span>
                            {cell.reassessmentDue && (
                              <span
                                className="chip border-amber-200 bg-amber-50 text-amber-800"
                                title="The next assessment date set by the last review has passed."
                              >
                                due
                              </span>
                            )}
                          </span>
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-xs text-muted">
        <span className="mr-1" aria-hidden>
          &#9733;
        </span>
        marks a member&rsquo;s Primary Skill. Click any cell to open that member&rsquo;s learning
        workspace for the skill.
      </p>

      {/* A key for the chart, not a second copy of the definitions — those live
          in one place at /levels. */}
      <Card
        title="Level key"
        className="mt-6"
        action={
          <Link href="/levels" className="text-xs font-medium text-brand hover:underline">
            Full level guide &rarr;
          </Link>
        }
      >
        <LevelLegend compact />
      </Card>
    </>
  );
}

function cellTitle(
  cell: { verifiedLevel: number | null; selfLevel: number | null; targetLevel: number; isPrimary: boolean },
  member: string,
  skill: string,
): string {
  const def = cell.verifiedLevel ? LEVEL_DEF[cell.verifiedLevel as Level] : null;
  return [
    `${member} — ${skill}`,
    cell.isPrimary ? 'Primary skill' : null,
    `Verified: ${levelCode(cell.verifiedLevel)}${def ? ` (${def.name})` : ''}`,
    `Self: ${levelCode(cell.selfLevel)}`,
    `Target: ${levelCode(cell.targetLevel)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
