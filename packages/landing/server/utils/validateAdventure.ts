/**
 * Adventure Validation Utility
 *
 * Validates .dmhero files (ZIP archives) for:
 * - File structure and format
 * - Allowed file types (no SVG!)
 * - Size limits (5MB/image, 35MB total, warn at 20MB)
 * - Content moderation (forbidden content)
 */

import AdmZip from 'adm-zip'
import { checkMultipleFields, type ContentViolation, getCategoryLabel } from './contentModeration'

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationError {
  type: 'structure' | 'filetype' | 'size' | 'content' | 'format'
  field?: string
  message: string
  details?: string
}

export interface ValidationWarning {
  type: 'size' | 'content'
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  stats: {
    totalSize: number
    fileCount: number
    imageCount: number
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB per image
const MAX_TOTAL_SIZE = 35 * 1024 * 1024 // 35MB total
const WARN_TOTAL_SIZE = 20 * 1024 * 1024 // Warn at 20MB

// Allowed file extensions by category
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  images: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  documents: ['.md', '.pdf'],
  audio: ['.mp3', '.wav', '.ogg'],
  data: ['.json'],
}

// Forbidden extensions (always reject)
const FORBIDDEN_EXTENSIONS = [
  '.svg', // XSS risk
  '.exe', '.dll', '.bat', '.cmd', '.ps1', '.sh', // Executables
  '.js', '.ts', '.jsx', '.tsx', '.mjs', // Scripts
  '.php', '.py', '.rb', '.pl', // Server scripts
  '.html', '.htm', '.xml', // Markup with script potential
]

// Magic bytes for common file types
const MAGIC_BYTES: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4E, 0x47],
  jpg: [0xFF, 0xD8, 0xFF],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  zip: [0x50, 0x4B, 0x03, 0x04],
  mp3: [0xFF, 0xFB], // or ID3
  id3: [0x49, 0x44, 0x33], // ID3 tag
  ogg: [0x4F, 0x67, 0x67, 0x53],
  wav: [0x52, 0x49, 0x46, 0x46], // RIFF header
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a .dmhero adventure file
 * @param filePath Path to the .dmhero file
 * @param metadata Additional metadata to validate (title, description from form)
 * @param locale Locale for error messages
 * @param originalFilename Original filename from upload (for content check)
 */
