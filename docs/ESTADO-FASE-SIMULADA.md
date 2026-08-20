# Plataforma R&D · Blackbird Labs — Estado del proyecto

> Documento vivo. Se actualiza en cada avance.
> **Enfoque técnico elegido:** Front en **Angular 21** (standalone components, signals, control flow `@if/@for`) con **los mismos estilos** de la SPA de portafolio ya desplegada. **IA y base de datos SIMULADAS** al inicio (mock en el front); se conectan de verdad en una fase posterior.

## Convenciones de estado
- ✅ **HECHO** — construido y funcionando en el front Angular.
- 🟡 **SIMULADO** — funciona en la UI con datos/servicios mock (en memoria). No hay backend/DB/IA real todavía.
- ⛔ **PENDIENTE PRODUCCIÓN** — lo que falta para que eso mismo sea real en producción.

## Reglas del proyecto
- Trabajo **100% local**. **No se despliega nada** hasta orden explícita de Luis.
- No se sube a GitHub por ahora.
- Cuidado con secretos/API keys: nunca se comitean ni se exponen.
- No se toca ni se borra la SPA desplegada (`portafolio-ia/index.html`).

---

## Arquitectura (resumen)
- `portafolio-ia/index.html` → SPA de portafolio (YA desplegada, intacta).
- `portafolio-ia/plataforma-id/` → **este proyecto**.
  - `ESTADO-DEL-PROYECTO.md` → este documento.
  - `web/` → aplicación Angular 21.

El **sistema de diseño** (tokens de color, tipografías, tema claro/oscuro, componentes: botones, tarjetas, launcher/command palette, etc.) se porta desde la SPA a los estilos globales de Angular, para que la plataforma se vea idéntica.

---

## Módulos y estado

### 0. Base del proyecto
- ✅ Scaffolding **Angular 21.2** (standalone, signals, control flow `@if/@for`) en `web/`.
- ✅ Sistema de diseño **portado de la SPA** a `web/src/styles.scss` (tokens idénticos: `--accent #E5E5E5`, `--surface #121212`, tipografías Space Grotesk/Inter/JetBrains Mono, tema claro/oscuro, orbes de fondo). Verificado: se ve igual que la SPA.
- ✅ Tema claro/oscuro con `ThemeService` (persistencia en localStorage, dark por defecto) y toggle con icono inline.
- ✅ Enrutamiento con lazy loading + guards. Compila sin errores (`ng build` OK).
- ⛔ **Producción:** `environment.ts`, build de producción, hosting, variables de entorno seguras, favicon/branding definitivo.

### 1. Autenticación + Usuarios / Roles / Permisos  ✅ HECHO (con IA/DB simuladas)
Objetivo: login, y que el **admin** (jefe de innovación) cree usuarios y defina permisos.
- ✅ **Login** (`/login`) con estilos de la SPA; validación y estados de error. 🟡 Autenticación **SIMULADA**: usuarios mock en memoria/localStorage, sin contraseñas reales ni tokens (cualquier contraseña entra si el correo existe y está activo).
- ✅ **Roles**: `admin` (jefe de innovación) y `colaborador`, con permisos base por rol. Guards `authGuard`, `guestGuard`, `permissionGuard`.
- ✅ **Gestión de usuarios** (`/usuarios`, solo con permiso `users.manage`): tabla, crear/editar en modal, activar/desactivar, eliminar. Asignación de rol, grupo (Manglar/Delta/Bravo/Alpha), cargo y **permisos extra** por persona (los del rol salen bloqueados).
- ✅ **Permisos**: catálogo (8 permisos) + evaluación efectiva (rol + extras) en `AuthService.can()`. La UI del sidebar y las rutas reaccionan a los permisos.
- 🟡 **SIMULADO**: todo persiste en `localStorage` de este navegador (servicio `UsersService`).
- ⛔ **Producción:**
  - Backend real (NestJS) con auth (JWT/refresh, hash de contraseñas con bcrypt/argon2), o proveedor (Auth0/Clerk/Keycloak).
  - Base de datos (Postgres) con tablas `users`, `roles`, `permissions`, `user_permissions`.
  - Guards/roles reales en backend + front; políticas de autorización (CASL/RBAC) server-side.
  - Recuperación de contraseña, verificación de correo, bloqueo por intentos, auditoría.
  - Multi-tenant/RLS si aplica.

