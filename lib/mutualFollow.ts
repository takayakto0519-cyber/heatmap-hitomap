// 相互フォロー（お互いにフォローし合っている関係）かどうかの判定
// チャット機能など、相互フォローの相手のみに許可したい操作の共通ガードとして使う
import { supabaseServer } from '@/lib/supabase/server';

export async function isMutualFollow(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return false;
  const [{ data: aFollowsB }, { data: bFollowsA }] = await Promise.all([
    supabaseServer.from('follows').select('follower_id').eq('follower_id', userA).eq('followee_id', userB).maybeSingle(),
    supabaseServer.from('follows').select('follower_id').eq('follower_id', userB).eq('followee_id', userA).maybeSingle(),
  ]);
  return Boolean(aFollowsB) && Boolean(bFollowsA);
}
