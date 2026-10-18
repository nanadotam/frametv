'use client';

import { useState } from 'react';
import { AppleLogo, CaretDown, Folder, ImageSquare, MusicNote, Desktop, DownloadSimple, FileText, Clock } from '@phosphor-icons/react';
import { Sheet } from '@/components/m/Sheet';
import { Button, Segmented } from '@/components/m/Controls';
import { cn } from '@/lib/utils';


/** A drawing of the macOS file window, pointing at Media → Photos and the album menu. */
function OpenPanelArt() {
  const side = [
    { h: 'Favorites' },
    { i: <Clock size={13} />, t: 'Recents' },
    { i: <Desktop size={13} />, t: 'Desktop' },
    { i: <FileText size={13} />, t: 'Documents' },
    { i: <DownloadSimple size={13} />, t: 'Downloads' },
    { h: 'Media' },
    { i: <MusicNote size={13} />, t: 'Music' },
    { i: <ImageSquare size={13} />, t: 'Photos', hot: true },
  ];
  return (
    <div className="overflow-hidden rounded-[14px] border border-separator bg-cell text-[12px] shadow-cell">
      <div className="flex items-center gap-1.5 border-b border-separator bg-fill px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="relative mx-auto">
          <span className="flex items-center gap-1 rounded-md bg-cell px-2.5 py-1 font-semibold ring-2 ring-tint">
            Family <CaretDown size={10} weight="bold" />
          </span>
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-tint text-[11px] font-bold text-white">2</span>
        </div>
      </div>
      <div className="flex">
        <div className="w-[38%] space-y-0.5 border-r border-separator p-2">
          {side.map((s, k) =>
            'h' in s ? (
              <p key={k} className="px-1.5 pt-1.5 text-[10px] font-semibold text-label-3">{s.h}</p>
            ) : (
              <p
                key={k}
                className={cn('relative flex items-center gap-1.5 rounded-md px-1.5 py-1', s.hot ? 'bg-tint font-semibold text-white' : 'text-label-2')}
              >
                {s.i} {s.t}
                {s.hot && <span className="absolute -right-2 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-[#1c1c1e] text-[11px] font-bold text-white">1</span>}
              </p>
            )
          )}
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1.5 p-2">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <div key={k} className={cn('aspect-square rounded-[4px]', k < 4 ? 'ring-2 ring-[#0a84ff]' : '')} style={{ background: ['#c24d86', '#3e8fc9', '#3f7a52', '#ff8a65', '#5b2a86', '#e2547a'][k] }} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-separator px-3 py-2">
        <span className="rounded-md bg-fill px-3 py-1">Cancel</span>
        <span className="relative rounded-md bg-[#0a84ff] px-3 py-1 font-semibold text-white">
          Open
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-tint text-[11px] font-bold">3</span>
        </span>
      </div>
    </div>
  );
}

const Step = ({ n, children }: { n: number | string; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="bg-ember mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white">{n}</span>
    <span className="text-[15px] leading-relaxed text-label-2 [&_b]:text-label">{children}</span>
  </li>
);

/**
 * Explains where Apple Photos lives on a Mac before opening the file
 * picker, plus the drag-and-drop and export alternatives.
 */
export function ApplePhotosGuide({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the file picker (must run from this click to be allowed). */
  onChoose: () => void;
}) {
  const [way, setWay] = useState<'pick' | 'drag' | 'export'>('pick');
  const inApp = typeof window !== 'undefined' && !!window.mantel?.isApp;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add from Apple Photos" description="Your Photos library is on this Mac. Here’s how to reach it." size="lg">
      <Segmented
        value={way}
        onChange={setWay}
        options={[
          { value: 'pick', label: 'Choose in a window' },
          { value: 'drag', label: 'Drag from Photos' },
          { value: 'export', label: 'Export a folder' },
        ]}
      />

      {way === 'pick' && (
        <>
          <OpenPanelArt />
          <ol className="space-y-3">
            <Step n={1}>In the window that opens, look at the <b>left sidebar</b>. Under <b>Media</b>, click <b>Photos</b>. (Scroll the sidebar down if you can’t see it.)</Step>
            <Step n={2}>Use the <b>menu at the top</b> of the window to pick an album, like <b>Favorites</b>, <b>Recents</b> or one of your own albums.</Step>
            <Step n={3}>Select the photos you want (<b>⌘A</b> selects the whole album), then click <b>Open</b>.</Step>
          </ol>
          <Button block size="xl" icon={<AppleLogo size={20} weight="fill" />} onClick={onChoose}>Choose photos</Button>
          <p className="px-1 text-[13px] text-label-2">
            No <b>Photos</b> under Media? Open the Photos app once so the Mac sets up its library, or use one of the other tabs.
          </p>
        </>
      )}

      {way === 'drag' && (
        <>
          <ol className="space-y-3">
            <Step n={1}>Open the <b>Photos</b> app and go to the album you want.</Step>
            <Step n={2}>Select photos (<b>⌘A</b> for all of them).</Step>
            <Step n={3}>Drag them onto this Mantel window and let go. They upload and compress on their own.</Step>
          </ol>
          {inApp && window.mantel?.openPhotosApp && (
            <Button block size="xl" variant="tinted" icon={<AppleLogo size={20} weight="fill" />} onClick={() => window.mantel?.openPhotosApp?.()}>
              Open the Photos app
            </Button>
          )}
          <p className="px-1 text-[13px] text-label-2">Tip: put Photos and Mantel side by side on screen so you can drag between them.</p>
        </>
      )}

      {way === 'export' && (
        <>
          <ol className="space-y-3">
            <Step n={1}>In <b>Photos</b>, open an album and press <b>⌘A</b> to select everything.</Step>
            <Step n={2}>Choose <b>File → Export → Export Photos…</b> (JPEG, Large) and save them into a new folder, e.g. on your Desktop.</Step>
            <Step n={3}>Click <b>Choose photos</b> below, open that folder, press <b>⌘A</b>, then <b>Open</b>.</Step>
          </ol>
          <Button block size="xl" icon={<Folder size={20} weight="fill" />} onClick={onChoose}>Choose photos</Button>
          <p className="px-1 text-[13px] text-label-2">Best for very large albums, or iCloud photos that aren’t downloaded to this Mac yet.</p>
        </>
      )}
    </Sheet>
  );
}
