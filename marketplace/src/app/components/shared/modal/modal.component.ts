import { Component, ElementRef, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

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

  @Input() active: boolean = false;
  @Output() activeChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Input() width!: number;
  @Input() height!: number;

  constructor(
    private el: ElementRef
  ) {}

  ngOnInit(): void {}

  close(): void {
    this.active = false;
    this.activeChange.emit(this.active);
  }
}
