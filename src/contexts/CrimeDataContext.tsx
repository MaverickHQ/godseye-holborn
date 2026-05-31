import { createContext, useContext, type ReactNode } from 'react';
import { useCrimeData, type CrimeRefreshState } from '@/hooks/useCrimeData';
import type { Crime, CrimeFilter } from '@/types';
import type { CrimePublicationCadence } from '@/services/crimeCadence';
import type { CrimeAvailability } from '@/utils/crimeAvailability';

interface CrimeDataContextValue {
  crimes: Crime[];
  filters: CrimeFilter[];
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  availability?: CrimeAvailability;
  publicationCadence: CrimePublicationCadence;
  lastUpdated: Date | null;
  refreshState: CrimeRefreshState;
  filteredCrimes: Crime[];
  monthCounts: Record<string, number>;
  selectedMonth: string | null;
  setSelectedMonth: (month: string | null) => void;
  toggleFilter: (category: string) => void;
  refresh: () => Promise<void>;
}

const CrimeDataContext = createContext<CrimeDataContextValue | null>(null);

export function CrimeDataProvider({ children }: { children: ReactNode }) {
  const value = useCrimeData(3);
  return <CrimeDataContext.Provider value={value}>{children}</CrimeDataContext.Provider>;
}

export function useCrimeContext(): CrimeDataContextValue {
  const ctx = useContext(CrimeDataContext);
  if (!ctx) throw new Error('useCrimeContext must be used within CrimeDataProvider');
  return ctx;
}
