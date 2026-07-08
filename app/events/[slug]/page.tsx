import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import EventPageClient from '@/components/EventPageClient';
import RelayEventClient from '@/components/RelayEventClient';
import type { Route, Trace } from '@/lib/types';

interface Props {
  params: { slug: string };
}

async function getEvent(slug: string): Promise<{ route: Route; traces: Trace[] } | null> {
  const { data: route, error } = await supabaseServer
    .from('routes').select('*').eq('event_slug', slug).eq('is_deleted', false).single();
  if (error || !route) return null;

  // relay型（発見連鎖型）は事前に地点が決まっていないため、trace_ids ではなく event_session_code で参加者投稿を束ねる
  if ((route as Route).event_mode === 'relay') {
    const { data: traceRows } = await supabaseServer
      .from('traces').select('*')
      .eq('session_code', (route as Route).event_session_code ?? '__none__')
      .eq('is_deleted', false)
      .eq('visibility', 'public')
      .order('created_at', { ascending: true });
    return { route: route as Route, traces: (traceRows ?? []) as Trace[] };
  }

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
  const { route, traces } = event;
  const description = route.description ?? (route.event_mode === 'relay'
    ? 'みんなで発見をつないでいくヒトマップのリレー型イベント'
    : `${traces.length}地点を歩いて巡るヒトマップのイベント`);
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

  if (event.route.event_mode === 'relay') {
    return <RelayEventClient route={event.route} traces={event.traces} />;
  }
  return <EventPageClient route={event.route} traces={event.traces} />;
}
