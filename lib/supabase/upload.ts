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

const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30MB。短い動画（数十秒）を想定した上限

// 短い動画投稿（言い伝え・語り部の記録に効果的）。写真と同じ公開バケットにアップロードする
export async function uploadTraceVideo(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('動画は30MBまでです。短く撮り直してください');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `video/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'video/mp4',
  });

  if (error) throw new Error(`動画のアップロードに失敗: ${error.message}`);

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
