'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Photo } from '@/types/db';
import { uploadVideo, findDuplicates, copyVideo, type DuplicateMatch } from './upload';
import { fingerprintFile } from './fingerprint';

export type UploadStatus =
  | 'queued'
  | 'checking'
  | 'converting'
  | 'compressing'
  | 'uploading'
  | 'saving'
  | 'done'
  | 'replaced'
  | 'copied'
  | 'skipped'
  | 'cancelled'
  | 'failed';

export interface UploadItem {
  key: string;
  file: File;
  status: UploadStatus;
  /** 0–1 within the current stage (converting / compressing). */
  progress: number;
  /** Failure reason, or context for skipped / copied rows. */
  detail?: string;
  startedAt?: number;
  finishedAt?: number;
  /** Output size once uploaded. */
  bytes?: number;
}

export const ACTIVE_STATUSES: UploadStatus[] = ['checking', 'converting', 'compressing', 'uploading', 'saving'];
export const FINISHED_STATUSES: UploadStatus[] = ['done', 'replaced', 'copied', 'skipped', 'cancelled', 'failed'];

/** 'here' = already in this album; 'elsewhere' = only in other albums. */
export type DuplicateKind = 'here' | 'elsewhere';
export type DuplicateChoice = 'replace' | 'copy' | 'upload' | 'skip' | 'cancel';

export interface DuplicatePrompt {
  file: File;
  kind: DuplicateKind;
  matches: DuplicateMatch[];
  remaining: number;
}

/** Rough share of a file's total work each stage represents, for the overall bar. */
export function itemFraction(item: UploadItem): number {
  switch (item.status) {
    case 'queued': return 0;
    case 'checking': return 0.02;
    case 'converting': return 0.02 + item.progress * 0.5;
    case 'compressing': return 0.05 + item.progress * 0.8;
    case 'uploading': return 0.9;
    case 'saving': return 0.97;
    default: return 1;
  }
}

interface Options {
  albumId: string;
  onAdded: (video: Photo) => void;
  /** New upload replacing existing copies in this album. */
  onReplaced: (video: Photo, oldIds: string[]) => void;
}

let keySeq = 0;

/**
 * A persistent upload queue, Google-Drive style: files can be added while a
 * batch is running, each one is processed in turn (compression already
 * saturates the encoder), and a failure is recorded on that row without
 * stopping the rest.
 */