### 2. Grupos / Equipos de alto rendimiento (Manglar, Delta, Bravo, Alpha)  ✅ HECHO (simulado)
- ✅ Vista `/grupos` (permiso `groups.manage`): tarjetas por grupo con lema y avatares de integrantes.
- ✅ Crear / editar / eliminar grupo; **gestión de integrantes** (cada persona pertenece a un grupo; al eliminar el grupo, sus miembros quedan sin grupo).
- 🟡 SIMULADO en `GroupsService` (localStorage). Membresía guardada en `user.grupo`.
- ⛔ **Producción:** tablas `groups`, `group_members`; reglas de pertenencia (¿multi-grupo?), auditoría.

### 3. Asignación de proyectos + prioridad + notificación  ✅ HECHO (simulado)
- ✅ Desde el detalle de un proyecto, quien tiene `assignments.create` puede **Asignar a un colaborador**: elige persona, **prioridad** (urgente/alta/media/baja), fecha límite, nota y **canales** (correo / WhatsApp / Teams).
- ✅ Al asignar se **crea la notificación** y se muestra el **registro simulado de envíos** por canal (destino + "Enviado (simulado)").
- ✅ **Campana** en la topbar con contador de no leídas y panel de notificaciones (marca leídas, lleva al proyecto).
- ✅ Vista `/asignaciones`: "Mis asignaciones" (con control de estado: pendiente/aceptada/en curso/completada) y, para jefes, "Todas las asignaciones" + **bandeja de notificaciones enviadas**.
- ✅ Campo **teléfono** en el perfil (para el canal WhatsApp).
- 🟡 SIMULADO en `AssignmentsService` (localStorage). El "envío" es un registro, no un mensaje real.
- ⛔ **Producción:** automatización **n8n** → correo (Graph), **WhatsApp Cloud API** y/o **Teams (Graph)** — más barato que SMS. Webhooks firmados, reintentos, plantillas aprobadas (WhatsApp).

### 4. Perfil de usuario + onboarding inclusivo  ✅ HECHO (con IA/DB simuladas)
- ✅ **Onboarding de primer ingreso** (`/bienvenida`): al iniciar sesión un usuario sin onboarding es forzado a completar **fecha de nacimiento** y **género** (Hombre / Mujer / Prefiero no decirlo). Guard `onboardingGuard` protege toda la app; `onboardedRedirectGuard` evita repetirlo.
- ✅ **Perfil** (`/perfil`): avatar, nombre, rol, grupo, correo. Editable por el propio usuario: **foto** (subida → imagen embebida), **LinkedIn**, género y fecha de nacimiento.
- ✅ **Cargo de solo lectura** para el propio usuario (con candado "bloqueado"); lo edita el jefe/admin desde el módulo de Usuarios.
- ✅ `AuthService.currentUser` ahora es reactivo (computed): los cambios de perfil se reflejan al instante en topbar, avatar y tabla de usuarios.
- 🟡 **SIMULADO**: foto guardada como Data URL en localStorage.
- ⛔ **Producción:** almacenamiento de fotos (S3/Blob), validación/tamaño de imagen, privacidad de datos personales (habeas data), edición de cargo auditada.

### 5. Creación de proyectos de innovación  ✅ HECHO (simulado)
- ✅ Lista `/proyectos` con filtrado por permiso (`projects.viewAll` ve todo; el resto ve los propios y los de su grupo).
- ✅ Formulario `/proyectos/nuevo` con todos los campos: nombre solución, sector, problema, dolores, solución, **apps parecidas repetibles (+URL)** y el **PLUS con IA**.
- ✅ Detalle `/proyectos/:id` con enlaces a apps parecidas, bloque IA+, estado editable y borrado (autor/admin). Botones de IA visibles como “próximamente” (módulo 6).
- 🟡 SIMULADO en `ProjectsService` (localStorage).
- ⛔ **Producción:** tabla `projects` + relaciones con grupos/usuarios; adjuntos.

