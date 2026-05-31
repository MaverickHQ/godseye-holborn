// Animation and view types

export type ViewState = 'city' | 'transition';

export type AnimationPhaseName = 'space' | 'uk' | 'london' | 'city';

export interface AnimationPhase {
  name: AnimationPhaseName;
  threshold: number; // 0 to 1
}

export interface AnimationState {
  phase: AnimationPhaseName;
  progress: number;
  isTransitioning: boolean;
}
