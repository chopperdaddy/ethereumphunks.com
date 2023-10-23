import { Injectable } from '@angular/core';

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

  private documentClick = new Subject<MouseEvent>();
  documentClick$ = this.documentClick.asObservable();

  private keyDownEscape = new Subject<KeyboardEvent>();
  keyDownEscape$ = this.keyDownEscape.asObservable();

  private isMobile = new BehaviorSubject<boolean>(window.innerWidth < 801);
  isMobile$ = this.isMobile.asObservable();

  sortParams: any = {};

  setIsMobile(status: boolean): void {
    this.isMobile.next(status);
  }

  getIsMobile(): boolean {
    return this.isMobile.getValue();
  }

  setDocumentClick(event: MouseEvent): void {
    this.documentClick.next(event);
  }

  setKeydownEscape(event: KeyboardEvent): void {
    this.keyDownEscape.next(event);
  }

}
