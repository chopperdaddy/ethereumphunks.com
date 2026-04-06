import { Pipe, PipeTransform } from '@angular/core';

interface Base64DecodeResult {
  type: 'image' | 'text';
  content: string;
}

@Pipe({
  standalone: true,
  name: 'fromBase64',
  pure: true
})
export class FromBase64Pipe implements PipeTransform {
  transform(value: string): Base64DecodeResult | null {
    if (!value) return null;

    try {
      // Check if it's already a data URI image - return as is
      if (value.startsWith('data:image/')) {
        return { type: 'image', content: value };
      }

      // Extract base64 string (remove data URI prefix and whitespace)
      let base64 = value.trim();
      if (base64.includes(',')) {
        base64 = base64.split(',')[1];
      }
      // Remove any whitespace/newlines from base64
      base64 = base64.replace(/\s/g, '');

      if (!base64) {
        return { type: 'text', content: value };
      }

      // Decode base64 to bytes
      let binaryString: string;
      try {
        binaryString = atob(base64);
      } catch (e) {
        // Invalid base64, return as text
        return { type: 'text', content: value };
      }

      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (bytes.length === 0) {
        return { type: 'text', content: value };
      }

      // Check if bytes are an image by checking file signatures
      const imageType = this.detectImageType(bytes);
      if (imageType) {
        // Return as data URI with proper MIME type
        return { type: 'image', content: `data:image/${imageType};base64,${base64}` };
      }

      // Decode to text
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, '').trim();

      // Check if decoded text is a data URI image
      if (text.startsWith('data:image/')) {
        return { type: 'image', content: text };
      }

      return { type: 'text', content: text || value };
    } catch (error) {
      console.warn('Error in fromBase64 pipe:', error, value?.substring(0, 50));
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
}

