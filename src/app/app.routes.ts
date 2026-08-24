import { Routes } from '@angular/router';
import {
  authGuard,
  cambioClaveGuard,
  guestGuard,
  onboardedRedirectGuard,
  onboardingGuard,
  permissionGuard,
} from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then(m => m.Login),
  },
  {
    path: 'recuperar',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/recover/recover').then(m => m.Recover),
  },
  {
    path: 'cambiar-clave',
    canActivate: [cambioClaveGuard],
    loadComponent: () => import('./features/change-password/change-password').then(m => m.ChangePassword),
  },
  {
    path: 'bienvenida',
    canActivate: [onboardedRedirectGuard],
    loadComponent: () => import('./features/onboarding/onboarding').then(m => m.Onboarding),
  },
  {
    path: '',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () => import('./features/shell/shell').then(m => m.Shell),
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'perfil', loadComponent: () => import('./features/profile/profile').then(m => m.Profile) },
      {
        path: 'usuarios',
        canActivate: [permissionGuard('users.manage')],
        loadComponent: () => import('./features/users/users').then(m => m.Users),
      },
      {
        path: 'grupos',
        canActivate: [permissionGuard('groups.manage')],
        loadComponent: () => import('./features/groups/groups').then(m => m.Groups),
      },
      { path: 'proyectos', loadComponent: () => import('./features/projects/projects').then(m => m.Projects) },
      { path: 'asignaciones', loadComponent: () => import('./features/assignments/assignments').then(m => m.Assignments) },
      {
        path: 'documentos',
        canActivate: [permissionGuard('ai.use')],
        loadComponent: () => import('./features/documents/documents').then(m => m.Documents),
      },
      {
        path: 'proyectos/nuevo',
        canActivate: [permissionGuard('projects.create')],
        loadComponent: () => import('./features/projects/project-form').then(m => m.ProjectForm),
      },
      { path: 'proyectos/:id', loadComponent: () => import('./features/projects/project-detail').then(m => m.ProjectDetail) },
    ],
  },
  { path: '**', redirectTo: '' },
];
