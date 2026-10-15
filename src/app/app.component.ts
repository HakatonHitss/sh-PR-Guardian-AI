import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingScreenComponent } from './core/components/loading-screen/loading-screen.component';
import { AppLoadingService } from './core/services/app-loading.service';

@Component({
  selector: 'app-sh-pr-guardian-ai-root',
  imports: [CommonModule, RouterOutlet, LoadingScreenComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private readonly appLoading = inject(AppLoadingService);

  constructor() {
    effect(() => {
      if (this.appLoading.initialReady()) {
        document.getElementById('sh-pr-guardian-ai-loading-screen')?.remove();
      }
    });
  }
}
