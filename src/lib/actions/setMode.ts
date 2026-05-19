'use server';

import { createServiceClient } from '@/lib/supabase/server';

export async function setMode(modeId: string, albumIds: string[] = []): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('display_state')
    .update({
      active_mode_id: modeId,
      active_album_ids: albumIds,
      override_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', 1);

  if (error) throw new Error(`setMode failed: ${error.message}`);
}
