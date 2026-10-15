import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';

import { AppLoadingService } from '../services/app-loading.service';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const appLoading = inject(AppLoadingService);
  const authService = inject(AuthService);
  await authService.init();
  appLoading.markInitialReady();
  return true;
};