export function useVideoUploads({ albumId, onAdded, onReplaced }: Options) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);

  const itemsRef = useRef<UploadItem[]>([]);
  const running = useRef(false);
  const resolveDuplicate = useRef<((a: { choice: DuplicateChoice; applyToAll: boolean }) => void) | null>(null);
  // "Do this for every remaining…" answers; cleared when the queue drains
  const remembered = useRef<Partial<Record<DuplicateKind, DuplicateChoice>>>({});
  const callbacks = useRef({ onAdded, onReplaced });
  useEffect(() => { callbacks.current = { onAdded, onReplaced }; });

  const update = useCallback((key: string, patch: Partial<UploadItem>) => {
    itemsRef.current = itemsRef.current.map((it) => (it.key === key ? { ...it, ...patch } : it));
    setItems(itemsRef.current);
  }, []);

  const askDuplicate = (prompt: DuplicatePrompt) =>
    new Promise<{ choice: DuplicateChoice; applyToAll: boolean }>((resolve) => {
      resolveDuplicate.current = resolve;
      setDuplicatePrompt(prompt);
    });

  const answerDuplicate = useCallback((choice: DuplicateChoice, applyToAll: boolean) => {
    setDuplicatePrompt(null);
    resolveDuplicate.current?.({ choice, applyToAll });
    resolveDuplicate.current = null;
  }, []);

  const cancelQueued = useCallback(() => {
    itemsRef.current = itemsRef.current.map((it) =>
      it.status === 'queued' ? { ...it, status: 'cancelled', finishedAt: Date.now() } : it
    );
    setItems(itemsRef.current);
  }, []);

  const processItem = async (item: UploadItem) => {
    const { key, file } = item;
    update(key, { status: 'checking', startedAt: Date.now(), progress: 0 });

    const fingerprint = await fingerprintFile(file);
    const matches = await findDuplicates(fingerprint, file.name);
    const here = matches.filter((m) => m.albumId === albumId);
    const elsewhere = matches.filter((m) => m.albumId !== albumId);

    let choice: DuplicateChoice = 'upload';
    if (matches.length > 0) {
      const kind: DuplicateKind = here.length > 0 ? 'here' : 'elsewhere';
      const known = remembered.current[kind];
      if (known) {
        choice = known;
      } else {
        const answer = await askDuplicate({
          file,
          kind,
          matches: kind === 'here' ? here : elsewhere,
          remaining: itemsRef.current.filter((it) => it.status === 'queued').length,
        });
        choice = answer.choice;
        if (answer.applyToAll && choice !== 'cancel') remembered.current[kind] = choice;
      }
    }

    if (choice === 'cancel') {
      update(key, { status: 'cancelled', finishedAt: Date.now() });
      cancelQueued();
      return;
    }
    if (choice === 'skip') {
      const where = here.length ? 'this album' : elsewhere[0].albumName;
      update(key, { status: 'skipped', detail: `Already in ${where}`, finishedAt: Date.now() });
      return;
    }
    if (choice === 'copy') {
      const video = await copyVideo(elsewhere[0].id, albumId);
      callbacks.current.onAdded(video);
      update(key, {
        status: 'copied',
        detail: `Copied from ${elsewhere[0].albumName}`,
        bytes: video.bytes ?? undefined,
        finishedAt: Date.now(),
      });
      return;
    }

    const video = await uploadVideo(file, albumId, fingerprint, (s) =>
      update(key, { status: s.stage, progress: 'progress' in s ? s.progress : 0 })
    );
    if (choice === 'replace') {
      const oldIds = here.map((m) => m.id);
      await Promise.all(oldIds.map((oid) => fetch(`/api/photos/${oid}`, { method: 'DELETE' })));
      callbacks.current.onReplaced(video, oldIds);
      update(key, { status: 'replaced', bytes: video.bytes ?? undefined, finishedAt: Date.now() });
    } else {
      callbacks.current.onAdded(video);
      update(key, { status: 'done', bytes: video.bytes ?? undefined, finishedAt: Date.now() });
    }
  };

  const run = async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find((it) => it.status === 'queued');
        if (!next) break;
        try {
          await processItem(next);
        } catch (err) {
          update(next.key, {
            status: 'failed',
            detail: err instanceof Error ? err.message : 'Upload failed',
            finishedAt: Date.now(),
          });
        }
      }
    } finally {
      running.current = false;
      remembered.current = {};
    }
  };

  const enqueue = (files: File[]) => {
    if (files.length === 0) return;
    const added = files.map<UploadItem>((file) => ({
      key: `u${++keySeq}`,
      file,
      status: 'queued',
      progress: 0,
    }));
    itemsRef.current = [...itemsRef.current, ...added];
    setItems(itemsRef.current);
    void run();
  };

  const retry = (keys?: string[]) => {
    const want = keys ? new Set(keys) : null;
    itemsRef.current = itemsRef.current.map((it) =>
      it.status === 'failed' && (!want || want.has(it.key))
        ? { ...it, status: 'queued', progress: 0, detail: undefined, startedAt: undefined, finishedAt: undefined }
        : it
    );
    setItems(itemsRef.current);
    void run();
  };

  /** Removes finished rows (the panel's close button). */
  const clearFinished = () => {
    itemsRef.current = itemsRef.current.filter((it) => !FINISHED_STATUSES.includes(it.status));
    setItems(itemsRef.current);
  };

  const busy = items.some((it) => it.status === 'queued' || ACTIVE_STATUSES.includes(it.status));

  // Leaving mid-batch would silently drop the rest of the queue
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  return {
    items,
    busy,
    enqueue,
    retry,
    cancelQueued,
    clearFinished,
    duplicatePrompt,
    answerDuplicate,
  };
}
