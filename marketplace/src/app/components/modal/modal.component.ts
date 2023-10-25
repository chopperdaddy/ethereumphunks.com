import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { StateService } from '@/services/state.service';

import { Subject, filter, fromEvent, merge, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})

export class ModalComponent implements AfterViewInit, OnDestroy {

  @ViewChild('modal') modal!: ElementRef;

  @Output() closeModalEvent = new EventEmitter<void>();

  destroy$ = new Subject<void>();

  constructor(
    private el: ElementRef,
    private stateSvc: StateService,
  ) {}

  ngAfterViewInit(): void {
    let mouseDownInsideModal = false;
    merge(
      this.stateSvc.keyDownEscape$,
      this.stateSvc.documentClick$,
      fromEvent<MouseEvent>(this.modal.nativeElement, 'mousedown'),
      fromEvent<MouseEvent>(this.modal.nativeElement, 'mouseup')
    ).pipe(
      filter(() => !(this.el.nativeElement as HTMLElement).classList.contains('sidebar')),
      tap(($event) => {

        const modal = this.modal.nativeElement as HTMLElement;
        const target = $event?.target as HTMLElement;

        if ($event instanceof KeyboardEvent || (!mouseDownInsideModal && !modal.contains(target))) {
          this.closeModal();
        }

        if ($event.type === 'mousedown' && modal.contains(target)) {
          mouseDownInsideModal = true;
        } else if ($event.type === 'mouseup') {
          mouseDownInsideModal = false;
        }
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closeModal(): void {
    this.closeModalEvent.emit();
  }

}
