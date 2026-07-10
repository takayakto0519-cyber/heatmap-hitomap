// GET /api/admin/export?format=csv|geojson — 全国公開済みデータの一括書き出し（データライセンス販売の前提機能）
import { NextRequest, NextResponse } from 'next/server';
import type { Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function checkAdmin(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && provided === expected;
}

const CSV_COLUMNS: (keyof Trace)[] = [
  'id', 'created_at', 'title', 'why', 'interpretation', 'self_reflection',
  'latitude', 'longitude', 'region', 'emotion_key', 'intensity', 'category',
  'archive_type', 'era_label', 'trace_type', 'is_past_memory', 'memory_date',
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(traces: Trace[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = traces.map((t) => CSV_COLUMNS.map((c) => csvEscape(t[c])).join(','));
  return [header, ...rows].join('\n');
}

function toGeoJson(traces: Trace[]) {
  return {
    type: 'FeatureCollection',
    features: traces.map((t) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.longitude, t.latitude] },
      properties: {
        id: t.id, created_at: t.created_at, title: t.title, why: t.why,
        interpretation: t.interpretation, self_reflection: t.self_reflection,
        region: t.region, emotion_key: t.emotion_key, intensity: t.intensity,
        category: t.category, archive_type: t.archive_type, era_label: t.era_label,
        trace_type: t.trace_type, is_past_memory: t.is_past_memory, memory_date: t.memory_date,
      },
    })),
  };
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });

  const format = req.nextUrl.searchParams.get('format') === 'geojson' ? 'geojson' : 'csv';
  const region = req.nextUrl.searchParams.get('region');

  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer
    .from('traces').select('*')
    .eq('is_deleted', false)
    .eq('visibility', 'public');
  if (region) query = query.eq('region', region);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(10000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const traces = (data ?? []) as Trace[];
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (format === 'geojson') {
    return new NextResponse(JSON.stringify(toGeoJson(traces), null, 2), {
      headers: {
        'Content-Type': 'application/geo+json',
        'Content-Disposition': `attachment; filename="hitomap_traces_${stamp}.geojson"`,
      },
    });
  }

  return new NextResponse(toCsv(traces), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hitomap_traces_${stamp}.csv"`,
    },
  });
}
