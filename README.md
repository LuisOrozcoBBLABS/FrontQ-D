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
npm test
```

Los tests usan **Vitest** y cubren componentes, servicios y modelos.

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
