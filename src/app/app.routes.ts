import { Routes } from '@angular/router';
import { loadFederatedRoutes } from './core/federation/load-federated-routes';
import { authGuard } from './core/guards/auth.guard';

function loadWorkspaceRoute(section: string, fallbackPath: string): Promise<Routes> {
  return loadFederatedRoutes({ remoteName: 'template', exposedModule: './Routes', fallbackPath }).then(routes => {
    const route = routes.find(route => route.path === section);
    return route ? [{ ...route, path: '' }] : routes;
  });
}

export const routes: Routes = [
  { path: 'auth/error', loadComponent: () => import('./features/auth/auth-error.component').then(m => m.AuthErrorComponent) },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent), children: [
      { path: '', redirectTo: 'default', pathMatch: 'full' },
      { path: 'default', loadChildren: () => loadWorkspaceRoute('dashboard', '/default') },
      { path: 'template', loadChildren: () => loadWorkspaceRoute('pull-requests', '/template') },
      { path: 'arquetipos', loadChildren: () => loadWorkspaceRoute('arquetipos', '/arquetipos') },
      { path: 'hallazgos', loadChildren: () => loadWorkspaceRoute('hallazgos', '/hallazgos') },
      { path: 'cobertura', loadChildren: () => loadWorkspaceRoute('cobertura', '/cobertura') },
      { path: 'asistente', loadChildren: () => loadWorkspaceRoute('asistente', '/asistente') },
      { path: 'historial', loadChildren: () => loadWorkspaceRoute('historial', '/historial') },
      { path: 'bitbucket', redirectTo: 'configuracion', pathMatch: 'full' },
      { path: 'proyectos', loadChildren: () => loadWorkspaceRoute('proyectos', '/proyectos') },
      { path: 'reportes', loadChildren: () => loadWorkspaceRoute('reportes', '/reportes') },
      { path: 'configuracion', loadChildren: () => loadWorkspaceRoute('configuracion', '/configuracion') }
    ]
  },
  { path: '**', redirectTo: '' }
];