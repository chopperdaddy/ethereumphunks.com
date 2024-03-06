import { Component, ElementRef, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';

import { GlobalState } from '@/models/global-state';

import { setChatActive } from '@/state/actions/chat.actions';

@Component({
  standalone: true,
  imports: [
    CommonModule
  ],
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  host: {
    '[class.active]': 'active'
  }
})
export class ModalComponent implements OnInit {

  @Input() width!: number;
  @Input() height!: number;

  constructor(
    private store: Store<GlobalState>,
    private el: ElementRef
  ) {}

  ngOnInit(): void {}

  close(): void {
    this.store.dispatch(setChatActive({ active: false }));
  }
}
