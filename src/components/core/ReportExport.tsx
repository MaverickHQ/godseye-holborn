import { useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useCrimeContext } from '@/contexts/CrimeDataContext';
import { useThreatScore } from '@/hooks/useThreatScore';
import { CRIME_LABELS } from '@/config/theme';
import { CAMERA_SOURCES, TARGET_LOCATION } from '@/config/cameraSources';

interface ReportExportProps {
  onClose: () => void;
}

const BAND_COLOR = { green: '#22C55E', amber: '#F59E0B', red: '#EF4444' };

export default function ReportExport({ onClose }: ReportExportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { crimes } = useCrimeContext();
  const { score, band, label } = useThreatScore(crimes);

  const topCategories = useMemo(() => {
    const counts = crimes.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [crimes]);

  const now = new Date();
  const timestamp = now.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  async function handleExport() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0F172A',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`godseye-report-${now.toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        className="w-[540px] max-h-[90vh] overflow-y-auto panel shadow-2xl"
      >
        {/* Modal header */}
        <div className="panel-header">
          <div className="flex items-center gap-2">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-sm font-semibold text-slate-100">Intelligence Report</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400/20 text-cyan-400 border border-cyan-400/40 text-xs font-medium hover:bg-cyan-400/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <svg
                  className="w-3.5 h-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              )}
              <span>{exporting ? 'Exporting…' : 'Export PDF'}</span>
            </button>
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

        {/* Report preview — this div is captured by html2canvas */}
        <div ref={reportRef} className="bg-slate-900 p-6 space-y-5">
          {/* Header */}
          <div className="border-b border-slate-700 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-5 h-5 text-cyan-400"
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
              <span className="text-base font-semibold text-slate-100 font-syne">GODSEYE</span>
              <span className="text-xs text-slate-500 ml-2">INTELLIGENCE BRIEF</span>
            </div>
            <p className="text-xs text-slate-500">
              {TARGET_LOCATION.name} · {TARGET_LOCATION.lat.toFixed(4)}°N,{' '}
              {Math.abs(TARGET_LOCATION.lng).toFixed(4)}°W · {timestamp}
            </p>
          </div>

          {/* Threat score */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center border-2 flex-shrink-0"
              style={{ borderColor: BAND_COLOR[band], boxShadow: `0 0 20px ${BAND_COLOR[band]}40` }}
            >
              <span className="text-2xl font-bold tabular-nums" style={{ color: BAND_COLOR[band] }}>
                {score}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
                Ambient Threat
              </p>
              <p className="text-lg font-semibold" style={{ color: BAND_COLOR[band] }}>
                {label}
              </p>
              <p className="text-xs text-slate-400">
                Based on {crimes.length} incidents · 3-month window
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Incidents', value: crimes.length },
              { label: 'Cameras', value: CAMERA_SOURCES.length },
            ].map(({ label: l, value }) => (
              <div
                key={l}
                className="bg-slate-800 rounded-lg p-3 text-center border border-slate-700"
              >
                <p className="text-2xl font-bold text-slate-100 tabular-nums">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{l}</p>
              </div>
            ))}
          </div>

          {/* Top crime categories */}
          {topCategories.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">
                Top Incident Types
              </p>
              <div className="space-y-1.5">
                {topCategories.map(([cat, count]) => {
                  const pct = Math.round((count / crimes.length) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-xs text-slate-300 w-36 truncate">
                        {CRIME_LABELS[cat] || cat}
                      </span>
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums w-8 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-[10px] text-slate-600 pt-1">
            CONFIDENTIAL — Godseye Holborn Intelligence Platform · Crime data: data.police.uk · For
            authorised use only
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
