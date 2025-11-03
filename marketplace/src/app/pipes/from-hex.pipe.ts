import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface HexDecodeResult {
  type: 'image' | 'text';
  content: string;
}

@Pipe({
  standalone: true,
  name: 'fromHex',
  pure: true
})
export class FromHexPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): HexDecodeResult | null {
    if (!value) return null;

    try {
      // Check if it's already a data URI image - return as is
      if (value.startsWith('data:image/')) {
        return { type: 'image', content: value };
      }

      // Remove 0x prefix and whitespace
      let hex = value.replace(/^0x/i, '').replace(/\s/g, '');

      // Validate hex string
      if (!/^[0-9a-f]*$/i.test(hex)) {
        return { type: 'text', content: value };
      }

      // Handle empty hex string
      if (!hex || hex.length === 0) {
        return { type: 'text', content: value };
      }

      // Pad odd-length hex strings with leading zero
      if (hex.length % 2 !== 0) {
        hex = '0' + hex;
      }

      // Convert hex to bytes
      const hexPairs = hex.match(/../g);
      if (!hexPairs || hexPairs.length === 0) {
        return { type: 'text', content: value };
      }

      const bytes = new Uint8Array(hexPairs.map(h => parseInt(h, 16)));

      if (bytes.length === 0) {
        return { type: 'text', content: value };
      }

      // Check if bytes are an image by checking file signatures
      const imageType = this.detectImageType(bytes);
      if (imageType) {
        // Convert bytes to base64 and create data URI
        const base64 = this.bytesToBase64(bytes);
        return { type: 'image', content: `data:image/${imageType};base64,${base64}` };
      }

      // Decode to text
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, '').trim();

      // Check if it's a data URI image in the decoded text
      if (text.startsWith('data:image/')) {
        return { type: 'image', content: text };
      }

      return { type: 'text', content: text || value };
    } catch (error) {
      console.warn('Error in fromHex pipe:', error, value?.substring(0, 50));
      return { type: 'text', content: value };
    }
  }

  /**
   * Detects image type from file signature (magic numbers)
   * @param bytes The bytes to check
   * @returns Image MIME type or null if not an image
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

    // GIF: 47 49 46 38 (GIF8)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'gif';
    }

    // WebP: Check for RIFF...WEBP
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) { // WEBP
      return 'webp';
    }

    // SVG: Check if it starts with XML-like tags (simplified check)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(100, bytes.length)));
    if (text.trim().startsWith('<svg') || (text.trim().startsWith('<?xml') && text.includes('<svg'))) {
      return 'svg+xml';
    }

    return null;
  }

  /**
   * Converts bytes to base64 string efficiently
   * @param bytes The bytes to convert
   * @returns Base64 encoded string
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

