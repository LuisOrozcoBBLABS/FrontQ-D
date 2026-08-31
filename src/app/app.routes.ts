import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
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
    path: 'login', title: 'Ingresar · Plataforma R&D',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then(m => m.Login),
  },
  {
    path: 'recuperar', title: 'Recuperar acceso · Plataforma R&D',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/recover/recover').then(m => m.Recover),
  },
  {
    path: 'cambiar-clave', title: 'Cambiar contraseña · Plataforma R&D',
    canActivate: [cambioClaveGuard],
    loadComponent: () => import('./features/change-password/change-password').then(m => m.ChangePassword),
  },
  {
    path: 'bienvenida', title: 'Bienvenida · Plataforma R&D',
    canActivate: [onboardedRedirectGuard],
    loadComponent: () => import('./features/onboarding/onboarding').then(m => m.Onboarding),
  },
  {
    path: '',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () => import('./features/shell/shell').then(m => m.Shell),
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', title: 'Inicio · Plataforma R&D', loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'perfil', title: 'Mi perfil · Plataforma R&D', loadComponent: () => import('./features/profile/profile').then(m => m.Profile) },
      {
        path: 'usuarios', title: 'Usuarios · Plataforma R&D',
        canActivate: [permissionGuard('users.manage')],
        loadComponent: () => import('./features/users/users').then(m => m.Users),
      },
      {
        path: 'grupos', title: 'Grupos · Plataforma R&D',
        canActivate: [permissionGuard('groups.manage')],
        loadComponent: () => import('./features/groups/groups').then(m => m.Groups),
      },
      { path: 'proyectos', title: 'Proyectos · Plataforma R&D', loadComponent: () => import('./features/projects/projects').then(m => m.Projects) },
      { path: 'asignaciones', title: 'Asignaciones · Plataforma R&D', loadComponent: () => import('./features/assignments/assignments').then(m => m.Assignments) },
      {
        path: 'documentos', title: 'Documentos · Plataforma R&D',
        // Cosmético: el servidor valida ai.use en cada request. Acá sirve para
        // no dejar entrar a una pantalla donde todo va a devolver 403.
        canActivate: [permissionGuard('ai.use')],
        loadComponent: () => import('./features/documents/documents').then(m => m.Documents),
      },
      // Registrar y editar un proyecto son un modal sobre la pantalla que ya
      // estaba, no una ruta propia: son tareas cortas que se hacen mirando la
      // lista o la ficha, y mandar a otra pantalla obligaba a reconstruir al
      // volver el filtro, la pagina y la fila elegida.
      //
      // Las dos rutas viejas siguen existiendo como redireccion, con la forma
      // de FUNCION de `redirectTo` porque la de cadena no puede llevar query
      // params. No es cortesia: hay enlaces guardados, y el 404 los mandaria al
      // inicio sin decir por que.
      {
        path: 'proyectos/nuevo',
        redirectTo: () => inject(Router).parseUrl('/proyectos?nuevo=1'),
      },
      {
        path: 'proyectos/:id/editar',
        redirectTo: r => inject(Router).parseUrl(`/proyectos/${r.paramMap.get('id')}?editar=1`),
      },
      { path: 'proyectos/:id', title: 'Detalle del proyecto · Plataforma R&D', loadComponent: () => import('./features/projects/project-detail').then(m => m.ProjectDetail) },
    ],
  },
  { path: '**', redirectTo: '' },
];