export async function validateAdventure(
  filePath: string,
  metadata?: { title?: string; description?: string; shortDescription?: string },
  locale: string = 'en',
  originalFilename?: string,
): Promise<ValidationResult> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  let totalSize = 0
  let fileCount = 0
  let imageCount = 0

  // Check original filename for forbidden content
  if (originalFilename) {
    // Remove extension and check the name part
    const nameWithoutExt = originalFilename.replace(/\.dmhero$/i, '')
    const filenameViolations = checkMultipleFields({
      filename: nameWithoutExt,
    })
    for (const violation of filenameViolations) {
      errors.push({
        type: 'content',
        field: 'filename',
        message: locale === 'de'
          ? `Dateiname enthält unzulässigen Inhalt (${getCategoryLabel(violation.category, locale)})`
          : `Filename contains forbidden content (${getCategoryLabel(violation.category, locale)})`,
      })
    }
  }

  // First validate metadata (form fields)
  if (metadata) {
    const metadataViolations = checkMultipleFields({
      title: metadata.title,
      description: metadata.description,
      shortDescription: metadata.shortDescription,
    })

    for (const violation of metadataViolations) {
      errors.push({
        type: 'content',
        field: violation.field,
        message: getContentErrorMessage(violation, locale),
      })
    }
  }

  // Try to read and parse the ZIP file
  let zip: AdmZip
  try {
    zip = new AdmZip(filePath)
  } catch {
    errors.push({
      type: 'structure',
      message: locale === 'de'
        ? 'Datei ist kein gültiges ZIP-Archiv'
        : 'File is not a valid ZIP archive',
    })
    return { valid: false, errors, warnings, stats: { totalSize: 0, fileCount: 0, imageCount: 0 } }
  }

  const entries = zip.getEntries()

  // Check for manifest.json
  const manifestEntry = entries.find((e) => e.entryName === 'manifest.json')
  if (!manifestEntry) {
    errors.push({
      type: 'structure',
      message: locale === 'de'
        ? 'manifest.json fehlt - keine gültige .dmhero Datei'
        : 'manifest.json missing - not a valid .dmhero file',
    })
    return { valid: false, errors, warnings, stats: { totalSize: 0, fileCount: 0, imageCount: 0 } }
  }

  // Parse manifest
  let manifest: Record<string, unknown>
  try {
    const manifestContent = manifestEntry.getData().toString('utf8')
    manifest = JSON.parse(manifestContent)
  } catch {
    errors.push({
      type: 'format',
      message: locale === 'de'
        ? 'manifest.json ist kein gültiges JSON'
        : 'manifest.json is not valid JSON',
    })
    return { valid: false, errors, warnings, stats: { totalSize: 0, fileCount: 0, imageCount: 0 } }
  }

  // Validate each file in the archive
  for (const entry of entries) {
    if (entry.isDirectory) continue

    fileCount++
    const size = entry.header.size
    totalSize += size
    const name = entry.entryName
    const ext = getExtension(name).toLowerCase()

    // Check for forbidden extensions
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      errors.push({
        type: 'filetype',
        field: name,
        message: locale === 'de'
          ? `Dateityp nicht erlaubt: ${ext}`
          : `File type not allowed: ${ext}`,
      })
      continue
    }

    // Check if it's an allowed extension
    const isImage = ALLOWED_EXTENSIONS.images.includes(ext)
    const isDocument = ALLOWED_EXTENSIONS.documents.includes(ext)
    const isAudio = ALLOWED_EXTENSIONS.audio.includes(ext)
    const isData = ALLOWED_EXTENSIONS.data.includes(ext)

    if (!isImage && !isDocument && !isAudio && !isData) {
      errors.push({
        type: 'filetype',
        field: name,
        message: locale === 'de'
          ? `Unbekannter Dateityp: ${ext}`
          : `Unknown file type: ${ext}`,
      })
      continue
    }

    // Check image-specific rules
    if (isImage) {
      imageCount++

      // Check size limit for images
      if (size > MAX_FILE_SIZE) {
        errors.push({
          type: 'size',
          field: name,
          message: locale === 'de'
            ? `Bild zu groß: ${formatBytes(size)} (max. 5 MB)`
            : `Image too large: ${formatBytes(size)} (max 5 MB)`,
        })
      }

      // Verify actual file type matches extension
      const buffer = entry.getData()
      if (!verifyImageType(buffer, ext)) {
        errors.push({
          type: 'filetype',
          field: name,
          message: locale === 'de'
            ? 'Dateityp stimmt nicht mit Endung überein'
            : 'File type does not match extension',
        })
      }
    }
  }

  // Check total size
  if (totalSize > MAX_TOTAL_SIZE) {
    errors.push({
      type: 'size',
      message: locale === 'de'
        ? `Gesamtgröße zu groß: ${formatBytes(totalSize)} (max. 35 MB)`
        : `Total size too large: ${formatBytes(totalSize)} (max 35 MB)`,
    })
  } else if (totalSize > WARN_TOTAL_SIZE) {
    warnings.push({
      type: 'size',
      message: locale === 'de'
        ? `Große Datei: ${formatBytes(totalSize)} - Downloads können langsam sein`
        : `Large file: ${formatBytes(totalSize)} - downloads may be slow`,
    })
  }

  // Validate manifest content for forbidden terms
  const contentErrors = validateManifestContent(manifest, locale)
  errors.push(...contentErrors)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: { totalSize, fileCount, imageCount },
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(lastDot) : ''
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function verifyImageType(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 8) return false

  const ext = extension.toLowerCase().replace('.', '')

  switch (ext) {
    case 'png':
      return matchMagicBytes(buffer, MAGIC_BYTES.png)
    case 'jpg':
    case 'jpeg':
      return matchMagicBytes(buffer, MAGIC_BYTES.jpg)
    case 'gif':
      return matchMagicBytes(buffer, MAGIC_BYTES.gif)
    case 'webp':
      // WebP starts with RIFF....WEBP
      return matchMagicBytes(buffer, MAGIC_BYTES.webp) &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    default:
      return true // Allow unknown types to pass this check
  }
}

