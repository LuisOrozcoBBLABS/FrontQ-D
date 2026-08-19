import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Requiere sesión iniciada; si no, va a /login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

/** Requiere un permiso concreto; si no lo tiene, va a /inicio. */
export const permissionGuard = (permission: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (auth.can(permission)) return true;
  return router.createUrlTree(['/inicio']);
};

/** Si ya hay sesión, no dejar volver al /login. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/inicio']) : true;
};

/** Si el usuario no completó su onboarding, forzarlo a /bienvenida. */
export const onboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const u = auth.currentUser();
  if (u && !u.onboardingCompleto) return router.createUrlTree(['/bienvenida']);
  return true;
};

/** /bienvenida solo para autenticados que aún no completaron el onboarding. */
export const onboardedRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  return auth.currentUser()?.onboardingCompleto ? router.createUrlTree(['/inicio']) : true;
};