### 6. Funciones de IA (elegidas: #1, #2, #3, #5, #10, #12, #13)  ✅ HECHO (todas simuladas)
Motor en `core/ai.service.ts` (determinista; similitud tipo semántica con Jaccard sobre tokens).
- ✅ #1 Enriquecimiento: en el detalle, "Enriquecer con IA" → objetivo, beneficios, riesgos, KPIs, impacto/viabilidad; botón "Aplicar" marca el proyecto como Enriquecido.
- ✅ #2 Detección de duplicados: en el formulario, "Buscar ideas parecidas" → panel no bloqueante con % de similitud (verificado StockSync 25%).
- ✅ #3 Score de innovación: 6 criterios (impacto, costo, complejidad, riesgo, alineación, ROI) → total; se guarda en el proyecto.
- ✅ #5 Descubrimiento de oportunidades: vista `/oportunidades` (permiso `reports.view`) con hallazgos de fuentes internas + "Convertir en idea" (prellena el formulario).
- ✅ #10 Comité multiagente: 5 agentes (finanzas, tecnología, operaciones, riesgos, sostenibilidad) + informe consolidado con recomendación.
- ✅ #12 Generación de documentos: 5 plantillas (Business Case, Project Charter, Lean/Business Model Canvas, informe ejecutivo) con descarga .txt.
- ✅ #13 Búsqueda semántica: vista `/conocimiento` (permiso `ai.use`), consulta en lenguaje natural → proyectos rankeados por relevancia.
- 🟡 SIMULADO: sin llamadas reales; resultados deterministas.
- ⛔ **Producción (todas):** backend IA (Claude API / Ollama), **pgvector** en Postgres para embeddings/RAG, colas (BullMQ), orquestación de agentes, n8n para jobs (oportunidades) y notificaciones, export real PDF/DOCX, human-in-the-loop en enriquecimiento y comité.

---

## Cómo ejecutar (local)
```bash
cd portafolio-ia/plataforma-id/web
npm install      # solo la primera vez
npm start        # ng serve  → http://localhost:4200 (o --port 4300)
```
Cuentas de prueba (simuladas): `admin@bblabs.io` (administrador) · `ana@bblabs.io` (colaboradora). Contraseña: cualquiera.

## Registro de cambios
- Base Angular 21 + sistema de diseño de la SPA portado (styles.scss).
- Módulo 1 (Login + usuarios/roles/permisos) funcionando con datos simulados. Compila (`ng build`) y corre (`ng serve`) sin errores.
- Módulo 4 (Perfil + onboarding inclusivo) funcionando: gating de primer ingreso, edición de foto/LinkedIn/género/fecha, cargo bloqueado para el propio usuario. Compila OK.
- Módulo 2 (Grupos) y Módulo 5 (Proyectos: lista/crear/detalle) funcionando con datos simulados. Verificado: crear grupo, gestionar integrantes, crear proyecto y ver detalle. Compila OK.
- Módulo 3 (Asignaciones + prioridad + notificación) funcionando: asignar desde el proyecto, envío simulado por correo/WhatsApp/Teams, campana con no leídas, vista de asignaciones y bandeja de envíos. Verificado admin→Carlos. Compila OK.
- Módulo 6 (7 funciones de IA, simuladas) funcionando: enriquecimiento, duplicados, score, oportunidades, comité multiagente, documentos y búsqueda semántica. Verificado end-to-end. Compila OK.
- **Todas las funcionalidades pedidas están construidas (simuladas).**
- Pulido de front (pase 1): transición de vista, escala de prioridad y estados en grises, scrollbar, dashboard como home real (mis asignaciones + proyectos recientes), y búsqueda/filtros en proyectos. Compila y verificado.
- Pulido de front (pase 2): navegación móvil con drawer (hamburguesa + scrim + Escape), accesibilidad (foco atrapado en modales vía directiva `appTrapFocus`, Escape cierra modales/campana, aria en la campana), y tarjeta "Insights de IA" en el detalle del proyecto cuando está enriquecido. Compila y verificado.
- Pulido de front (pase 3): filtros y búsqueda en la tabla de Usuarios (rol/estado + contador), componente reutilizable de estado vacío (`app-empty`) adoptado en Proyectos y Asignaciones, y pestañas Resumen / IA / Gestión en el detalle del proyecto. Compila y verificado.
- Pulido de front (pase 4): sistema de toasts global (`ToastService` + `app-toasts`) para confirmaciones (perfil, usuarios, grupos, proyecto creado, oportunidad, enriquecer/score); autofocus en el login. Compila y verificado.
- Pulido de front (pase 5): diálogo de confirmación propio (`ConfirmService` + `app-confirm`, con foco atrapado) reemplazando los `confirm()` nativos en usuarios/grupos/proyecto; ordenamiento de la tabla de usuarios por columna (nombre/rol/grupo/estado). Compila y verificado.
- Rediseño de la barra de navegación (estilo referente): **cada módulo es su propia cápsula con contorno** (píldoras individuales separadas por gaps, dentro de una barra `surface-2`), activo relleno en acento — en escala de grises. Iconos de utilidad (campana, tema, avatar, salir) siguen libres sin borde. Se quitó "Perfil" de la barra (accesible por el avatar y el menú móvil) para que las 7 secciones quepan sin scroll desde 1280px. Compila y verificado.
