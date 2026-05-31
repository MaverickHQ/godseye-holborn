import { useEffect, useMemo, useState } from 'react';
import type { CameraSource } from '@/types';
import { getCameraSnapshotMetadata, getTrafficCameraProxyImageUrl } from '@/services/tflApi';

interface VideoPlayerProps {
  camera: CameraSource;
  onClose?: () => void;
  className?: string;
}

function formatCaptureTime(lastVerified: string | null | undefined): string {
  if (!lastVerified || !lastVerified.trim()) {
    return 'Unknown capture time';
  }

  const date = new Date(lastVerified);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown capture time';
  }

  return date.toLocaleString('en-GB');
}

export function VideoPlayer({ camera, onClose, className = '' }: VideoPlayerProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [useProxyImage, setUseProxyImage] = useState(false);
  const [observedLabel, setObservedLabel] = useState('Resolving…');
  const sourceLabel = useMemo(() => formatCaptureTime(camera.lastVerified), [camera.lastVerified]);
  const proxyImageUrl = useMemo(() => getTrafficCameraProxyImageUrl(camera.id), [camera.id]);
  const imageSrc = useProxyImage && proxyImageUrl ? proxyImageUrl : camera.streamUrl;

  useEffect(() => {
    setLoadFailed(false);
    setUseProxyImage(false);
  }, [camera.id, camera.streamUrl]);

  useEffect(() => {
    let isActive = true;
    setObservedLabel('Resolving…');

    void (async () => {
      try {
        const snapshotMetadata = await getCameraSnapshotMetadata(camera.id, camera.streamUrl);
        if (!isActive) {
          return;
        }

        const resolvedLabel = formatCaptureTime(snapshotMetadata.lastVerified);
        setObservedLabel(resolvedLabel);
      } catch {
        if (!isActive) {
          return;
        }

        setObservedLabel('Unavailable');
      }
    })();

    return () => {
      isActive = false;
    };
  }, [camera.id, camera.streamUrl]);

  function handleImageError() {
    if (!useProxyImage && proxyImageUrl && proxyImageUrl !== camera.streamUrl) {
      setUseProxyImage(true);
      setLoadFailed(false);
      return;
    }

    setLoadFailed(true);
  }

  return (
    <div className={`relative bg-slate-900 rounded-lg overflow-hidden ${className}`}>
      <img
        src={imageSrc}
        alt={`${camera.name} snapshot`}
        className="w-full h-full object-cover bg-black"
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoadFailed(false)}
        onError={handleImageError}
      />

      {loadFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <span className="text-red-400 text-sm">Snapshot unavailable</span>
            <span className="text-slate-400 text-xs">Retry on next capture poll</span>
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2">
        <span className="text-amber-300 text-[10px] bg-black/60 px-2 py-1 rounded border border-amber-400/30">
          SNAPSHOT
        </span>
      </div>

      <div className="absolute top-2 right-2">
        <span
          className={`text-xs px-2 py-1 rounded ${
            camera.provider === 'tfl' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
          }`}
        >
          {camera.provider.toUpperCase()}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
        <p className="text-xs text-slate-100">{camera.name}</p>
        <p className="text-[10px] text-slate-400 mt-1">Source timestamp: {sourceLabel}</p>
        <p className="text-[10px] text-slate-400 mt-1">Image observed: {observedLabel}</p>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="absolute bottom-2 right-2 p-2 rounded-md bg-black/50 hover:bg-black/70 transition-colors"
          aria-label="Close camera"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default VideoPlayer;
