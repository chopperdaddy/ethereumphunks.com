import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-owned',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owned.component.html',
  styleUrls: ['./owned.component.scss']
})

export class OwnedComponent {

  @Input() ethPhunks!: any[] | null;
  @Output() phunkSelected: EventEmitter<string> = new EventEmitter<string>();

  expanded = false;

  setPhunkSelected(phunkId: string) {
    this.phunkSelected.emit(phunkId);
  }
}
