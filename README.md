# FrontQ-D — Plataforma R&D

Interfaz de la plataforma de Innovación y Desarrollo de Blackbird Labs (equipo QR&D).
Consume la API de [BackQ-D](https://github.com/LuisOrozcoBBLABS/BackQ-D).

- **Stack:** Angular 21 (standalone components, signals, control flow `@if`/`@for`) + SCSS
- **Identidad:** manual de marca Blackbird Labs powered by Riwi — tipografía Montserrat,
  Neon Lime `#B2EA36` como acento, Obsidian Black `#0B0A07` como base.

## Prerrequisitos

- Node.js 20+ (recomendado: 22 LTS)
- npm 11+
- [BackQ-D](https://github.com/LuisOrozcoBBLABS/BackQ-D) corriendo en `localhost:3000`

## Arrancar en local

```bash
npm install
```

```bash
npm start
```

Queda en `http://localhost:4300` (el CORS del backend espera ese puerto).
Para que la aplicación tenga datos, la API de BackQ-D debe estar corriendo en
`http://localhost:3000`.

## Testing

```bash
npm test          # Vitest, 41 tests
npm run lint:css  # stylelint sobre los .scss
```

Los tests usan **Vitest**. Qué cubren, con precisión: `core/tiempos.ts` (22),
`core/transiciones.ts` (8, incluido que `completada` es final igual que en el
servidor), `core/models.ts` con la etapa vecina del tablero (5), el interceptor
de autenticación (4, incluido el caso en que la renovación falla) y dos de humo
sobre `App`. **No hay** tests de componentes de pantalla ni de guards.

`npm run lint:css` no es cosmético: rechaza px crudos en `padding`/`margin`/`gap`
fuera de la escala de 4pt, selectores de elemento fuera de capa y selectores
duplicados. Las tres reglas existen porque las tres causaron defectos reales.

Los tres comandos —tipos, estilos, compilación y tests— corren solos en cada
pull request desde `.github/workflows/ci.yml`. Ese workflow **no despliega**: el
despliegue vive en `deploy-pages.yml` y solo dispara con push a `main`.

## Variables de entorno

El front no necesita `.env` — la URL de la API está en `src/environments/`. Si
necesitás apuntar a otro backend, editá `environment.ts`.

## Cómo está organizado

```
src/
├── styles.scss          sistema de diseño: paleta de marca, escala tipográfica, 4pt
├── index.html           carga Montserrat
└── app/
    ├── core/            servicios de datos, modelos y guards
    ├── ui/              componentes compartidos
    │   ├── nav-rail/    dock de módulos en cristal líquido
    │   └── theme-toggle
    └── features/        una carpeta por módulo (login, proyectos, grupos, …)
public/brand/            isotipo y logo oficiales, en blanco y negro
```

## Sistema de diseño

Todo sale de tokens en `styles.scss`; no hay colores ni tamaños escritos a mano
en los componentes.

| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#B2EA36` Neon Lime | Indicador activo, botón primario, foco |
| `--on-accent` | `#0B0A07` Obsidian | Texto e iconos **sobre** el lime |
| `--accent-text` | lime en oscuro · `#55730F` en claro | Texto en color de acento |
| `--fs-*` | 11 → 40px, paso 1.20 | Escala tipográfica |
| `--sp-*` | 4 → 64px | Ritmo de espaciado de 4pt |
| `--r-*` | 10 → 28px, `999px` | Radios |

El lime nunca se usa como color de texto sobre fondo claro: no alcanza 4.5:1 de
contraste. Para ese caso está `--accent-text`, que en tema claro es una sombra
del mismo tono.

## Navegación

**No hay barra superior.** Todo el chrome vive en un riel flotante
(`ui/nav-rail`): la baldosa de marca, los módulos y las utilidades (avisos,
tema, perfil, salir). Cápsula de cristal líquido con iconos; el nombre se
despliega al pasar el cursor o al enfocar con teclado, y el indicador activo se
desliza entre posiciones. En pantallas angostas el riel baja y se acuesta.

El fondo lleva la identidad del área: **R&D** en grande, con relleno degradado
al 7% en oscuro y 12% en claro, y trazo hairline. Va detrás de todo y no recibe
eventos.

El isotipo oficial viene sobre su cuadro obsidiana, así que se usa como
**baldosa redondeada** y no como icono suelto: de la otra forma se veía sucio
sobre el cristal en tema oscuro.

## Pantallas de acceso

Ingreso, recuperación y cambio de contraseña comparten un mismo lenguaje
minimalista: sin tarjeta ni caja, el contenido apoyado directo en el fondo con la
marca de agua `R&D` detrás, y campos que son **líneas** en lugar de cajones.
Los estilos viven en `features/login/login.scss` y los reusan las tres.

**Recuperar contraseña** (`/recuperar`) no manda enlaces por correo: registra el
pedido, le llega a los administradores, y ellos asignan una clave temporal desde
el módulo de usuarios. La persona entra con esa clave y la plataforma le exige
cambiarla. Se responde siempre lo mismo, exista o no la cuenta.

En **Usuarios**, los pedidos pendientes aparecen arriba de todo con la nota que
escribió la persona, y hay un botón `Clave` por fila. El modal permite generar
una sugerencia en el navegador (no la inventa el servidor) y muestra la clave en
claro a propósito: hay que poder leerla para comunicarla.

## Tablas y paginación

Toda la información en volumen se muestra en **tablas**, no en tarjetas:
proyectos, usuarios, grupos, asignaciones y pedidos de restablecimiento. El
espaciado sale del sistema (`--sp-4` en las celdas, `--sp-3` en las compactas),
la cabecera se queda pegada al hacer scroll y las columnas numéricas usan cifras
tabulares.

`ui/paginador` es el paginador compartido: **8 filas por página**, números con
elipsis cuando son muchas (1 … 4 5 6 … 20) y el rango a la izquierda
("9–16 de 28 proyectos").

- **Proyectos y usuarios** paginan y filtran **contra el servidor** (`skip`/`take`
  más el total en `X-Total-Count`), con 300 ms de espera al escribir. Buscar mira
  todo el conjunto, no la página cargada.
- **Grupos y asignaciones** paginan en el cliente: son listas cortas por
  naturaleza y la API de asignaciones no pagina.

## Tablero de proyectos

`/proyectos` **no muestra lo mismo a todos**, porque no es el mismo trabajo:

- Quien **ejecuta** ve un tablero tipo kanban con lo que tiene a cargo
  (`asignadoAMi`) y arrastra sus tarjetas entre etapas.
- Quien **asigna** (jefatura de innovación) y la **administración** ven la tabla
  del área. A esas cuentas no se les asignan proyectos: un tablero de "lo mío"
  les saldría vacío. Necesitan listar, filtrar y paginar todo el conjunto.

La bifurcación vive en `features/projects/projects.ts` y el criterio es el
permiso `assignments.create`, más el rol admin excluido de forma explícita.

**Diez columnas**, agrupadas por fase con una banda superior: las tres del
embudo, las cinco del desarrollo, producción y descartado. `descartado` sigue
siendo una columna y no un estado escondido: si desapareciera, esos proyectos no
tendrían dónde verse.

**Carga por columna.** Cada una pide su tanda de 10 y trae más por su cuenta,
con el total real en el encabezado (de `/projects/stats`). Un tablero que trae
"todo" deja de servir en cuanto hay volumen.

**Arrastre con `@angular/cdk/drag-drop`.** Al soltar, la tarjeta se mueve en
pantalla primero y se guarda después; si el servidor rechaza, el tablero vuelve
exactamente a como estaba y el aviso dice por qué. Las tarjetas que el servidor
no dejaría mover (no sos el autor ni admin) no se pueden arrastrar y muestran un
candado: es más honesto impedir el gesto que dejarlo hacer y deshacerlo.

**Detalle en panel lateral**, no en página: el tablero sigue detrás y cerrar no
reconstruye las columnas ni pierde el scroll. Muestra los tiempos, el historial
de etapas con la fecha de entrada a cada una, los responsables y el fin
estimado. `/proyectos/:id` sigue existiendo para enlaces directos.

### Tiempos

`core/tiempos.ts` son funciones puras, con tests en `core/tiempos.spec.ts`. La
regla es que **cuando falta un dato se devuelve `null`, nunca 0**: un cero diría
"lleva cero días acá", que es distinto de "no sé cuánto lleva". Cubre historial
vacío, fechas inválidas, fechas futuras y reprocesos (si un proyecto vuelve a
una etapa salen dos tramos separados, porque agruparlos escondería el reproceso).

El semáforo de retraso usa umbrales **por etapa**: dos semanas en code review es
tarde, dos semanas en desarrollo no.

### Editar y eliminar

Las dos acciones son **del autor** (o de un administrador), y aparecen en tres
lugares: el panel del tablero, la ficha del proyecto y una columna de acciones en
la tabla. Fuera de eso la fila muestra un guion.

El permiso vive en un solo lugar, `AuthService.esAutorOAdmin()`, que espeja
`soloAutorOAdmin` del servidor. Antes la ficha usaba `projects.viewAll` —un
permiso de **lectura**— así que la jefatura veía el botón de eliminar y la API le
devolvía 403.

`/proyectos/:id/editar` reusa el mismo formulario que registrar: los campos son
idénticos y duplicarlo garantizaría que las dos versiones se separen. En edición
**no se manda la etapa**: eso se mueve en el tablero, y mandarla desde el
formulario pisaría el estado y ensuciaría el historial con una entrada falsa. Si
alguien entra por URL a editar algo que no registró, se lo devuelve a la ficha
con el motivo.

**Eliminar archiva.** La API no tiene borrado destructivo: el proyecto sale de
las listas y del tablero, queda con `archivado`, y se puede recuperar. La
confirmación lo dice con esas palabras en lugar de prometer un borrado que no
ocurre.

### Filtrado avanzado

Texto, sector, prioridad de la asignación, estado de la asignación, quién la
asignó, rango de fechas de registro y plazo vencido — todos **contra el
servidor**, porque filtrar en el cliente solo miraría las tarjetas ya cargadas.
El único que se resuelve en el cliente es "demorados en su etapa", que depende
de los tiempos calculados acá.

El selector de "me lo asignó" se arma con las asignaciones propias, no con
`/users`: un colaborador recibe 403 al listar usuarios.

## Avisos que llevan a la acción

El clic en un aviso de la campana no solo lo marca leído: lleva a donde se
resuelve. Una asignación abre `/asignaciones?a=<id>` con esa fila resaltada y su
botón de avance; un pedido de contraseña abre `/usuarios?reset=<id>` con el modal
de clave de esa persona ya abierto, aunque no esté en la primera página. Cada
aviso muestra de antemano qué va a pasar ("Ver y aceptar", "Asignar clave").

## Estado actual

Conectado a la API de BackQ-D: el login, los permisos y todos los datos vienen
del servidor. El interceptor renueva el token de acceso solo, y con una
contraseña temporal la plataforma no deja operar hasta cambiarla.

Para trabajar en local hacen falta las dos piezas: la API en `localhost:3000` y
este front en `localhost:4300`.

**`/documentos` ya funciona.** Se sube un PDF o un DOCX, el backend extrae su
texto, un modelo propone la ficha del proyecto y la pantalla la precarga en el
formulario para corregirla. Los campos propuestos llevan una etiqueta
«Propuesto por IA» que desaparece al editarlos, así marca lo que todavía no se
revisó. El guardado es el `POST /projects` de siempre, así que el proyecto
resultante es indistinguible de uno hecho a mano.

Nada se guarda de más: el archivo no se persiste en el servidor, y el borrador
vive en `sessionStorage` de la pestaña hasta que se guarda o se descarta —
nunca en `localStorage`.

El módulo pide el permiso `ai.use` (guard en la ruta y filtro en el riel), y
guardar además pide `projects.create`: son dos permisos distintos y alguien
puede tener uno sin el otro.

**Aviso al usuario, y a quien despliegue:** el contenido del documento se
procesa con un servicio de IA externo. La pantalla lo dice antes de que la
persona elija el archivo. Habilitarlo en producción requiere el aval del
gobierno de datos; el interruptor de apagado está en el backend
(`AI_PROVIDER=ninguno`).

Las otras funciones de IA (score, comité, búsqueda semántica) siguen fuera del
MVP: sus resultados eran deterministas y simulados, y no hay modelo detrás.

## Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm start` | Levanta el dev server en `localhost:4300` |
| `npm run build` | Build de producción en `dist/` |
| `npm test` | Ejecuta los tests con Vitest |
| `npm run watch` | Build en watch mode para desarrollo |

## Registro de cambios

| Rama | Qué cambió |
|---|---|
| `feat/tablero-proyectos` | **Auditoría visual y de accesibilidad, aplicada.** Tres tokens de contraste que faltaban (`--text-dim` no llegaba a 4.5:1 en ninguno de los dos temas; `--accent-ui` porque el lima daba 1.26:1 sobre fondo claro y el anillo de foco era invisible; `--danger-text`). Alternativa por teclado para mover tarjetas en el tablero, que `@angular/cdk` no trae. Landmark `<main>`, enlace de salto, títulos en las 14 rutas y foco al navegar. Espaciado de 162 valores crudos a 0, con la escala de control `--ctl-*` y stylelint para congelarlo. Onboarding y perfil reconstruidos sobre el sistema (onboarding vivía sobre `.login`, una clase que ya no existía). Grupos pasa de tabla a tarjetas. Y los defectos de las capturas: los iconos de campo pisaban el texto en 3 de 4 pantallas, el panel de avisos se transparentaba porque su blur no tenía nada que desenfocar, el paginador se derramaba fuera de la columna, la barra de filtros se trepaba sobre el título, y el encabezado de tabla quedaba pisado por el estado vacío. |
| `feat/tablero-proyectos` | **CI en cada pull request** (`ci.yml`): tipos con `strictTemplates`, stylelint, compilación y los 41 tests. No despliega. |
| `feat/tablero-proyectos` | Cuatro bugs funcionales: el botón de alta de usuario no hacía nada (dos validaciones que no coincidían), el KPI de usuarios del inicio cambiaba según por dónde hubieras navegado, la tabla de grupos ordenaba solo las 8 filas visibles, y `ng serve` levantaba en 4200 mientras el CORS espera 4300. Más el interceptor, que dejaba peticiones colgadas para siempre si fallaba la renovación. |
| `feat/tablero-proyectos` | Vistas maestro-detalle en Proyectos y Usuarios (lista + ficha siempre visible, con navegación por flechas), selector de integrantes en dos paneles con cambios en lote y la consecuencia a la vista, y el dashboard con deltas reales y sparkline. |
| `feat/tablero-proyectos` | PrimeNG 21.1.9 como libreria de componentes, tematizado con los tokens de marca; integrado con los 11 commits de `origin/main` y con el tablero de proyectos, cuyos selects, calendarios, buscador y botones pasan a componentes de PrimeNG. El proxy del dev server apunta al BackQ-D local. |
| `main` | Editar y eliminar proyectos, solo para quien los registró: formulario de edición reusado en `/proyectos/:id/editar`, acciones en el panel del tablero, en la ficha y por fila en la tabla, y el permiso unificado en `esAutorOAdmin()` (la ficha usaba un permiso de lectura). |
| `main` | Tablero kanban de proyectos a cargo: 10 columnas por etapa, arrastre con `@angular/cdk` y guardado optimista, panel lateral con historial y tiempos por etapa, y filtrado avanzado contra el servidor. La tabla queda para quien asigna y para administración. |
| `main` | Nomenclatura del área: **I+D** pasa a **R&D** en el título de la pestaña, la marca de agua de las cuatro pantallas, el riel y los textos de Grupos y Usuarios. La del login decía `Q&D` y queda alineada. |
| `main` | Tarjetas fuera: proyectos, usuarios, grupos, asignaciones y pedidos pasan a tablas con paginación de 8 filas (`ui/paginador`). Proyectos y usuarios paginan y filtran contra el servidor. Los avisos de la campana llevan a la acción concreta. |
| `main` | Login rediseñado en clave minimalista (sin tarjeta, campos de línea, ver/ocultar contraseña) y pantalla de recuperación; el módulo de usuarios atiende los pedidos y asigna la clave temporal. |
| `main` | Rediseño: se elimina la barra superior y su contenido pasa al riel; marca de agua `R&D` en el fondo; baldosa de marca en lugar del isotipo suelto; icono propio para Grupos; Proyectos con resumen de una línea (antes cuatro tarjetas) y Asignaciones como tablero por estado con un único avance por tarjeta. |
| `main` | MVP: funciones de IA ocultas detras de `environment.funcionesIA` (dock, rutas con `iaGuard`, pestana del detalle, buscador de duplicados y accesos del inicio), y textos que ya no prometen lo que no hay. |
| `main` | Conexion con la API de BackQ-D: interceptor con renovacion de token, guards asincronos, pantalla de cambio de clave obligatorio y los 4 servicios sobre HTTP. |
| `main` | Traslado desde `portafolio-ia/plataforma-id/web`. Sistema de diseño alineado al manual de marca (Montserrat, paleta oficial, escala tipográfica, ritmo de 4pt). Dock de módulos en cristal líquido reemplazando la barra de navegación superior y el drawer móvil. Corregido el subrayado involuntario de todos los enlaces. Logos oficiales en `public/brand/`. |

## Entornos

| Entorno | Front | API |
|---|---|---|
| Local | `http://localhost:4300` | `http://localhost:3000/api` (BackQ-D corriendo en la máquina) |
| Producción | https://luisorozcobblabs.github.io/FrontQ-D/ | https://backq-d.onrender.com/api |

Documentación interactiva de la API: https://backq-d.onrender.com/api/docs

El valor lo resuelve `src/environments/environment.ts` en desarrollo y
`environment.prod.ts` en el build de producción (`fileReplacements` en
`angular.json`). No hay URLs de API escritas en los servicios.

Dos cosas a tener en cuenta con el entorno de producción:

- **CORS.** La API solo responde a los orígenes que estén en su variable
  `FRONTEND_URL`. Si el front se publica en un dominio nuevo, hay que agregarlo
  ahí o el navegador bloquea todas las peticiones.
- **Arranque en frío.** El plan gratuito de Render duerme la instancia tras unos
  minutos sin tráfico: la primera petición puede tardar cerca de un minuto y las
  siguientes responden normal.

## Licencia

Software propietario de Blackbird Labs. El repositorio es visible públicamente
para consulta y referencia técnica, pero **no es código abierto**: no se
autoriza su uso, copia, modificación ni distribución sin permiso escrito.
Los términos completos están en [LICENSE](LICENSE).
