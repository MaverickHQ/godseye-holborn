import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { CRIME_LABELS, CRIME_COLORS } from '@/config/theme';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface NotificationLogProps {
  onClose: () => void;
}

export default function NotificationLog({ onClose }: NotificationLogProps) {
  const { notifications, clearNotifications } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      className="fixed right-4 top-[52px] w-80 panel overflow-hidden z-50 shadow-2xl"
    >
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="text-sm font-semibold text-slate-100">Intelligence Digest</span>
          {notifications.length > 0 && (
            <span className="text-xs text-slate-400">— {notifications.length} recorded</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors"
            >
              Clear
            </button>
          )}
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center">
            <svg
              className="w-8 h-8 text-slate-700 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-slate-500">No alerts this session</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {notifications.map(n => {
              const color = CRIME_COLORS[n.category] || '#64748B';
              const label = CRIME_LABELS[n.category] || n.category;
              return (
                <li
                  key={n.id}
                  className="flex items-stretch hover:bg-slate-700/20 transition-colors"
                >
                  <div
                    className="w-0.5 flex-shrink-0 my-1 rounded-full ml-3"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 px-3 py-2.5 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium truncate" style={{ color }}>
                        {label}
                      </span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0 tabular-nums">
                        {timeAgo(n.detectedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{n.street}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
