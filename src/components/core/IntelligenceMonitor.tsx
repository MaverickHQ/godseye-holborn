import { useCrimeContext } from '@/contexts/CrimeDataContext';
import { useIntelligenceAlerts } from '@/hooks/useIntelligenceAlerts';

export default function IntelligenceMonitor() {
  const { crimes, isLoading } = useCrimeContext();
  useIntelligenceAlerts(crimes, isLoading);
  return null;
}
