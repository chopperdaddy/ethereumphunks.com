import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: true,
  name: 'rank'
})
export class RankPipe implements PipeTransform {
  transform(value: any): { value: number | null, color: string } {
    const rank = value.attributes?.find((attr: any) => attr?.k === 'Rank')?.v;

    if (rank === null || rank === undefined) {
      return { value: null, color: 'rgba(var(--highlight), 1)' };
    }

    // Neon color algorithm based on rank ranges
    let color: string;

    if (rank <= 1) {
      // Ultra rare #0 - Hot Pink (even more special than #1)
      color = 'rgba(var(--pink), 1)';
    } else if (rank <= 10) {
      // Top 10 - Purple (bid color)
      color = 'rgba(var(--bid-color), 1)';
    } else if (rank <= 50) {
      // Top 50 - Cyan (sale color)
      color = 'rgba(var(--sale-color), 1)';
    } else if (rank <= 100) {
      // Top 100 - Neon Green (transferred color)
      color = 'rgba(var(--transferred-color), 1)';
    } else if (rank <= 250) {
      // Top 250 - Yellow (escrow color)
      color = 'rgba(var(--escrow-color), 1)';
    } else if (rank <= 500) {
      // Top 500 - Coral/Orange (magma)
      color = 'rgba(var(--magma), 1)';
    } else if (rank <= 1000) {
      // Top 1000 - Default highlight (neon green)
      color = 'rgba(var(--highlight), 1)';
    } else {
      // Lower ranks - Dimmed highlight
      color = 'rgba(var(--highlight), 1)';
    }

    return {
      value: rank,
      color: color
    };
  }
}
