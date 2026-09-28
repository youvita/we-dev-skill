import { redirect } from 'next/navigation';

/** The matrix now lives as the "Team skills" tab of /skills. */
export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  redirect(view ? `/skills?tab=team&view=${view}` : '/skills?tab=team');
}
