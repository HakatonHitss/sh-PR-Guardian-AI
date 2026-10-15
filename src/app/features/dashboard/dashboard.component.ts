import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet
} from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { AppLoadingService } from '../../core/services/app-loading.service';
import { AuthService } from '../../core/services/auth.service';

type DashboardMenuItem = {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly icon:
    | 'dashboard'
    | 'pull-requests'
    | 'shield'
    | 'beaker'
    | 'sparkles'
    | 'history'
    | 'repositories'
    | 'metrics'
    | 'settings';
  readonly route?: string;
};

type DashboardInfoItem = {
  readonly label: string;
  readonly value: string;
};

const menuSubsetMatch = {
  paths: 'subset' as const,
  queryParams: 'ignored' as const,
  fragment: 'ignored' as const,
  matrixParams: 'ignored' as const
};

function navUrlMatchesMenuPath(navUrl: string, menuPath: string): boolean {
  const pathOnly = navUrl.split(/[?#]/)[0];
  return pathOnly === menuPath || pathOnly.startsWith(`${menuPath}/`);
}

function isRemoteTemplateDestination(navUrl: string): boolean {
  const pathOnly = navUrl.split(/[?#]/)[0];
  return ['/default', '/template', '/hallazgos', '/cobertura', '/asistente', '/historial', '/proyectos', '/reportes', '/configuracion'].some(path => pathOnly === path || pathOnly.startsWith(path + '/'));
}

/** Matches `c-breadcrumbs` JSON item shape (Stencil `BreadcrumbItem`). */
type ShellBreadcrumbItem = {
  readonly label: string;
  readonly href?: string;
  readonly active?: boolean;
};

const BREADCRUMB_SEGMENT_LABELS: Readonly<Record<string, string>> = {
  default: 'Inicio',
  template: 'Pull Requests',
  hallazgos: 'Hallazgos y vulnerabilidades',
  cobertura: 'Cobertura de pruebas',
  asistente: 'Asistente de revisión',
  historial: 'Historial y comparaciones',
  proyectos: 'Proyectos y repositorios',
  reportes: 'Reportes y métricas',
  configuracion: 'Configuración'
};

function buildBreadcrumbItems(pathname: string): readonly ShellBreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return [{ label: 'Inicio', active: true }];
  }

  const items: ShellBreadcrumbItem[] = [];
  let acc = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    acc += `/${segment}`;
    const isLast = i === segments.length - 1;
    const label =
      BREADCRUMB_SEGMENT_LABELS[segment] ??
      segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

    if (isLast) {
      items.push({ label, active: true });
    } else {
      items.push({ label, href: acc });
    }
  }

  return items;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, RouterLink, RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full'
  },
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly appLoading = inject(AppLoadingService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly pendingNavUrl = signal<string | null>(null);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.pendingNavUrl.set(event.url);
        if (!isRemoteTemplateDestination(event.url)) {
          this.appLoading.setRemoteLoading(false);
        }
      } else if (event instanceof NavigationEnd) {
        this.pendingNavUrl.set(null);
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        if (!isRemoteTemplateDestination(path)) {
          this.appLoading.setRemoteLoading(false);
        }
      } else if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.pendingNavUrl.set(null);
        this.appLoading.setRemoteLoading(false);
      }
    });
  }

  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url.split(/[?#]/)[0] || '/')
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] || '/' }
  );

  readonly breadcrumbItemsJson = computed(() =>
    JSON.stringify(buildBreadcrumbItems(this.currentPath()))
  );

  readonly mobileBreadcrumbBack = computed((): { readonly label: string; readonly href: string } | null => {
    const items = [...buildBreadcrumbItems(this.currentPath())];
    if (items.length < 2) {
      return null;
    }
    const parent = items[items.length - 2];
    const href = parent.href;
    if (!href) {
      return null;
    }
    return { label: parent.label, href };
  });

  onBreadcrumbClick(event: Event): void {
    const item = (event as CustomEvent<{ href?: string }>).detail;
    if (typeof item?.href === 'string' && item.href.length > 0) {
      void this.router.navigateByUrl(item.href);
    }
  }

  readonly shellInfo: readonly DashboardInfoItem[] = [
    {
      label: 'Aplicación',
      value: 'sh-PR-Guardian-AI'
    },
    {
      label: 'Ruta base',
      value: '/'
    },
    {
      label: 'Autenticación',
      value: 'Keycloak'
    }
  ];

  readonly menuItems: readonly DashboardMenuItem[] = [
    {
      path: '/default',
      label: 'Dashboard general',
      description: 'Vista general de seguridad',
      icon: 'dashboard',
      route: '/default'
    },
    {
      path: '/template',
      label: 'Pull Requests',
      description: 'Revisión y estados',
      icon: 'pull-requests',
      route: '/template'
    },
    {
      path: '/arquetipos',
      route: '/arquetipos',
      label: 'Arquetipos',
      description: 'Estructura y lineamientos',
      icon: 'shield'
    },
    {
      path: '/hallazgos',
      route: '/hallazgos',
      label: 'Hallazgos y vulnerabilidades',
      description: 'Seguridad y calidad',
      icon: 'shield'
    },
    {
      path: '/cobertura',
      route: '/cobertura',
      label: 'Cobertura de pruebas',
      description: 'Cobertura y pruebas',
      icon: 'beaker'
    },
    {
      path: '/asistente',
      route: '/asistente',
      label: 'Asistente de revisión',
      description: 'Explicaciones y soluciones',
      icon: 'sparkles'
    },
    {
      path: '/historial',
      route: '/historial',
      label: 'Historial de decisiones',
      description: 'Aprobaciones y rechazos',
      icon: 'history'
    },
    {
      path: '/proyectos',
      route: '/proyectos',
      label: 'Proyectos y repositorios',
      description: 'Calidad por proyecto',
      icon: 'repositories'
    },
    {
      path: '/reportes',
      route: '/reportes',
      label: 'Reportes y métricas',
      description: 'Indicadores y exportaciones',
      icon: 'metrics'
    },
    {
      path: '/configuracion',
      route: '/configuracion',
      label: 'Configuración',
      description: 'Criterios de aprobación',
      icon: 'settings'
    }
  ];

  readonly isRemoteLoading = this.appLoading.remoteLoading;

  isMenuItemActive(item: DashboardMenuItem): boolean {
    const pending = this.pendingNavUrl();
    if (pending !== null) {
      return navUrlMatchesMenuPath(pending, item.path);
    }
    return this.router.isActive(item.path, menuSubsetMatch);
  }

  logout(): void {
    this.authService.logout();
  }

  get userName(): string {
    const user = this.authService.getUser();
    return this.getStringValue(user, ['name', 'preferred_username', 'given_name']) ?? 'Administrador';
  }

  get userEmail(): string {
    const user = this.authService.getUser();
    return this.getStringValue(user, ['email']) ?? 'admin@claro.com';
  }

  private getStringValue(user: Record<string, unknown>, keys: readonly string[]): string | null {
    for (const key of keys) {
      const value = user[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    return null;
  }
}
