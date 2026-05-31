import { Suspense, lazy, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveLocation, useAppStore } from '@/store/appStore';
import Header from '@/components/layout/Header';
import LeftPanel from '@/components/layout/LeftPanel';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import CityView from '@/components/city/CityView';
import CCTVGrid from '@/components/cctv/CCTVGrid';
import LazyVideoPlayer from '@/components/cctv/LazyVideoPlayer';
import { ErrorBoundary } from '@/components/core/ErrorBoundary';
import AlertBar from '@/components/core/AlertBar';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { CrimeDataProvider } from '@/contexts/CrimeDataContext';
import { CameraDataProvider } from '@/contexts/CameraDataContext';
import IntelligenceMonitor from '@/components/core/IntelligenceMonitor';

type MobileSection = 'map' | 'crime' | 'cctv';

const SettingsPanel = lazy(() => import('@/components/core/SettingsPanel'));
const ReportExport = lazy(() => import('@/components/core/ReportExport'));

function App() {
  const isMobile = useIsMobile();
  const activeLocation = useActiveLocation();
  const { selectedCamera, setSelectedCamera } = useAppStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>('map');

  function handleMobileSection(section: 'map' | 'crime' | 'cctv' | 'settings') {
    if (section === 'settings') {
      setShowSettings(prev => !prev);
      return;
    }
    setMobileSection(section as MobileSection);
  }

  return (
    <CrimeDataProvider>
      <CameraDataProvider>
        <IntelligenceMonitor />
        <div className="h-screen w-screen bg-slate-900 overflow-hidden flex flex-col">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-cyan-400 focus:text-slate-900 focus:rounded-lg focus:font-medium"
          >
            Skip to main content
          </a>

          <Header onOpenSettings={() => setShowSettings(prev => !prev)} />
          <AlertBar />

          {/* Body: crime panel | map | cctv panel */}
          <div className="flex flex-1 min-h-0">
            {/* Left panel — crime data (desktop always visible) */}
            {!isMobile && (
              <aside className="w-72 flex-shrink-0 border-r border-slate-700 bg-slate-800 overflow-hidden flex flex-col">
                <LeftPanel />
              </aside>
            )}

            {/* Main map */}
            <main id="main-content" className="flex-1 min-w-0 relative">
              <ErrorBoundary>
                <CityView targetLocation={activeLocation} />
              </ErrorBoundary>
            </main>

            {/* Right panel — CCTV feeds (desktop always visible) */}
            {!isMobile && (
              <aside className="w-80 flex-shrink-0 border-l border-slate-700 bg-slate-800 overflow-hidden flex flex-col">
                <CCTVGrid standalone />
              </aside>
            )}
          </div>

          {/* Mobile overlays */}
          <AnimatePresence>
            {isMobile && mobileSection === 'crime' && (
              <motion.div
                key="mobile-crime"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                data-testid="mobile-crime-sheet"
                className="fixed inset-0 top-12 bottom-16 bg-slate-800 z-[1200] overflow-y-auto flex flex-col pointer-events-auto"
              >
                <LeftPanel />
              </motion.div>
            )}
            {isMobile && mobileSection === 'cctv' && (
              <motion.div
                key="mobile-cctv"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                data-testid="mobile-cctv-sheet"
                className="fixed inset-0 top-12 bottom-16 bg-slate-800 z-[1200] overflow-y-auto flex flex-col pointer-events-auto"
              >
                <CCTVGrid standalone />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile bottom nav */}
          {isMobile && (
            <MobileBottomNav activeSection={mobileSection} onSectionChange={handleMobileSection} />
          )}

          {/* Mobile camera fullscreen modal */}
          <AnimatePresence>
            {isMobile && selectedCamera && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black z-[70] flex flex-col"
              >
                <div className="flex items-center justify-between p-3 bg-slate-800/95 border-b border-slate-700">
                  <span className="text-sm font-medium text-slate-100 truncate">{selectedCamera.name}</span>
                  <button
                    onClick={() => setSelectedCamera(null)}
                    className="btn-icon ml-2 shrink-0"
                    aria-label="Close camera"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ErrorBoundary>
                    <LazyVideoPlayer camera={selectedCamera} className="w-full h-full" />
                  </ErrorBoundary>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSettings && (
              <Suspense fallback={null}>
                <SettingsPanel
                  onClose={() => setShowSettings(false)}
                  onExportReport={() => {
                    setShowSettings(false);
                    setShowReport(true);
                  }}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <Suspense fallback={null}>
            <AnimatePresence>
              {showReport && <ReportExport onClose={() => setShowReport(false)} />}
            </AnimatePresence>
          </Suspense>
        </div>
      </CameraDataProvider>
    </CrimeDataProvider>
  );
}

export default App;
