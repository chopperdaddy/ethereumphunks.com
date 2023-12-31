import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: true,
  name: 'cc2tc'
})
export class CamelCase2TitleCase implements PipeTransform {

  transform(value: string): string {
    if (!value) return '';

    return value
      .replace(/([A-Z])/g, ' $1') // Insert a space before each capital letter
      .trim() // Remove any leading or trailing spaces
      .replace(/\b\w/g, (char: string) => char.toUpperCase()) // Capitalize the first letter of each word
      .replace('Phunk', '')
      .replace(/([a-zA-Z])([A-Z])/g, '$1 $2') // Make sure there is a space between words
  }
}
