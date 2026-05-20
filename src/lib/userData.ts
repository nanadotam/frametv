import { createServiceClient } from '@/lib/supabase/server';

const DEFAULT_APP_SETTINGS = {
  latitude: 5.6037,
  longitude: -0.187,
  auto_theme: false,
  night_dim_enabled: false,
  night_dim_start: '22:00',
  night_dim_end: '07:00',
};

const DEFAULT_MODES = [
  { id: 'slideshow-single', name: 'Photo Slideshow', description: 'One photo at a time, full screen', is_enabled: true, config: { intervalSeconds: 60, transition: 'fade', shuffle: true } },
  { id: 'slideshow-grid', name: 'Mixed Grid', description: 'Multiple photos in a smart grid', is_enabled: true, config: { intervalSeconds: 30, transition: 'fade' } },
  { id: 'pinterest', name: 'Pinterest Grid', description: 'Slow-moving multi-column grid', is_enabled: true, config: { rows: 3, speed: 1, direction: 'left', cornerRadius: 24, gap: 12 } },
  { id: 'clock-text', name: 'Text Clock', description: 'Words that spell out the time', is_enabled: true, config: { theme: 'dark', fontSize: 20, fontFamily: 'DM Sans' } },
  { id: 'flipboard', name: 'Flip Board', description: 'Split-flap board with reminders and quotes', is_enabled: true, config: { sources: ['messages', 'reminders', 'quotes'], secondsPerMessage: 30, sound: true, cols: 22, rows: 6 } },
  { id: 'coverflow', name: 'Cover Flow', description: 'Spotify cover flow now playing', is_enabled: true, config: {} },
  { id: 'unsplash-mood', name: 'Mood Photos', description: 'Unsplash photos by mood keyword', is_enabled: true, config: { mood: 'mountains', intervalSeconds: 120 } },
  { id: 'easel', name: 'Easel', description: 'Single quote or intention on a clean canvas', is_enabled: true, config: { texts: ['Today is a gift.'], intervalMinutes: 5, fontFamily: 'Syne' } },
  { id: 'eisenhower', name: 'Eisenhower Matrix', description: 'Priority tasks in 4 colored quadrants', is_enabled: true, config: {} },
];

export function userSettingKey(userId: string, key: string) {
  return `${userId}:${key}`;
}

export async function ensureUserDefaults(userId: string) {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from('app_users')
    .select('id', { count: 'exact', head: true });
  const isFirstUser = (count ?? 0) <= 1;

  if (isFirstUser) {
    await Promise.all([
      supabase.from('albums').update({ user_id: userId }).is('user_id', null),
      supabase.from('photos').update({ user_id: userId }).is('user_id', null),
      supabase.from('schedules').update({ user_id: userId }).is('user_id', null),
      supabase.from('reminders').update({ user_id: userId }).is('user_id', null),
      supabase.from('flipboard_messages').update({ user_id: userId }).is('user_id', null),
    ]);
  }

  const { data: existingModes } = await supabase
    .from('user_modes')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (!existingModes?.length) {
    const { data: globalModes } = await supabase
      .from('modes')
      .select('id, name, description, is_enabled, config')
      .order('id');
    const sourceModes = globalModes?.length ? globalModes : DEFAULT_MODES;
    await supabase.from('user_modes').upsert(
      sourceModes.map((mode) => ({ ...mode, user_id: userId })),
      { onConflict: 'user_id,id' }
    );
  }

  const { data: displayState } = await supabase
    .from('display_state')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!displayState) {
    const legacyDisplayState = isFirstUser
      ? (await supabase.from('display_state').select('*').is('user_id', null).maybeSingle()).data
      : null;

    if (legacyDisplayState) {
      await supabase.from('display_state').update({ user_id: userId }).eq('id', legacyDisplayState.id);
    } else {
      await supabase.from('display_state').insert({
        user_id: userId,
        active_mode_id: 'pinterest',
        active_album_ids: [],
        is_paused: false,
        brightness: 100,
      });
    }
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('key')
    .eq('key', userSettingKey(userId, 'app_settings'))
    .maybeSingle();

  if (!settings) {
    const legacySettings = isFirstUser
      ? (await supabase.from('settings').select('value').eq('key', 'app_settings').maybeSingle()).data?.value
      : null;
    await supabase.from('settings').upsert({
      key: userSettingKey(userId, 'app_settings'),
      user_id: userId,
      value: legacySettings ?? DEFAULT_APP_SETTINGS,
      updated_at: new Date().toISOString(),
    });
  }
}
