import * as LZString from 'lz-string';

export class CompressionUtils {
  static compress(data: string): string {
    try {
      return LZString.compressToBase64(data);
    } catch (error) {
      console.error('Compression failed:', error);
      return data; // Return original data if compression fails
    }
  }

  static decompress(compressedData: string): string {
    try {
      const decompressed = LZString.decompressFromBase64(compressedData);
      return decompressed || compressedData; // Return original if decompression fails
    } catch (error) {
      console.error('Decompression failed:', error);
      return compressedData; // Return original data if decompression fails
    }
  }

  static compressObject<T>(obj: T): string {
    try {
      const jsonString = JSON.stringify(obj);
      return this.compress(jsonString);
    } catch (error) {
      console.error('Object compression failed:', error);
      throw new Error('Failed to compress object');
    }
  }

  static decompressObject<T>(compressedData: string): T {
    try {
      const jsonString = this.decompress(compressedData);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Object decompression failed:', error);
      throw new Error('Failed to decompress object');
    }
  }

  static calculateCompressionRatio(original: string, compressed: string): number {
    if (original.length === 0) return 0;
    return (1 - compressed.length / original.length) * 100;
  }
}