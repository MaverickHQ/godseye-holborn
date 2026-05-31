// Theme constants for Godseye Holborn - v4 Design System

export const THEME = {
  // Colors - Slate 900 dark palette with Blue 500 accent
  colors: {
    // Base
    background: '#0F172A',    // Slate 900
    surface: '#1E293B',       // Slate 800
    surfaceHover: '#334155',  // Slate 700
    border: '#334155',         // Slate 700
    
    // Accent
    accent: '#3B82F6',        // Blue 500
    accentHover: '#2563EB',   // Blue 600
    accentMuted: '#3B82F620', // Blue 500 at 12% opacity
    
    // Semantic
    danger: '#EF4444',        // Red 500
    success: '#22C55E',        // Green 500
    warning: '#F59E0B',        // Amber 500
    
    // Text
    textPrimary: '#F8FAFC',    // Slate 50
    textSecondary: '#94A3B8',  // Slate 400
    textMuted: '#64748B',      // Slate 500
    
    // Legacy aliases for backwards compatibility during transition
    deepSpace: '#0F172A',
    panelDark: '#1E293B',
    panelMedium: '#334155',
    gridBlue: '#475569',
    cyanAccent: '#3B82F6',
    alertRed: '#EF4444',
    liveGreen: '#22C55E',
    infoBlue: '#3B82F6',
    warningGold: '#F59E0B',
    textPrimaryLegacy: '#F8FAFC',
    textSecondaryLegacy: '#94A3B8',
  },
  
  // Typography
  fonts: {
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    sans: "'Inter', system-ui, sans-serif",
  },
  
  // Animation
  animation: {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
      transition: 7000,
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  
  // Effects
  effects: {
    panel: {
      blur: 12,
      opacity: 0.95,
    },
    borderRadius: {
      sm: 6,
      md: 8,
      lg: 12,
      xl: 16,
    },
  },
  
  // Layout
  layout: {
    borderRadius: 8,
    borderRadiusLg: 12,
    sidebarWidth: 56,      // Collapsed icon sidebar
    sidebarExpanded: 240,   // Expanded sidebar
    navbarHeight: 48,
    panelMaxHeight: '40vh',
    padding: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
  },
} as const;

// Crime category colors
export const CRIME_COLORS: Record<string, string> = {
  'anti-social-behaviour': '#64748B',
  'bicycle-theft': '#3B82F6',
  'burglary': '#F59E0B',
  'criminal-damage-arson': '#EF4444',
  'drugs': '#8B5CF6',
  'other-crime': '#EF4444',
  'other-theft': '#F97316',
  'possession-of-weapons': '#EF4444',
  'public-order': '#3B82F6',
  'robbery': '#EF4444',
  'shoplifting': '#22C55E',
  'theft-from-the-person': '#EAB308',
  'vehicle-crime': '#14B8A6',
  'violent-crime': '#EF4444',
};

// Camera status colors
export const STATUS_COLORS = {
  live: THEME.colors.success,
  offline: THEME.colors.danger,
  loading: THEME.colors.warning,
  error: THEME.colors.danger,
} as const;

// Crime category labels
export const CRIME_LABELS: Record<string, string> = {
  'anti-social-behaviour': 'ASB',
  'bicycle-theft': 'Bike Theft',
  'burglary': 'Burglary',
  'criminal-damage-arson': 'Criminal Damage',
  'drugs': 'Drugs',
  'other-crime': 'Other Crime',
  'other-theft': 'Other Theft',
  'possession-of-weapons': 'Weapons',
  'public-order': 'Public Order',
  'robbery': 'Robbery',
  'shoplifting': 'Shoplifting',
  'theft-from-the-person': 'Pickpocket',
  'vehicle-crime': 'Vehicle Crime',
  'violent-crime': 'Violent Crime',
} as const;

export default THEME;
