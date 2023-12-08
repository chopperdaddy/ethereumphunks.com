import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class NavigationTrackerService {
  private navigationId: number | null = null;

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(event => {
      this.navigationId = (event as NavigationEnd).id;
    });
  }

  getCurrentNavigationId(): number | null {
    return this.navigationId;
  }
}
