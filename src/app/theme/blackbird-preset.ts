import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Tema de PrimeNG para la Plataforma R&D.
 *
 * La decisión de fondo: en lugar de copiar la paleta de Blackbird a los tokens
 * de PrimeNG, cada token apunta a la variable CSS que ya existe en styles.scss.
 * PrimeNG emite sus tokens como custom properties, así que `var(--surface)` se
 * resuelve en el navegador igual que en el resto de la aplicación.
 *
 * Eso trae tres cosas:
 *
 * 1. Una sola fuente de verdad. Cambiar `--accent` mueve la marca entera,
 *    componentes de PrimeNG incluidos.
 * 2. El tema claro/oscuro lo sigue manejando ThemeService con `data-theme`.
 *    PrimeNG no necesita su propia paleta oscura ni enterarse del cambio.
 * 3. Las curvas y duraciones del sistema de movimiento valen también acá.
 */
export const BlackbirdPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '6px',
      sm: 'var(--r-sm)',
      md: 'var(--r-md)',
      lg: 'var(--r-lg)',
      xl: 'var(--r-xl)',
    },
  },

  semantic: {
    transitionDuration: 'var(--dur)',
    focusRing: {
      width: '2px',
      style: 'solid',
      color: 'var(--accent-ui)',
      offset: '3px',
      shadow: 'none',
    },
    disabledOpacity: '0.5',
    iconSize: '1rem',
    anchorGutter: '4px',

    formField: {
      // Alineado con el `.p-inputtext { padding: var(--sp-3) var(--sp-4) }` de
      // styles.scss. Antes el preset decía 11px y styles.scss 12px, pero
      // styles.scss solo pisa a los inputs de texto: .p-multiselect-label,
      // .p-inputnumber, .p-autocomplete, .p-inputmask y .p-password se quedaban
      // con el valor del preset. O sea que un p-select y un p-multiselect uno al
      // lado del otro tenían un pixel de diferencia de alto — visible, y de esa
      // clase de cosa que se siente mal sin poder nombrarla.
      paddingX: 'var(--sp-4)',
      paddingY: 'var(--sp-3)',
      borderRadius: 'var(--r-md)',
      focusRing: { width: '2px', style: 'solid', color: 'var(--accent-ui)', offset: '2px', shadow: 'none' },
      transitionDuration: 'var(--dur)',
    },

    // Los overlays de select y multiselect: mismo ritmo de 4pt que el resto.
    list: {
      padding: 'var(--sp-1)',
      gap: '0',
      option: { padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-sm)' },
      optionGroup: { padding: 'var(--sp-2) var(--sp-3)', fontWeight: '600' },
    },

    content: { borderRadius: 'var(--r-md)' },
    mask: { transitionDuration: 'var(--dur-slow)' },
    navigation: {
      list: { padding: 'var(--sp-1)', gap: '0' },
      item: { padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-sm)', gap: 'var(--sp-2)' },
    },

    // Un solo juego de valores para los dos esquemas: las variables de
    // Blackbird ya cambian solas cuando ThemeService alterna `data-theme`.
    colorScheme: {
      light: esquema(),
      dark: esquema(),
    },
  },
});

/** Los tokens que PrimeNG resuelve por esquema, todos apuntando a la marca. */
function esquema() {
  return {
    primary: {
      // Lima puro a proposito: esto es un RELLENO, y su texto es --on-accent
      // (obsidiana), que sobre lima da 13.87:1. El requisito de 3:1 de
      // --accent-ui aplica al acento sobre el fondo de la pagina, no acá.
      color: 'var(--accent)',
      contrastColor: 'var(--on-accent)',
      hoverColor: 'var(--accent)',
      activeColor: 'var(--accent)',
    },
    highlight: {
      background: 'var(--accent-soft)',
      focusBackground: 'var(--accent-soft)',
      color: 'var(--text)',
      focusColor: 'var(--text)',
    },
    mask: { background: 'var(--overlay)', color: 'var(--text-2)' },

    surface: {
      0: 'var(--bg)',
      50: 'var(--surface)',
      100: 'var(--surface-2)',
      200: 'var(--line)',
      300: 'var(--line-strong)',
      400: 'var(--text-dim)',
      500: 'var(--text-dim)',
      600: 'var(--text-2)',
      700: 'var(--text-2)',
      800: 'var(--text)',
      900: 'var(--text)',
      950: 'var(--text)',
    },

    formField: {
      background: 'var(--surface)',
      disabledBackground: 'var(--surface-2)',
      filledBackground: 'var(--surface-2)',
      filledHoverBackground: 'var(--surface-2)',
      filledFocusBackground: 'var(--surface-2)',
      borderColor: 'var(--line-strong)',
      hoverBorderColor: 'var(--text-dim)',
      focusBorderColor: 'var(--accent)',
      invalidBorderColor: 'var(--danger)',
      color: 'var(--text)',
      disabledColor: 'var(--text-dim)',
      placeholderColor: 'var(--text-dim)',
      invalidPlaceholderColor: 'var(--danger)',
      floatLabelColor: 'var(--text-2)',
      floatLabelFocusColor: 'var(--accent-text)',
      floatLabelActiveColor: 'var(--text-2)',
      floatLabelInvalidColor: 'var(--danger)',
      iconColor: 'var(--text-dim)',
      shadow: 'none',
    },

    text: {
      color: 'var(--text)',
      hoverColor: 'var(--text)',
      mutedColor: 'var(--text-2)',
      hoverMutedColor: 'var(--text)',
    },

    content: {
      background: 'var(--surface)',
      hoverBackground: 'var(--surface-2)',
      borderColor: 'var(--line)',
      color: 'var(--text)',
      hoverColor: 'var(--text)',
    },

    overlay: {
      select: {
        background: 'var(--surface)',
        borderColor: 'var(--line-strong)',
        color: 'var(--text)',
        shadow: 'var(--shadow-lg)',
      },
      popover: {
        background: 'var(--surface)',
        borderColor: 'var(--line-strong)',
        color: 'var(--text)',
        shadow: 'var(--shadow-lg)',
      },
      modal: {
        background: 'var(--surface)',
        borderColor: 'var(--line-strong)',
        color: 'var(--text)',
        shadow: 'var(--shadow-lg)',
      },
    },

    list: {
      option: {
        focusBackground: 'var(--surface-2)',
        selectedBackground: 'var(--accent-soft)',
        selectedFocusBackground: 'var(--accent-soft)',
        color: 'var(--text-2)',
        focusColor: 'var(--text)',
        selectedColor: 'var(--text)',
        selectedFocusColor: 'var(--text)',
        icon: {
          color: 'var(--text-dim)',
          focusColor: 'var(--text-2)',
        },
      },
      optionGroup: { background: 'transparent', color: 'var(--text-dim)' },
    },

    navigation: {
      item: {
        focusBackground: 'var(--surface-2)',
        activeBackground: 'var(--accent-soft)',
        color: 'var(--text-2)',
        focusColor: 'var(--text)',
        activeColor: 'var(--text)',
        icon: { color: 'var(--text-dim)', focusColor: 'var(--text-2)', activeColor: 'var(--text)' },
      },
      submenuLabel: { background: 'transparent', color: 'var(--text-dim)' },
      submenuIcon: { color: 'var(--text-dim)', focusColor: 'var(--text-2)', activeColor: 'var(--text)' },
    },
  };
}
