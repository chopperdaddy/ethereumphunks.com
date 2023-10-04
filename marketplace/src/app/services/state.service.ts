import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface Period {
  key: string;
  value: string;
  limit: number;
}

@Injectable({
  providedIn: 'root'
})

export class StateService {

  private pagination = new BehaviorSubject<number>(1);
  pagination$: Observable<number> = this.pagination.asObservable();

  private marketState = new BehaviorSubject<string>('');
  marketState$ = this.marketState.asObservable();

  private marketLoading = new BehaviorSubject<boolean>(false);
  marketLoading$ = this.marketLoading.asObservable();

  private documentClick = new Subject<MouseEvent>();
  documentClick$ = this.documentClick.asObservable();

  private keyDownEscape = new Subject<KeyboardEvent>();
  keyDownEscape$ = this.keyDownEscape.asObservable();

  private isMobile = new BehaviorSubject<boolean>(window.innerWidth < 801);
  isMobile$ = this.isMobile.asObservable();

  periods: Period[] = [
    { key: '24h', value: '24 Hours', limit: 1 },
    { key: '7d', value: '7 Days', limit: 7 },
    { key: '30d', value: '30 Days', limit: 30 },
    { key: '6m', value: '6 Months', limit: 180 },
    { key: '1y', value: '1 Year', limit: 365 },
    { key: 'all', value: 'All Time', limit: 3650 }
  ];

  defaultPeriod: any = this.periods[4].key || '1y';

  private activePeriod = new BehaviorSubject<any>(this.periods[4]);
  activePeriod$ = this.activePeriod.asObservable();

  sortParams: any = {};

  phunkBoxAddress!: string | null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  setIsMobile(status: boolean): void {
    this.isMobile.next(status);
  }

  getIsMobile(): boolean {
    return this.isMobile.getValue();
  }

  setPagination(page: number): void {
    this.pagination.next(page);
  }

  setMarketState(state: any): void {
    this.marketState.next(state);
  }

  setMarketLoading(status: boolean): void {
    this.marketLoading.next(status);
  }

  setActivePeriod(period: any): void {
    this.activePeriod.next(period);
  }

  getActivePeriod(): any {
    return this.activePeriod.getValue();
  }

  setDocumentClick(event: MouseEvent): void {
    this.documentClick.next(event);
  }

  setKeydownEscape(event: KeyboardEvent): void {
    this.keyDownEscape.next(event);
  }

}
