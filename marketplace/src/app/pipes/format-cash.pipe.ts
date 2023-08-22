import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: true,
  name: 'formatCash'
})
export class FormatCashPipe implements PipeTransform {

  transform(value: number, ...args: any[]): string {
    return this.formatCash(value, args[0] ?? 2);
  }

  formatCash(n: number, decimals?: number): string {
    if (n === 0) return '0';
    if (n < 1) return n.toFixed(2) + '';
    if (n < 1e3) return n.toFixed(decimals) + '';
    // if (n < 1e3) return String(n);
    if (n >= 1e3 && n < 1e6) return +(n / 1e3).toFixed(1) + 'K';
    if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'M';
    if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'B';
    if (n >= 1e12) return +(n / 1e12).toFixed(1) + 'T';
    return 0 + '';
  };

}
