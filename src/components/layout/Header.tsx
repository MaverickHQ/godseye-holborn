import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import ThreatScore from '@/components/core/ThreatScore';
import NotificationLog from '@/components/core/NotificationLog';

interface HeaderProps {
  onOpenSettings?: () => void;
}

export default function Header({ onOpenSettings }: HeaderProps) {
  const { unreadCount, markNotificationsRead } = useAppStore();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleBellClick = () => {
    setShowNotifications(prev => !prev);
    if (!showNotifications) markNotificationsRead();
  };

  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-GB', { hour12: false }));
  useEffect(() => {
    const id = setInterval(
      () => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false })),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <header
        data-testid="app-header"
        className="h-12 w-full bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 z-[1300] flex-shrink-0"
      >
        <div className="h-full flex items-center justify-between px-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-cyan-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="6" strokeWidth="2" />
              <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2" />
              <line x1="2" y1="12" x2="6" y2="12" strokeWidth="2" />
              <line x1="18" y1="12" x2="22" y2="12" strokeWidth="2" />
            </svg>
            <span className="font-semibold text-slate-100 font-syne">Godseye</span>
          </div>

          {/* Centre: Location pill */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-300">
              <svg
                className="w-4 h-4 text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="font-syne">Holborn, London</span>
            </div>
          </div>

          {/* Right: Action icons */}
          <div className="flex items-center gap-1">
            {/* Settings */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                data-testid="header-settings"
                className="btn-icon"
                aria-label="Settings"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            )}

            {/* Bell / notification log */}
            <button
              onClick={handleBellClick}
              data-testid="header-notifications"
              className={`btn-icon relative ${showNotifications ? 'text-amber-400 bg-slate-700/50' : ''}`}
              aria-label="Notifications"
              title="Intelligence digest"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-[9px] font-bold text-slate-900 flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <ThreatScore />
            <span className="text-xs text-slate-400 ml-2 font-mono tabular-nums">{time}</span>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showNotifications && <NotificationLog onClose={() => setShowNotifications(false)} />}
      </AnimatePresence>
    </>
  );
}
