import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class ThemeService {

  private theme = new BehaviorSubject<any>(localStorage.getItem('mode') || 'dark');
  theme$ = this.theme.asObservable();

  constructor() {

    const themeStyles: any = {
      dark: {
        '--background': '0, 0, 0',
        '--text-color': '255, 255, 255',
        '--dark-text': '255, 255, 255',
        '--highlight': '195, 255, 0',
        '--button-color': '255, 4, 180',
        '--header-text': '255, 4, 180'
      },
      light: {
        '--background': '255, 4, 180',
        '--text-color': '0, 0, 0',
        '--dark-text': '0, 0, 0',
        '--highlight': '195, 255, 0',
        '--button-color': '0, 0, 0',
        '--header-text': '0, 0, 0'
      }
    }

    this.theme$.subscribe((res: any) => {
      this.setThemeStyles(res, themeStyles[res]);
    });
  }

  setThemeStyles(theme: string, themeStyles: any) {
    Object.keys(themeStyles).map((property) => {
      document.documentElement.style.setProperty(
        property,
        themeStyles[property]
      );
    });
    document.body.dataset.theme = theme;
  }

  setTheme(value: string, temporary?: boolean) {
    this.theme.next(value);
    if (!temporary) localStorage.setItem('mode', value);
  }

}
