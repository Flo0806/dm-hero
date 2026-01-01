import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { isCompressibleImage, compressImage, formatCompressionStats } from '../../server/utils/image-compression'

// Helper to create a valid test image using sharp
async function createTestImage(format: 'png' | 'jpeg' | 'webp', width = 100, height = 100): Promise<Buffer> {
  // Create a simple colored image
  const channels = format === 'png' ? 4 : 3
  const pixels = Buffer.alloc(width * height * channels, 0)

  // Fill with a red color
  for (let i = 0; i < pixels.length; i += channels) {
    pixels[i] = 255 // R
    pixels[i + 1] = 0 // G
    pixels[i + 2] = 0 // B
    if (channels === 4) pixels[i + 3] = 255 // A
  }

  const image = sharp(pixels, {
    raw: { width, height, channels },
  })

  switch (format) {
    case 'png':
      return image.png().toBuffer()
    case 'jpeg':
      return image.jpeg().toBuffer()
    case 'webp':
      return image.webp().toBuffer()
  }
}

describe('image-compression', () => {
  describe('isCompressibleImage', () => {
    it('should return true for JPG files', () => {
      expect(isCompressibleImage('/path/to/image.jpg')).toBe(true)
      expect(isCompressibleImage('/path/to/image.jpeg')).toBe(true)
      expect(isCompressibleImage('/path/to/IMAGE.JPG')).toBe(true)
    })

    it('should return true for PNG files', () => {
      expect(isCompressibleImage('/path/to/image.png')).toBe(true)
      expect(isCompressibleImage('/path/to/IMAGE.PNG')).toBe(true)
    })

    it('should return true for WebP files', () => {
      expect(isCompressibleImage('/path/to/image.webp')).toBe(true)
    })

    it('should return true for GIF files', () => {
      expect(isCompressibleImage('/path/to/image.gif')).toBe(true)
    })

    it('should return true for TIFF files', () => {
      expect(isCompressibleImage('/path/to/image.tiff')).toBe(true)
      expect(isCompressibleImage('/path/to/image.tif')).toBe(true)
    })

    it('should return false for non-image files', () => {
      expect(isCompressibleImage('/path/to/document.pdf')).toBe(false)
      expect(isCompressibleImage('/path/to/audio.mp3')).toBe(false)
      expect(isCompressibleImage('/path/to/video.mp4')).toBe(false)
      expect(isCompressibleImage('/path/to/data.json')).toBe(false)
      expect(isCompressibleImage('/path/to/archive.zip')).toBe(false)
    })

    it('should return false for SVG files (vector, not raster)', () => {
      expect(isCompressibleImage('/path/to/image.svg')).toBe(false)
    })
  })

  describe('compressImage', () => {
    it('should compress PNG and return result with stats', async () => {
      const pngBuffer = await createTestImage('png')
      const result = await compressImage(pngBuffer, '/test/image.png')

      expect(result).toHaveProperty('buffer')
      expect(result).toHaveProperty('originalSize')
      expect(result).toHaveProperty('compressedSize')
      expect(result).toHaveProperty('format')
      expect(result.format).toBe('png')
      expect(result.originalSize).toBe(pngBuffer.length)
      expect(Buffer.isBuffer(result.buffer)).toBe(true)
    })

    it('should compress JPEG and return result with stats', async () => {
      const jpegBuffer = await createTestImage('jpeg')
      const result = await compressImage(jpegBuffer, '/test/image.jpg')

      expect(result).toHaveProperty('buffer')
      expect(result.format).toBe('jpeg')
      expect(result.originalSize).toBe(jpegBuffer.length)
      expect(Buffer.isBuffer(result.buffer)).toBe(true)
    })

    it('should compress WebP and return result with stats', async () => {
      const webpBuffer = await createTestImage('webp')
      const result = await compressImage(webpBuffer, '/test/image.webp')

      expect(result.format).toBe('webp')
      expect(Buffer.isBuffer(result.buffer)).toBe(true)
    })

    it('should resize large images', async () => {
      // Create a 3000x2000 image (larger than max 1920)
      const largeBuffer = await createTestImage('jpeg', 3000, 2000)
      const result = await compressImage(largeBuffer, '/test/large.jpg', {
        maxWidth: 1920,
        maxHeight: 1920,
      })

      // Verify the output is smaller (resized)
      expect(result.compressedSize).toBeLessThan(result.originalSize)

      // Verify dimensions were reduced by checking with sharp
      const metadata = await sharp(result.buffer).metadata()
      expect(metadata.width).toBeLessThanOrEqual(1920)
      expect(metadata.height).toBeLessThanOrEqual(1920)
    })

    it('should use custom compression options', async () => {
      const pngBuffer = await createTestImage('png')
      const result = await compressImage(pngBuffer, '/test/image.png', {
        maxWidth: 500,
        maxHeight: 500,
        pngCompressionLevel: 6,
      })

      expect(result.format).toBe('png')
      expect(Buffer.isBuffer(result.buffer)).toBe(true)
    })

    it('should throw error for invalid image data', async () => {
      const invalidBuffer = Buffer.from('not an image')

      await expect(compressImage(invalidBuffer, '/test/image.png')).rejects.toThrow()
    })
  })

  describe('formatCompressionStats', () => {
    it('should format compression stats correctly', () => {
      // 10MB -> 4MB = 60% savings
      const original = 10 * 1024 * 1024
      const compressed = 4 * 1024 * 1024

      const result = formatCompressionStats(original, compressed)

      expect(result).toContain('10.00MB')
      expect(result).toContain('4.00MB')
      expect(result).toContain('60.0%')
    })

    it('should handle small files', () => {
      // 100KB -> 30KB = 70% savings
      const original = 100 * 1024
      const compressed = 30 * 1024

      const result = formatCompressionStats(original, compressed)

      expect(result).toContain('0.10MB')
      expect(result).toContain('0.03MB')
      expect(result).toContain('70.0%')
    })

    it('should handle no compression (same size)', () => {
      const size = 1024 * 1024

      const result = formatCompressionStats(size, size)

      expect(result).toContain('0.0%')
    })
  })
})
