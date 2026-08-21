import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MusicPlayer } from '../../ui/music-player/music-player';
import { NavRail } from '../../ui/nav-rail/nav-rail';

/**
 * Marco de la aplicación. Ya no hay barra superior: el riel lateral lleva la
 * marca, los módulos y las utilidades, y el fondo lleva la marca de agua del
 * área. Un solo patrón de navegación, sin identidad duplicada.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, NavRail, MusicPlayer],
  templateUrl: './shell.html',
})
export class Shell {}
