import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  standalone: true,
  name: 'jsonPrettify',
  pure: true
})
export class JsonPrettifyPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(
    value: string | object,
    showLineNumbers: boolean = false,
    padding: number = 4,
    indent: number = 2
  ): SafeHtml {
    if (!value) return '';

    try {
      // If value is already an object, stringify it; otherwise parse then stringify
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      const html = this.applyColors(parsed, showLineNumbers, padding, indent);

      // Sanitize the HTML (pre and code tags are safe)
      return this.sanitizer.bypassSecurityTrustHtml(html);
    } catch (error) {
      // If JSON parsing fails, return error message
      const html = this.applyColors({ error: 'Invalid JSON' }, showLineNumbers, padding, indent);
      return this.sanitizer.bypassSecurityTrustHtml(html);
    }
  }

  private applyColors(
    obj: any,
    showLineNumbers: boolean = false,
    padding: number = 4,
    indent: number = 2
  ): string {
    let line = 1;

    // Stringify the object if it's not already a string
    let jsonString = typeof obj === 'string' ? obj : JSON.stringify(obj, undefined, indent);

    // Escape HTML special characters to prevent XSS
    jsonString = jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    /**
     * Apply syntax highlighting to different JSON elements
     * Matches: strings, keys, booleans, null, and numbers
     * Wraps each element in a span with appropriate class
     */
    jsonString = jsonString.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match: string) => {
        let themeClass = 'number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            themeClass = 'key';
          } else {
            themeClass = 'string';
          }
        } else if (/true|false/.test(match)) {
          themeClass = 'boolean';
        } else if (/null/.test(match)) {
          themeClass = 'null';
        }
        return '<span class="' + themeClass + '">' + match + '</span>';
      }
    );

    /**
     * Optionally add line numbers
     * Inserts a number-line span at the start of each line
     */
    if (showLineNumbers) {
      jsonString = jsonString.replace(
        /^/gm,
        () => `<span class="number-line">${String(line++).padEnd(padding)}</span>`
      );
    }

    return `<pre class="json-prettify"><code>${jsonString}</code></pre>`;
  }
}

