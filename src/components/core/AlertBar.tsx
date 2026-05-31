import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { CRIME_LABELS } from '@/config/theme';

export default function AlertBar() {
  const notifications = useAppStore(s => s.notifications);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visible = notifications.filter(n => !dismissedIds.has(n.id));
  const topAlert = visible[0] ?? null;

  useEffect(() => {
    if (!topAlert) return;
    const timer = setTimeout(() => {
      setDismissedIds(prev => new Set([...prev, topAlert.id]));
    }, 30_000);
    return () => clearTimeout(timer);
  }, [topAlert]);

  return (
    <AnimatePresence>
      {topAlert && (
        <motion.div
          key={topAlert.id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 32, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full z-[60] overflow-hidden flex-shrink-0"
        >
          <div className="h-8 bg-amber-900/90 backdrop-blur-sm border-b border-amber-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="text-amber-200 text-[11px] font-mono uppercase tracking-widest">
                {CRIME_LABELS[topAlert.category] || topAlert.category} · {topAlert.street}
                {visible.length > 1 && (
                  <span className="text-amber-400 ml-2">+{visible.length - 1} more</span>
                )}
              </span>
            </div>
            <button
              onClick={() => setDismissedIds(prev => new Set([...prev, topAlert.id]))}
              className="text-amber-400 hover:text-amber-200 transition-colors ml-4 text-[11px] font-mono"
              aria-label="Dismiss alert"
            >
              DISMISS
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
