import { motion } from 'framer-motion';
import { useActiveLocation, useAppStore } from '@/store/appStore';

interface SettingsPanelProps {
  onClose: () => void;
  onExportReport: () => void;
}

export default function SettingsPanel({ onClose, onExportReport }: SettingsPanelProps) {
  const activeLocation = useActiveLocation();
  const {
    mapTileStyle,
    setMapTileStyle,
    crimeSearchRadius,
    setCrimeSearchRadius,
    cameraRefreshInterval,
    setCameraRefreshInterval,
  } = useAppStore();

  const CAMERA_INTERVAL_OPTIONS = [
    { value: 60_000, label: '60s' },
    { value: 90_000, label: '90s' },
    { value: 120_000, label: '2m' },
    { value: 300_000, label: '5m' },
  ];

  const tileOptions: { value: 'dark' | 'street'; label: string }[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'street', label: 'Street' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-4 top-[60px] w-72 max-h-[calc(100vh-80px)] panel overflow-y-auto z-40"
    >
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"
            />
          </svg>
          <h2 className="text-sm font-semibold text-slate-100">Settings</h2>
        </div>
        <button onClick={onClose} className="btn-icon" aria-label="Close settings">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Map style section */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Map Style</p>
          <div className="flex gap-2 flex-wrap">
            {tileOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setMapTileStyle(value)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                  mapTileStyle === value
                    ? 'bg-cyan-400 text-slate-900'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-700" />

        {/* Data Sources */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Data Sources</p>
          <div className="space-y-4">
            {/* Crime radius slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">Crime Radius</span>
                <span className="text-xs text-cyan-400 font-mono">{crimeSearchRadius}m</span>
              </div>
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={crimeSearchRadius}
                onChange={e => setCrimeSearchRadius(Number(e.target.value))}
                className="w-full h-1.5 appearance-none rounded-full bg-slate-700 accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>100m</span>
                <span>2000m</span>
              </div>
            </div>

            {/* Camera refresh interval */}
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Camera Refresh</p>
              <div className="flex gap-1.5">
                {CAMERA_INTERVAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCameraRefreshInterval(opt.value)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      cameraRefreshInterval === opt.value
                        ? 'bg-cyan-400 text-slate-900'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-700" />

        {/* Coverage scope */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Coverage Area</p>
          <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/8 p-3">
            <p className="text-xs font-semibold text-cyan-300">{activeLocation.address}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Single-location scope (Holborn-only) for v1 reliability and data integrity.
            </p>
            <p className="text-[10px] text-slate-500 mt-2 font-mono">
              {activeLocation.lat.toFixed(4)}, {activeLocation.lng.toFixed(4)}
            </p>
          </div>
        </div>

        <div className="h-px bg-slate-700" />

        {/* Export section */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Intelligence</p>
          <button
            onClick={onExportReport}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-colors text-sm"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export Intelligence Report
          </button>
        </div>
      </div>
    </motion.div>
  );
}
