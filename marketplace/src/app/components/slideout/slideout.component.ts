import { Component, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import anime from 'animejs';

@Component({
  selector: 'app-slideout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slideout.component.html',
  styleUrl: './slideout.component.scss',
  host: {
    '[class.active]': 'active',
    'style': 'transform: translateX(100%);',
  }
})
export class SlideoutComponent implements OnChanges {

  @Input() active: boolean = false;

  constructor(
    private el: ElementRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    anime.timeline({
      easing: 'cubicBezier(0.785, 0.135, 0.15, 0.86)',
      duration: 400,
    }).add({
      targets: this.el?.nativeElement,
      translateX: this.active ? '0' : '100%',
    });
  }
}
