import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * Los guards son asíncronos porque al recargar la página hay que resolver la
 * sesión guardada contra /auth/me antes de decidir. Con el guard sincrónico
 * anterior, un refresco en cualquier ruta interna rebotaba al login.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!(await auth.asegurarSesion())) return router.createUrlTree(['/login']);

  // Clave temporal: no se puede usar la plataforma sin cambiarla.
  if (auth.debeCambiarPassword()) return router.createUrlTree(['/cambiar-clave']);

  return true;
};

/** Requiere un permiso concreto. El servidor igual lo valida en cada request. */
export const permissionGuard = (permission: string): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!(await auth.asegurarSesion())) return router.createUrlTree(['/login']);
  if (auth.debeCambiarPassword()) return router.createUrlTree(['/cambiar-clave']);

  return auth.can(permission) ? true : router.createUrlTree(['/inicio']);
};

/** Si ya hay sesión, no dejar volver al /login. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.asegurarSesion()) ? router.createUrlTree(['/inicio']) : true;
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
export const onboardedRedirectGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!(await auth.asegurarSesion())) return router.createUrlTree(['/login']);
  if (auth.debeCambiarPassword()) return router.createUrlTree(['/cambiar-clave']);

  return auth.currentUser()?.onboardingCompleto ? router.createUrlTree(['/inicio']) : true;
};

/** /cambiar-clave solo tiene sentido con sesión y con clave temporal pendiente. */
export const cambioClaveGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!(await auth.asegurarSesion())) return router.createUrlTree(['/login']);
  return auth.debeCambiarPassword() ? true : router.createUrlTree(['/inicio']);
};

/**
 * Modulos de IA apagados en el MVP: sus resultados son simulados. Si alguien
 * llega por URL directa, vuelve al inicio en lugar de ver numeros inventados.
 */
export const iaGuard: CanActivateFn = () => {
  const router = inject(Router);
  return environment.funcionesIA ? true : router.createUrlTree(['/inicio']);
};
