import { Pipe, PipeTransform } from '@angular/core';

interface AsciiDecodeResult {
  type: 'image' | 'text';
  content: string;
}

@Pipe({
  standalone: true,
  name: 'fromAscii',
  pure: true
})
export class FromAsciiPipe implements PipeTransform {
  transform(value: string): AsciiDecodeResult | null {
    if (!value) return null;

    try {
      // Convert ASCII string to bytes
      const bytes = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) {
        bytes[i] = value.charCodeAt(i);
      }

      // Check if bytes are an image by checking file signatures
      const imageType = this.detectImageType(bytes);
      if (imageType) {
        // Convert bytes to base64 and create data URI
        const base64 = this.bytesToBase64(bytes);
        return { type: 'image', content: `data:image/${imageType};base64,${base64}` };
      }

      // Decode to text (ASCII is already text, but clean it up)
      const text = new TextDecoder('ascii', { fatal: false }).decode(bytes).replace(/\0/g, '').trim();

      // Check if it's a data URI image
      if (text.startsWith('data:image/')) {
        return { type: 'image', content: text };
      }

      return { type: 'text', content: text };
    } catch (error) {
      return { type: 'text', content: value };
    }
  }

  /**
   * Detects image type from file signature (magic numbers)
   */
  private detectImageType(bytes: Uint8Array): string | null {
    if (bytes.length < 4) return null;

    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'png';
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'jpeg';
    }

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'gif';
    }

    // WebP: RIFF...WEBP
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'webp';
    }

    // SVG: Check if it starts with XML-like tags
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(100, bytes.length)));
    if (text.trim().startsWith('<svg') || (text.trim().startsWith('<?xml') && text.includes('<svg'))) {
      return 'svg+xml';
    }

    return null;
  }

  /**
   * Converts bytes to base64 string
   */
  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

