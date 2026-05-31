// Core types for Godseye Holborn
// Re-export all types from domain-specific files for backwards compatibility

// Coordinates (shared)
export type { Coordinates } from './coordinates.types';

// Camera types
export type { CameraProvider, CameraType, CameraStatus, StreamStatus } from './camera.types';
export type { CameraSource } from './camera.types';

// Crime types
export type { CrimeCategory } from './crime.types';
export type { CrimeLocation } from './crime.types';
export type { Crime } from './crime.types';
export type { CrimeFilter } from './crime.types';
export type { PoliceApiResponse } from './crime.types';

// Animation and view types
export type { ViewState, AnimationPhaseName, AnimationPhase, AnimationState } from './animation.types';
