// PATCH/DELETE /api/admin/ai-deliverables/[id] — 会長の承認・差し戻し・却下。
//
// 承認（status='approved'）のときだけ、成果物の本体を実体テーブルへ書き戻す（lib/deliverables.ts の REFLECT_TO）。
// 差し戻し（status='revise'）は feedback と rebuild を保存するだけ。次の朝、番人がこの行を
// 最優先でキューに載せ、オートパイロットが feedback を読んで作り直す。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { REFLECT_TO, CREATE_IN, isKind, isStatus } from '@/lib/deliverables';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    status?: string; feedback?: string | null; rebuild?: boolean;
  };
  if (body.status !== undefined && !isStatus(body.status)) {
    return NextResponse.json({ ok: false, error: 'statusが不正です' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: current, error: readError } = await supabaseServer
    .from('ai_deliverables').select('*').eq('id', params.id).single();
  if (readError || !current) {
    return NextResponse.json({ ok: false, error: readError?.message ?? '成果物が見つかりません' }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) patch.status = body.status;
  if (body.feedback !== undefined) patch.feedback = body.feedback?.trim() || null;
  if (body.rebuild !== undefined) patch.rebuild = Boolean(body.rebuild);

  // 承認 → 実体テーブルへ反映。反映に失敗したら承認自体を成立させない
  // （画面上は承認済みなのに実体が古いまま、という食い違いを作らないため）。
  let reflected: string | null = null;
  const kind: unknown = current.kind;
  if (body.status === 'approved' && isKind(kind)) {
    if (current.entity_id) {
      // 既存の行がある提案（メール下書き等）→ 該当カラムを更新する
      const target = REFLECT_TO[kind];
      if (target) {
        const { error: reflectError } = await supabaseServer
          .from(target.table)
          .update({ [target.column]: current.body, updated_at: new Date().toISOString() })
          .eq('id', current.entity_id);
        if (reflectError) {
          return NextResponse.json({ ok: false, error: `反映に失敗しました: ${reflectError.message}` }, { status: 500 });
        }
        reflected = `${target.table}.${target.column}`;
      }
    } else {
      // 対象の行が無い提案（新規事業の仮説・SNS投稿案）→ 新しい行として作る
      const creator = CREATE_IN[kind];
      if (creator) {
        const { error: createError } = await supabaseServer
          .from(creator.table)
          .insert(creator.build({ title: current.title, body: current.body }));
        if (createError) {
          return NextResponse.json({ ok: false, error: `反映に失敗しました: ${createError.message}` }, { status: 500 });
        }
        reflected = `${creator.table}（新規作成）`;
      }
    }
  }

  const { data, error } = await supabaseServer
    .from('ai_deliverables').update(patch).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deliverable: data, reflected });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer.from('ai_deliverables').delete().eq('id', params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
