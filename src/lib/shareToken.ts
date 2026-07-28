import { randomBytes } from 'crypto';
import { unstable_cache, revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { userSettingKey } from '@/lib/userData';

const SHARE_TOKEN_CACHE_TAG = 'share-token-lookup';

/**
 * Resolves a /s/<token> share token to its owning userId. Cached for 5
 * minutes (Vercel Data Cache) since the mapping only changes on
 * revoke/regenerate, which call invalidateShareTokenCache() below — turns a
 * DB round-trip into a cache hit on every repeat share-link open.
 */
export const getUserIdForShareToken = unstable_cache(
  async (token: string): Promise<string | null> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `share:${token}`)
      .maybeSingle();
    return (data?.value as string | undefined) ?? null;
  },
  ['share-token-lookup'],
  { revalidate: 300, tags: [SHARE_TOKEN_CACHE_TAG] }
);

export function invalidateShareTokenCache() {
  revalidateTag(SHARE_TOKEN_CACHE_TAG, 'max');
}

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
