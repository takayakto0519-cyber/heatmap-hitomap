import { supabase } from '@/lib/supabase/client';
import { compressImage } from '@/lib/compressImage';

const BUCKET = 'trace-photos';

export async function uploadTracePhoto(file: File): Promise<string> {
  // HEIC・大容量をJPEG 1200px以内に圧縮してからアップロード
  const compressed = await compressImage(file);
  const ext = 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'image/jpeg',
  });

  if (error) throw new Error(`写真のアップロードに失敗: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// プロフィールアイコン。写真と同じ公開バケットに userId で名前空間を切って保存する
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const compressed = await compressImage(file);
  const path = `avatar/${userId}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'image/jpeg',
  });

  if (error) throw new Error(`アイコンのアップロードに失敗: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// 言い伝え・人の声の録音を写真と同じ公開バケットにアップロード（新規バケット不要）
export async function uploadTraceAudio(blob: Blob): Promise<string> {
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
  const path = `audio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: blob.type || 'audio/webm',
  });

  if (error) throw new Error(`録音のアップロードに失敗: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
