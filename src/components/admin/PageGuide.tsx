'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageGuideProps {
  pageKey: string;
  icon: React.ReactNode;
  title: string;
  about: string;
  steps: string[];
}

export default function PageGuide({ pageKey, icon, title, about, steps }: PageGuideProps) {
  const storageKey = `frametv:guide:${pageKey}`;
  const [dismissed, setDismissed] = useState(true);
  const [tab, setTab] = useState<'about' | 'how'>('about');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(storageKey)) setDismissed(false);
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  if (!mounted) return null;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => { setDismissed(false); setTab('about'); }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
      >
        <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-[10px] font-bold leading-none">?</span>
        Guide
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="bg-card border border-border rounded-2xl overflow-hidden mb-4"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3">
          {(['about', 'how'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                tab === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:border-primary/40'
              )}
            >
              {t === 'about' ? 'What is this?' : 'How to'}
            </button>
          ))}
        </div>

        <div className="px-4 py-4">
          {tab === 'about' ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{about}</p>
          ) : (
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
