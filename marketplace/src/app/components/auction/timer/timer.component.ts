import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [
    CommonModule
  ],
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss']
})

export class TimerComponent implements OnInit, OnChanges, OnDestroy {

  @Input() endTime: number = 0;
  @Output() event: EventEmitter<any> = new EventEmitter();

  days = '00';
  hours = '00';
  minutes = '00';
  seconds = '00';

  intervalId: any;

  ngOnInit(): void {
    this.countDown();
  }

  ngOnChanges(): void {
    this.countDown();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  stop(): void {
    this.clearTimer();
  }

  private clearTimer(): void {

    this.setTimer();

    this.days = '00';
    this.hours = '00';
    this.minutes = '00';
    this.seconds = '00';

    clearInterval(this.intervalId);
  }

  private countDown() {
    this.clearTimer();
    this.intervalId = setInterval(() => {
      const diff = this.setTimer();
      if (diff < 1) this.clearTimer();
    }, 1000);
  }

  setTimer(): number {
    const padWithZero = (n: number, t: number) => String(n).padStart(t, '0');

    const now = Date.now();
    let diff = this.endTime ? this.endTime - now : 0;

    // Time calculations for days, hours, minutes and seconds
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    this.days = padWithZero(d, 2);
    this.hours = padWithZero(h, 2);
    this.minutes = padWithZero(m, 2);
    this.seconds = padWithZero(s, 2);

    this.event.emit({ left: diff });

    return diff;
  }

}
