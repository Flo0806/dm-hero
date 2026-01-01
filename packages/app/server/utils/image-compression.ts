import sharp from 'sharp'
import { extname } from 'path'

export interface CompressionResult {
  buffer: Buffer
  originalSize: number
  compressedSize: number
  format: string
}

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  jpegQuality?: number
  pngCompressionLevel?: number
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  jpegQuality: 80,
  pngCompressionLevel: 9,
}

// Image extensions that can be compressed
const COMPRESSIBLE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif'])

/**
 * Check if a file path is a compressible image
 */
export function isCompressibleImage(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return COMPRESSIBLE_EXTENSIONS.has(ext)
}

/**
 * Compress an image buffer while maintaining format and transparency
 *
 * @param inputBuffer - The original image buffer
 * @param filePath - The file path (used to determine format)
 * @param options - Compression options
 * @returns Compression result with buffer and stats
 */
export async function compressImage(
  inputBuffer: Buffer,
  filePath: string,
  options: CompressionOptions = {},
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const ext = extname(filePath).toLowerCase()
  const originalSize = inputBuffer.length

  const image = sharp(inputBuffer)
  const metadata = await image.metadata()

  // Resize if larger than max dimensions (maintain aspect ratio)
  const resized = image.resize(opts.maxWidth, opts.maxHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  })

  let outputBuffer: Buffer
  let format: string

  // Compress based on format, preserving original format
  switch (ext) {
    case '.png':
      // PNG: Preserve transparency, use maximum compression
      outputBuffer = await resized
        .png({
          compressionLevel: opts.pngCompressionLevel,
          palette: !metadata.hasAlpha, // Use palette for non-transparent PNGs
        })
        .toBuffer()
      format = 'png'
      break

    case '.gif':
      // GIF: Convert to PNG to preserve any transparency
      // (sharp doesn't support animated GIFs well, so we just optimize)
      outputBuffer = await resized.png({ compressionLevel: opts.pngCompressionLevel }).toBuffer()
      format = 'png'
      break

    case '.webp':
      // WebP: Preserve as WebP with quality setting
      outputBuffer = await resized.webp({ quality: opts.jpegQuality }).toBuffer()
      format = 'webp'
      break

    case '.tiff':
    case '.tif':
      // TIFF: Convert to JPEG for smaller size
      outputBuffer = await resized.jpeg({ quality: opts.jpegQuality }).toBuffer()
      format = 'jpeg'
      break

    case '.jpg':
    case '.jpeg':
    default:
      // JPEG: Standard quality compression
      outputBuffer = await resized.jpeg({ quality: opts.jpegQuality }).toBuffer()
      format = 'jpeg'
      break
  }

  return {
    buffer: outputBuffer,
    originalSize,
    compressedSize: outputBuffer.length,
    format,
  }
}

/**
 * Get compression stats as human-readable string
 */
export function formatCompressionStats(original: number, compressed: number): string {
  const savings = original - compressed
  const percentage = ((savings / original) * 100).toFixed(1)
  const originalMB = (original / 1024 / 1024).toFixed(2)
  const compressedMB = (compressed / 1024 / 1024).toFixed(2)
  return `${originalMB}MB → ${compressedMB}MB (${percentage}% smaller)`
}
