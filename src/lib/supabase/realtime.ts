import { createClient } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the singleton browser Supabase client suitable for realtime
 * subscriptions. The underlying createClient() is already memoized.
 * Call only from client components / hooks.
 */
export function getRealtimeClient(): SupabaseClient {
  return createClient() as SupabaseClient;
}
