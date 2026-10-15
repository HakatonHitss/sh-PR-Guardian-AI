import { Component, computed, inject } from '@angular/core';

import { AppLoadingService } from '../../services/app-loading.service';

@Component({
  selector: 'app-loading-screen',
  templateUrl: './loading-screen.component.html'
})
export class LoadingScreenComponent {
  private readonly appLoading = inject(AppLoadingService);
  readonly showLoading = computed(() => !this.appLoading.initialReady());
}
