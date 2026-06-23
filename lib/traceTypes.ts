// 痕跡の種類：人・もの・こと
export const TRACE_TYPES = [
  { key: 'person', label: '人',   emoji: '👤', color: '#8E44AD' },
  { key: 'thing',  label: 'もの', emoji: '🔧', color: '#E67E22' },
  { key: 'event',  label: 'こと', emoji: '✨', color: '#27AE60' },
] as const;

export type TraceTypeKey = typeof TRACE_TYPES[number]['key'];

export function getTraceType(key: string | null | undefined) {
  return TRACE_TYPES.find(t => t.key === key) ?? null;
}
