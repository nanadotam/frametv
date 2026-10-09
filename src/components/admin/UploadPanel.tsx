'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  MinusCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACTIVE_STATUSES,
  itemFraction,
  type UploadItem,
} from '@/lib/video/useVideoUploads';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(ms: number, seconds = false): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds && { second: '2-digit' }),
  });
}

function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

function statusText(it: UploadItem): string {
  switch (it.status) {
    case 'queued': return `Waiting · ${formatSize(it.file.size)}`;
    case 'checking': return 'Checking for duplicates…';
    case 'converting': return `Converting camera format… ${pct(it.progress)}`;
    case 'compressing': return `Compressing… ${pct(it.progress)}`;
    case 'uploading': return 'Uploading…';
    case 'saving': return 'Saving…';
    case 'done': return `Uploaded${it.bytes ? ` · ${formatSize(it.bytes)}` : ''}`;
    case 'replaced': return `Replaced existing copy${it.bytes ? ` · ${formatSize(it.bytes)}` : ''}`;
    case 'copied': return it.detail ?? 'Copied';
    case 'skipped': return `Skipped — ${it.detail ?? 'duplicate'}`;
    case 'cancelled': return 'Cancelled';
    case 'failed': return it.detail ?? 'Upload failed';
  }
}

function StatusIcon({ it }: { it: UploadItem }) {
  if (ACTIVE_STATUSES.includes(it.status)) {
    return <Loader2 size={18} className="animate-spin text-emerald-400" />;
  }
  switch (it.status) {
    case 'queued': return <Clock size={18} className="text-fg-dim" />;
    case 'done':
    case 'replaced': return <CheckCircle2 size={18} className="text-emerald-400" />;
    case 'copied': return <Copy size={17} className="text-emerald-400" />;
    case 'failed': return <AlertCircle size={18} className="text-red-400" />;
    default: return <MinusCircle size={18} className="text-fg-dim" />;
  }
}

interface UploadPanelProps {
  items: UploadItem[];
  busy: boolean;
  onRetry: (keys?: string[]) => void;
  onCancel: () => void;
  onClose: () => void;
}

/** Google-Drive-style upload tray, pinned bottom-right. */
export function UploadPanel({ items, busy, onRetry, onCancel, onClose }: UploadPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [onlyFailed, setOnlyFailed] = useState(false);
  if (items.length === 0) return null;

  const count = (...s: UploadItem['status'][]) => items.filter((it) => s.includes(it.status)).length;
  const failed = count('failed');
  const succeeded = count('done', 'replaced', 'copied');
  const remaining = items.filter((it) => it.status === 'queued' || ACTIVE_STATUSES.includes(it.status)).length;
  const overall = items.reduce((sum, it) => sum + itemFraction(it), 0) / items.length;

  const title = busy
    ? `Uploading ${remaining} video${remaining !== 1 ? 's' : ''}`
    : failed
      ? `${succeeded} uploaded · ${failed} failed`
      : `${succeeded} upload${succeeded !== 1 ? 's' : ''} complete`;

  const visible = onlyFailed && failed ? items.filter((it) => it.status === 'failed') : items;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-fg/10 bg-bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 pl-4 pr-2 py-3 bg-fg/5">
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', !busy && failed ? 'text-red-400' : 'text-fg')}>
            {title}
          </p>
          <p className="text-[11px] text-fg-muted">
            {succeeded + failed + count('skipped', 'cancelled')} of {items.length} finished
            {failed > 0 && ` · ${failed} failed`}
            {count('skipped') > 0 && ` · ${count('skipped')} skipped`}
          </p>
        </div>
        {busy && (
          <button
            onClick={onCancel}
            className="text-xs font-medium text-fg-muted hover:text-fg px-2 py-1 rounded-lg hover:bg-fg/10"
            title="Cancel the files still waiting"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/10"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronDown size={16} className={cn('transition-transform', collapsed && 'rotate-180')} />
        </button>
        {!busy && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/10"
            title="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Overall progress */}
      <div className="h-1 bg-fg/10">
        <div
          className={cn('h-full transition-[width] duration-300', !busy && failed ? 'bg-red-400' : 'bg-emerald-400')}
          style={{ width: pct(overall) }}
        />
      </div>

      {!collapsed && (
        <>
          {failed > 0 && (
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-fg/10 text-xs">
              <div className="flex gap-1">
                {(['All', 'Failed'] as const).map((tab) => {
                  const active = (tab === 'Failed') === onlyFailed;
                  return (
                    <button
                      key={tab}
                      onClick={() => setOnlyFailed(tab === 'Failed')}
                      className={cn(
                        'px-2.5 py-1 rounded-full transition-colors',
                        active ? 'bg-fg/15 text-fg' : 'text-fg-muted hover:text-fg'
                      )}
                    >
                      {tab === 'All' ? `All (${items.length})` : `Failed (${failed})`}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => onRetry()}
                className="flex items-center gap-1 font-medium text-emerald-400 hover:underline"
              >
                <RotateCcw size={12} /> Retry failed
              </button>
            </div>
          )}

          <ul className="max-h-80 overflow-y-auto divide-y divide-fg/5">
            {visible.map((it) => {
              const active = ACTIVE_STATUSES.includes(it.status);
              const showBar = it.status === 'converting' || it.status === 'compressing';
              return (
                <li key={it.key} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="pt-0.5 shrink-0"><StatusIcon it={it} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate" title={it.file.name}>{it.file.name}</p>
                    <p
                      className={cn(
                        'text-xs',
                        it.status === 'failed' ? 'text-red-400 break-words' : 'text-fg-muted truncate'
                      )}
                    >
                      {statusText(it)}
                    </p>
                    {it.status === 'failed' && it.finishedAt && (
                      <p className="text-[11px] text-fg-dim mt-0.5">
                        Failed at {formatTime(it.finishedAt, true)}
                        {it.startedAt && ` · after ${formatElapsed(it.finishedAt - it.startedAt)}`}
                        {` · original ${formatSize(it.file.size)}`}
                      </p>
                    )}
                    {showBar && (
                      <div className="mt-1.5 h-1 rounded-full bg-fg/10 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-[width] duration-300"
                          style={{ width: pct(it.progress) }}
                        />
                      </div>
                    )}
                  </div>
                  {it.status === 'failed' && (
                    <button
                      onClick={() => onRetry([it.key])}
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/10"
                      title="Retry"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {!active && it.status !== 'failed' && it.finishedAt && (
                    <span className="shrink-0 text-[11px] text-fg-dim pt-0.5">{formatTime(it.finishedAt)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default UploadPanel;