function matchMagicBytes(buffer: Buffer, magic: number[]): boolean {
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false
  }
  return true
}

function getContentErrorMessage(violation: ContentViolation, locale: string): string {
  const category = getCategoryLabel(violation.category, locale)
  const field = getFieldLabel(violation.field, locale)

  if (locale === 'de') {
    return `${field} enthält unzulässigen Inhalt (${category})`
  }
  return `${field} contains forbidden content (${category})`
}

function getFieldLabel(field: string, locale: string): string {
  const labels: Record<string, Record<string, string>> = {
    title: { en: 'Title', de: 'Titel' },
    description: { en: 'Description', de: 'Beschreibung' },
    shortDescription: { en: 'Short description', de: 'Kurzbeschreibung' },
    name: { en: 'Name', de: 'Name' },
    summary: { en: 'Summary', de: 'Zusammenfassung' },
    notes: { en: 'Notes', de: 'Notizen' },
    filename: { en: 'Filename', de: 'Dateiname' },
  }
  return labels[field]?.[locale] || labels[field]?.en || field
}

/**
 * Validate content inside the manifest for forbidden terms
 */
function validateManifestContent(manifest: Record<string, unknown>, locale: string): ValidationError[] {
  const errors: ValidationError[] = []

  // Check meta fields
  const meta = manifest.meta as Record<string, unknown> | undefined
  if (meta) {
    const metaViolations = checkMultipleFields({
      title: meta.title as string,
      description: meta.description as string,
    })
    for (const v of metaViolations) {
      errors.push({
        type: 'content',
        field: `manifest.meta.${v.field}`,
        message: getContentErrorMessage(v, locale),
      })
    }
  }

  // Check campaign
  const campaign = manifest.campaign as Record<string, unknown> | undefined
  if (campaign) {
    const campaignViolations = checkMultipleFields({
      name: campaign.name as string,
      description: campaign.description as string,
    })
    for (const v of campaignViolations) {
      errors.push({
        type: 'content',
        field: `manifest.campaign.${v.field}`,
        message: getContentErrorMessage(v, locale),
      })
    }
  }

  // Check entities
  const entities = manifest.entities as Array<Record<string, unknown>> | undefined
  if (entities && Array.isArray(entities)) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const violations = checkMultipleFields({
        name: entity.name as string,
        description: entity.description as string,
      })
      for (const v of violations) {
        errors.push({
          type: 'content',
          field: `entity[${i}].${v.field}`,
          message: getContentErrorMessage(v, locale),
          details: `Entity: ${entity.name || 'Unknown'}`,
        })
      }
    }
  }

  // Check sessions
  const sessions = manifest.sessions as Array<Record<string, unknown>> | undefined
  if (sessions && Array.isArray(sessions)) {
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const violations = checkMultipleFields({
        title: session.title as string,
        summary: session.summary as string,
        notes: session.notes as string,
      })
      for (const v of violations) {
        errors.push({
          type: 'content',
          field: `session[${i}].${v.field}`,
          message: getContentErrorMessage(v, locale),
          details: `Session: ${session.title || `#${session.session_number}` || 'Unknown'}`,
        })
      }
    }
  }

  return errors
}

// =============================================================================
// QUICK SIZE CHECK (for upload preview)
// =============================================================================

/**
 * Quick size check for file upload preview
 * Returns warnings without full validation
 */
export function checkFileSize(fileSize: number): { warning?: string; blocked: boolean } {
  if (fileSize > MAX_TOTAL_SIZE) {
    return {
      warning: `File is too large (${formatBytes(fileSize)}). Maximum allowed: 35 MB`,
      blocked: true,
    }
  }
  if (fileSize > WARN_TOTAL_SIZE) {
    return {
      warning: `Large file (${formatBytes(fileSize)}). Downloads may be slow.`,
      blocked: false,
    }
  }
  return { blocked: false }
}
