import { memo, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAppStore } from '@/store/appStore';
import { useCrimeContext } from '@/contexts/CrimeDataContext';
import { useCameraContext } from '@/contexts/CameraDataContext';
import { CRIME_COLORS, CRIME_LABELS } from '@/config/theme';
import type { CameraSource, Crime, StreamStatus } from '@/types';
import { buildCrimeClusters, type CrimeCluster } from './crimeClusters';

interface CityViewProps {
  targetLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
}

function MapController({ lat, lng, zoom = 16 }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.invalidateSize();
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  
  return null;
}

function SelectedCrimeController({ crimes }: { crimes: Crime[] }) {
  const map = useMap();
  const selectedCrimeId = useAppStore(s => s.selectedCrimeId);

  useEffect(() => {
    if (!selectedCrimeId) return;
    const crime = crimes.find(c => c.id === selectedCrimeId);
    if (!crime) return;

    map.setView([crime.location.lat, crime.location.lng], 18);
  }, [selectedCrimeId, crimes, map]);

  return null;
}

const CameraMarkerComponent = memo(function CameraMarkerComponent({
  camera,
  status,
}: {
  camera: CameraSource;
  status: StreamStatus;
}) {
  const isSelected = useAppStore(s => s.selectedCamera?.id === camera.id);
  const setSelectedCamera = useAppStore(s => s.setSelectedCamera);
  
  // Status colors
  const statusColor =
    status === 'snapshot'
      ? '#F59E0B'
      : status === 'snapshot-aged'
        ? '#0EA5E9'
      : status === 'loading'
        ? '#38BDF8'
        : status === 'stale'
          ? '#FB923C'
          : '#EF4444';
  
  return (
    <Marker
      position={[camera.coordinates.lat, camera.coordinates.lng]}
      icon={L.divIcon({
        html: `
          <div class="relative ${isSelected ? 'scale-125' : ''} transition-transform">
            <div class="w-8 h-8 flex items-center justify-center bg-slate-800/90 rounded-lg border-2 border-[${statusColor}]">
              <svg class="w-5 h-5 text-[${statusColor}]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </div>
            <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[${statusColor}] ${status === 'stale' ? 'animate-pulse' : ''}"></div>
          </div>
        `,
        className: 'camera-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })}
      eventHandlers={{
        click: () => setSelectedCamera(camera),
      }}
    >
      <Popup>
        <div className="bg-slate-800 text-slate-100 p-2 rounded-lg">
          <div className="font-semibold text-blue-400 mb-1">{camera.name}</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
            <span className="uppercase">{status}</span>
          </div>
          <div className="text-slate-400 mt-1 font-mono text-xs">
            {camera.coordinates.lat.toFixed(4)}, {camera.coordinates.lng.toFixed(4)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}, (prev, next) =>
  prev.status === next.status &&
  prev.camera.id === next.camera.id &&
  prev.camera.name === next.camera.name &&
  prev.camera.coordinates.lat === next.camera.coordinates.lat &&
  prev.camera.coordinates.lng === next.camera.coordinates.lng,
);

const CrimeMarkerComponent = memo(function CrimeMarkerComponent({ crime }: { crime: Crime }) {
  const selected = useAppStore(s => s.selectedCrimeId === crime.id);
  const setSelectedCrimeId = useAppStore(s => s.setSelectedCrimeId);
  const crimeColor = CRIME_COLORS[crime.category] || '#64748B';
  const markerSize = selected ? 32 : 24;
  const iconAnchor = markerSize / 2;
  
  return (
    <Marker
      position={[crime.location.lat, crime.location.lng]}
      icon={L.divIcon({
        html: `
          <div class="w-${markerSize} h-${markerSize} flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" title="${CRIME_LABELS[crime.category] || crime.category}">
            <svg class="w-${markerSize} h-${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}">
              ${selected ? `<circle cx="${iconAnchor}" cy="${iconAnchor}" r="${iconAnchor - 2}" fill="none" stroke="#22D3EE" stroke-width="2"/>` : ''}
              <circle cx="${iconAnchor}" cy="${iconAnchor}" r="${selected ? iconAnchor - 8 : iconAnchor - 4}" fill="${crimeColor}" opacity="0.75"/>
              <circle cx="${iconAnchor}" cy="${iconAnchor}" r="${selected ? iconAnchor - 11 : iconAnchor - 8}" fill="${crimeColor}"/>
            </svg>
          </div>
        `,
        className: 'crime-marker',
        iconSize: [markerSize, markerSize],
        iconAnchor: [iconAnchor, iconAnchor],
      })}
      eventHandlers={{
        click: () => setSelectedCrimeId(crime.id),
      }}
    >
      <Popup>
        <div className="bg-slate-800 text-slate-100 p-2 rounded-lg">
          <div className="font-semibold mb-1" style={{ color: crimeColor }}>
            {CRIME_LABELS[crime.category] || crime.category}
          </div>
          <div className="text-slate-400 text-sm">{crime.street?.name || 'Unknown location'}</div>
          <div className="text-slate-500 text-xs mt-1">{crime.month}</div>
        </div>
      </Popup>
    </Marker>
  );
}, (prev, next) =>
  prev.crime.id === next.crime.id &&
  prev.crime.category === next.crime.category &&
  prev.crime.month === next.crime.month &&
  prev.crime.location.lat === next.crime.location.lat &&
  prev.crime.location.lng === next.crime.location.lng,
);

function CrimeClusterMarkerComponent({ cluster }: { cluster: CrimeCluster }) {
  const markerSize = Math.min(44, 20 + cluster.count * 3);
  const iconAnchor = markerSize / 2;
  const color = CRIME_COLORS[cluster.category] || '#64748B';

  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={L.divIcon({
        html: `
          <div class="w-${markerSize} h-${markerSize} flex items-center justify-center rounded-full border border-slate-200/15" style="background:${color}33;">
            <div class="w-${Math.max(18, markerSize - 10)} h-${Math.max(18, markerSize - 10)} rounded-full flex items-center justify-center" style="background:${color}AA;">
              <span class="text-white font-semibold text-xs">${cluster.count}</span>
            </div>
          </div>
        `,
        className: 'crime-cluster-marker',
        iconSize: [markerSize, markerSize],
        iconAnchor: [iconAnchor, iconAnchor],
      })}
    >
      <Popup>
        <div className="bg-slate-800 text-slate-100 p-2 rounded-lg">
          <div className="font-semibold mb-1 text-cyan-300">Crime cluster</div>
          <div className="text-slate-400 text-sm">{cluster.count} incidents in this area</div>
        </div>
      </Popup>
    </Marker>
  );
}

function TargetMarkerComponent({ location }: { location: { name: string; address: string; lat: number; lng: number } }) {
  return (
    <Marker
      position={[location.lat, location.lng]}
      icon={L.divIcon({
        html: `
          <div class="relative">
            <div class="w-12 h-12 flex items-center justify-center">
              <svg class="w-12 h-12" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="#3B82F6" stroke-width="2"/>
                <circle cx="12" cy="12" r="6" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.5"/>
                <circle cx="12" cy="12" r="2" fill="#3B82F6"/>
              </svg>
            </div>
          </div>
        `,
        className: 'target-marker',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      })}
    >
      <Popup>
        <div className="bg-slate-800 text-slate-100 p-2 rounded-lg">
          <div className="font-semibold text-blue-400 mb-1">{location.name}</div>
          <div className="text-slate-400 text-sm">{location.address}</div>
          <div className="text-blue-400 mt-1 text-xs font-medium">TARGET LOCATION</div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function CityView({ targetLocation }: CityViewProps) {
  const showHeatmap = useAppStore(s => s.showHeatmap);
  const mapTileStyle = useAppStore(s => s.mapTileStyle);
  const selectedCrimeId = useAppStore(s => s.selectedCrimeId);
  const setSelectedCrimeId = useAppStore(s => s.setSelectedCrimeId);
  const { cameras, statuses } = useCameraContext();
  const { filteredCrimes } = useCrimeContext();
  const crimeClusters = useMemo(() => buildCrimeClusters(filteredCrimes), [filteredCrimes]);
  const mapCenter = useMemo<[number, number]>(
    () => [targetLocation.lat, targetLocation.lng],
    [targetLocation.lat, targetLocation.lng],
  );
  const tileConfig = useMemo(
    () =>
      mapTileStyle === 'street'
        ? {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          }
        : {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          },
    [mapTileStyle],
  );
  const cameraMarkers = useMemo(
    () =>
      cameras.map(camera => (
        <CameraMarkerComponent key={camera.id} camera={camera} status={statuses[camera.id] || 'offline'} />
      )),
    [cameras, statuses],
  );
  const crimeLayers = useMemo(
    () =>
      showHeatmap
        ? crimeClusters.map(cluster => <CrimeClusterMarkerComponent key={cluster.id} cluster={cluster} />)
        : filteredCrimes.map(crime => <CrimeMarkerComponent key={crime.id} crime={crime} />),
    [showHeatmap, crimeClusters, filteredCrimes],
  );

  useEffect(() => {
    if (!selectedCrimeId) {
      return;
    }

    const stillVisible = filteredCrimes.some(crime => crime.id === selectedCrimeId);
    if (!stillVisible) {
      setSelectedCrimeId(null);
    }
  }, [filteredCrimes, selectedCrimeId, setSelectedCrimeId]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={mapCenter}
        zoom={16}
        className="w-full h-full"
        zoomControl={false}
      >
        <MapController lat={targetLocation.lat} lng={targetLocation.lng} />
        <SelectedCrimeController crimes={filteredCrimes} />
        
        {/* Map tiles */}
        <TileLayer
          attribution={tileConfig.attribution}
          url={tileConfig.url}
        />
        
        {/* Camera markers */}
        {cameraMarkers}
        
        {/* Crime markers / clusters */}
        {crimeLayers}
        
        {/* Target marker */}
        <TargetMarkerComponent location={targetLocation} />
      </MapContainer>
    </div>
  );
}
