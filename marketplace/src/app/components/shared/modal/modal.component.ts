import { Component, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent {

  @Input() active: boolean = false;

  constructor(
    private el: ElementRef
  ) {}

  close(): void {
    this.active = false;
  }
}
