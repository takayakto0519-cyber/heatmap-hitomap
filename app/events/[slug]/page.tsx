import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import EventPageClient from '@/components/EventPageClient';
import type { Route, Trace } from '@/lib/types';

interface Props {
  params: { slug: string };
}

async function getEvent(slug: string): Promise<{ route: Route; traces: Trace[] } | null> {
  const { data: route, error } = await supabaseServer
    .from('routes').select('*').eq('event_slug', slug).eq('is_deleted', false).single();
  if (error || !route) return null;

  const { data: traceRows } = await supabaseServer
    .from('traces').select('*').in('id', route.trace_ids as string[]);
  const byId = new Map(((traceRows ?? []) as Trace[]).map((t) => [t.id, t]));
  const traces = (route.trace_ids as string[])
    .map((tid) => byId.get(tid))
    .filter((t): t is Trace => Boolean(t));

  return { route: route as Route, traces };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEvent(params.slug);
  if (!event) return { title: 'ヒトマップ' };
  const { route } = event;
  const description = route.description ?? `${route.trace_ids.length}地点を歩いて巡るヒトマップのイベント`;
  return {
    title: `${route.title} | ヒトマップ`,
    description,
    openGraph: {
      title: route.title,
      description,
      images: [`/events/${params.slug}/opengraph-image`],
    },
    twitter: {
      card: 'summary_large_image',
      title: route.title,
      description,
    },
  };
}

export default async function EventPage({ params }: Props) {
  const event = await getEvent(params.slug);
  if (!event) notFound();

  return <EventPageClient route={event.route} traces={event.traces} />;
}
