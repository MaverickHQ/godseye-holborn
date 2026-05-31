import { useCrimeContext } from '@/contexts/CrimeDataContext';
import { useThreatScore } from '@/hooks/useThreatScore';

const BAND_STYLES = {
  green: {
    ring: 'border-green-500/60 bg-green-500/10',
    number: 'text-green-400',
    dot: 'bg-green-500',
    label: 'text-green-500/80',
  },
  amber: {
    ring: 'border-amber-500/60 bg-amber-500/10',
    number: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'text-amber-500/80',
  },
  red: {
    ring: 'border-red-500/60 bg-red-500/10',
    number: 'text-red-400',
    dot: 'bg-red-500 animate-pulse',
    label: 'text-red-500/80',
  },
};

export default function ThreatScore() {
  const { crimes } = useCrimeContext();
  const { score, band, label } = useThreatScore(crimes);
  const styles = BAND_STYLES[band];

  return (
    <div
      className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full border ${styles.ring} cursor-default`}
      title={`Ambient threat index: ${score}/100 — derived from crime density, severity mix, and time-of-day`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      <span className={`font-mono font-bold text-sm tabular-nums leading-none ${styles.number}`}>
        {score}
      </span>
      <span
        className={`text-[10px] font-semibold tracking-widest uppercase leading-none ${styles.label}`}
      >
        {label}
      </span>
    </div>
  );
}
