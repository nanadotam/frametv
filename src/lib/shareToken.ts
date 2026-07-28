import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { userSettingKey } from '@/lib/userData';

export function generateShareToken(): string {
  const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('');
}

/** Returns the user's existing share token, minting one if they don't have one yet. */
export async function getOrCreateShareToken(userId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('settings')
    .select('value')
    .eq('key', userSettingKey(userId, 'share_token'))
    .maybeSingle();

  if (existing?.value) return existing.value as string;

  const token = generateShareToken();
  await Promise.all([
    supabase.from('settings').upsert(
      { key: userSettingKey(userId, 'share_token'), user_id: userId, value: token, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    ),
    supabase.from('settings').upsert(
      { key: `share:${token}`, value: userId, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    ),
  ]);

  return token;
}
