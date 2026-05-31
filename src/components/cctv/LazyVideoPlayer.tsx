import { Suspense, lazy } from 'react';
import type { CameraSource } from '@/types';

const VideoPlayer = lazy(() => import('./VideoPlayer'));

interface LazyVideoPlayerProps {
  camera: CameraSource;
  className?: string;
}

export default function LazyVideoPlayer({ camera, className }: LazyVideoPlayerProps) {
  const frameClass = className || 'w-full min-h-[180px] aspect-video';

  return (
    <Suspense
      fallback={
        <div
          className={`${frameClass} flex items-center justify-center rounded-lg overflow-hidden bg-slate-900/60`}
        >
          <span className="text-xs text-slate-400">Loading snapshot panel…</span>
        </div>
      }
    >
      <VideoPlayer camera={camera} className={frameClass} />
    </Suspense>
  );
}
