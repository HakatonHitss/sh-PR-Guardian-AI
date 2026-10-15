import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AppLoadingService {
  private readonly _initialReady = signal(false);
  private readonly _remoteLoading = signal(false);

  readonly initialReady = this._initialReady.asReadonly();
  readonly remoteLoading = this._remoteLoading.asReadonly();

  markInitialReady(): void {
    this._initialReady.set(true);
  }

  setRemoteLoading(isLoading: boolean): void {
    this._remoteLoading.set(isLoading);
  }
}
