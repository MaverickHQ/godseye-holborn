// Crime types

export type CrimeCategory = 
  | 'anti-social-behaviour'
  | 'bicycle-theft'
  | 'burglary'
  | 'criminal-damage-arson'
  | 'drugs'
  | 'other-crime'
  | 'other-theft'
  | 'possession-of-weapons'
  | 'public-order'
  | 'robbery'
  | 'shoplifting'
  | 'theft-from-the-person'
  | 'vehicle-crime'
  | 'violent-crime';

export interface CrimeLocation {
  lat: number;
  lng: number;
}

export interface Crime {
  id: string;
  category: CrimeCategory;
  location: CrimeLocation;
  street: {
    id: string | number;
    name: string;
  };
  context?: string;
  outcomeStatus?: string;
  persistentId?: string;
  month: string;
  date?: Date;
}

export interface CrimeFilter {
  category: CrimeCategory;
  enabled: boolean;
}

// Police API response type
export interface PoliceApiResponse {
  status: number;
  crimes: Crime[];
}
