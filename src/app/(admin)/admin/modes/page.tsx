'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Television } from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { Section, ToggleRow } from '@/components/m/List';
import { Button } from '@/components/m/Controls';
import { Sheet } from '@/components/m/Sheet';
import { toast } from '@/components/m/Toast';
import { LOOKS, LOOK_GROUPS, LOOK_BY_ID, LookArt, type Look } from '@/components/looks/catalog';
import { ModeConfigForm } from '@/components/looks/LookConfigForms';
import { invalidateModes } from '@/hooks/useModes';
import { cn } from '@/lib/utils';
import type { Mode } from '@/types/db';

type Cfg = Record<string, unknown>;

export default function LooksPage() {
  return (
    <Suspense fallback={null}>
      <LooksContent />
    </Suspense>
  );
}

function LooksContent() {
  const searchParams = useSearchParams();
  const [modes, setModes] = useState<Mode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<{ look: Look; cfg: Cfg } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [m, ds] = await Promise.all([
      fetch('/api/modes').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/display-state').then((r) => (r.ok ? r.json() : null)),
    ]);
    setModes(Array.isArray(m) ? m : (m.modes ?? []));
    setActiveId((ds?.state ?? ds)?.active_mode_id ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modeById = useMemo(() => Object.fromEntries(modes.map((m) => [m.id, m])), [modes]);

  const openLook = useCallback(
    (look: Look) => setOpen({ look, cfg: ((modeById[look.id]?.config as Cfg) ?? {}) }),
    [modeById]
  );

  // `?configure=<id>` deep link — the Mac screensaver's Options panel uses
  // it ("Configure on Web…") to land straight on one look's settings.
  useEffect(() => {
    if (!loaded || open) return;
    const id = searchParams.get('configure');
    if (id && LOOK_BY_ID[id]) openLook(LOOK_BY_ID[id]);
  }, [loaded, open, searchParams, openLook]);

  const showNow = async (id: string) => {
    const previous = activeId;
    setActiveId(id);
    const res = await fetch('/api/display-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_mode_id: id }),
    }).catch(() => null);
    if (!res?.ok) {
      setActiveId(previous);
      return toast.error('Your screens didn’t respond. Try again.');
    }
    toast(`Showing ${LOOK_BY_ID[id]?.name ?? 'look'}`);
  };

  // Settings save as you change them (debounced), like iOS Settings.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeCfg = (lookId: string, cfg: Cfg) => {
    setOpen((o) => (o ? { ...o, cfg } : o));
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/modes/${lookId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      }).catch(() => null);
      setSaving(false);
      if (!res?.ok) return toast.error('Couldn’t save that change.');
      setModes((prev) => prev.map((m) => (m.id === lookId ? { ...m, config: cfg } : m)));
      invalidateModes();
    }, 450);
  };

  const setEnabled = async (id: string, enabled: boolean) => {
    setModes((prev) => prev.map((m) => (m.id === id ? { ...m, is_enabled: enabled } : m)));
    const res = await fetch(`/api/modes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: enabled }),
    }).catch(() => null);
    if (!res?.ok) toast.error('Couldn’t update that look.');
  };

  const openMode = open ? modeById[open.look.id] : null;

  return (
    <Page title="Looks" subtitle="How your memories appear on screen." wide>
      {LOOK_GROUPS.map((group) => {
        const looks = LOOKS.filter((l) => l.group === group.id);
        return (
          <section key={group.id}>
            <div className="mb-3 px-1">
              <h2 className="text-[22px] font-bold tracking-tight">{group.label}</h2>
              <p className="text-[15px] text-label-2">{group.blurb}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {looks.map((look) => {
                const active = look.id === activeId;
                const hidden = modeById[look.id]?.is_enabled === false;
                return (
                  <button
                    key={look.id}
                    type="button"
                    onClick={() => openLook(look)}
                    className={cn(
                      'pressable group overflow-hidden rounded-[18px] bg-cell text-left shadow-cell ring-2',
                      active ? 'ring-tint' : 'ring-transparent',
                      hidden && 'opacity-50'
                    )}
                  >
                    <div className="relative">
                      <LookArt id={look.id} className="aspect-[4/3] w-full" />
                      {active && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                          <CheckCircle size={12} weight="fill" /> On now
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[16px] font-semibold">{look.name}</p>
                      <p className="line-clamp-2 text-[13px] leading-snug text-label-2">{look.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <Sheet
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.look.name ?? ''}
        description={open?.look.blurb}
        size="lg"
        footer={
          open && (
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[13px] text-label-2">{saving ? 'Saving…' : 'Changes save automatically'}</span>
              {open.look.id === activeId ? (
                <Button variant="tinted" disabled>Showing now ✓</Button>
              ) : (
                <Button onClick={() => showNow(open.look.id)}>Show it now</Button>
              )}
            </div>
          )
        }
      >
        {open && (
          <>
            <LookArt id={open.look.id} className="aspect-[16/9] w-full rounded-[18px]" />
            {open.look.tvSafe && (
              <p className="flex items-center gap-2 px-1 text-[13px] text-label-2">
                <Television size={16} /> Works on older smart TVs too
              </p>
            )}
            <div className="rounded-[14px] bg-cell p-4 shadow-cell">
              <ModeConfigForm
                mode={openMode ?? ({ id: open.look.id, name: open.look.name, config: open.cfg } as Mode)}
                cfg={open.cfg}
                onChange={(cfg) => changeCfg(open.look.id, cfg)}
              />
            </div>
            <Section footer="Hidden looks don’t appear in the quick picker or in schedules.">
              <ToggleRow
                title="Show in the quick picker"
                checked={modeById[open.look.id]?.is_enabled !== false}
                onChange={(v) => setEnabled(open.look.id, v)}
              />
            </Section>
          </>
        )}
      </Sheet>
    </Page>
  );
}
