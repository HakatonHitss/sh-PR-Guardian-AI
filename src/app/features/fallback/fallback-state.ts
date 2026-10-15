export interface FallbackState {
  remoteName: string;
  path: string;
  retries: number;
  failedAt: number;
  reason?: string;
}

let currentFallbackState: FallbackState | null = null;

export function setFallbackState(state: FallbackState): void {
  currentFallbackState = state;
}

export function getFallbackState(): FallbackState | null {
  return currentFallbackState;
}
