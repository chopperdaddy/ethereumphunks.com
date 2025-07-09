import { Component, input, output, signal, computed, effect, OnDestroy } from '@angular/core';
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

export class TimerComponent implements OnDestroy {

  endTime = input<string | null>();
  timeLeft = output<any>();

  // Internal signals for timer state
  private currentTime = signal(Date.now());
  private intervalId: any;
  private previousEndTime = signal<number | null>(null);

  // Computed time difference
  private timeDiff = computed(() => {
    const endTime = this.endTime();
    if (!endTime) return 0;
    return Math.max(0, new Date(endTime).getTime() - this.currentTime());
  });

  // Computed display values
  days = computed(() => {
    const diff = this.timeDiff();
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    return String(d).padStart(2, '0');
  });

  hours = computed(() => {
    const diff = this.timeDiff();
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return String(h).padStart(2, '0');
  });

  minutes = computed(() => {
    const diff = this.timeDiff();
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return String(m).padStart(2, '0');
  });

  seconds = computed(() => {
    const diff = this.timeDiff();
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return String(s).padStart(2, '0');
  });

  constructor() {
    // Effect to handle timer logic when endTime actually changes
    effect(() => {
      const endTime = this.endTime();
      const currentEndTimeValue = endTime ? new Date(endTime).getTime() : null;
      const previousEndTimeValue = this.previousEndTime();

      // Only restart timer if the actual time value has changed
      if (currentEndTimeValue !== previousEndTimeValue) {
        this.previousEndTime.set(currentEndTimeValue);

        // Clear existing timer
        this.clearTimer();

        if (endTime) {
          // Start new timer
          this.startTimer();
        } else {
          // Reset to zeros when no endTime
          this.currentTime.set(Date.now());
        }
      }
    });

    // Effect to emit timeLeft changes
    effect(() => {
      const diff = this.timeDiff();
      this.timeLeft.emit({ left: diff });

      // Stop timer when time runs out
      if (diff <= 0) {
        this.clearTimer();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  stop(): void {
    this.clearTimer();
  }

  private startTimer(): void {
    this.intervalId = setInterval(() => {
      this.currentTime.set(Date.now());
    }, 1000);
  }

  private clearTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
