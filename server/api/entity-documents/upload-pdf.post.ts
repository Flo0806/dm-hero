import { getDb } from '../../utils/db'
import { randomUUID } from 'crypto'

/**
 * POST /api/entity-documents/upload-pdf
 * Upload a PDF file and create a document entry
 */
export default defineEventHandler(async (event) => {
  const db = getDb()

  try {
    // Parse multipart form data
    const form = await readMultipartFormData(event)
    if (!form) {
      throw createError({
        statusCode: 400,
        message: 'No form data provided',
      })
    }

    // Extract fields
    let entityId: number | null = null
    let title = ''
    let file: { filename: string; data: Buffer } | null = null

    for (const part of form) {
      if (part.name === 'entityId') {
        entityId = Number.parseInt(part.data.toString(), 10)
      } else if (part.name === 'title') {
        title = part.data.toString()
      } else if (part.name === 'file' && part.filename) {
        file = {
          filename: part.filename,
          data: part.data,
        }
      }
    }

    // Validate required fields
    if (!entityId) {
      throw createError({
        statusCode: 400,
        message: 'Entity ID is required',
      })
    }

    if (!title) {
      throw createError({
        statusCode: 400,
        message: 'Title is required',
      })
    }

    if (!file) {
      throw createError({
        statusCode: 400,
        message: 'PDF file is required',
      })
    }

    // Validate file type (PDF only)
    const ext = file.filename.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf') {
      throw createError({
        statusCode: 400,
        message: 'Only PDF files are allowed',
      })
    }

    // Generate unique filename with UUID
    const uniqueFilename = `${randomUUID()}.pdf`

    // Save file to storage (same location as uploaded images)
    const storage = useStorage('pictures')
    await storage.setItemRaw(uniqueFilename, file.data)

    // Get current max sort_order for this entity
    const maxOrderResult = db
      .prepare(
        `
      SELECT MAX(sort_order) as max_order
      FROM entity_documents
      WHERE entity_id = ?
    `,
      )
      .get(entityId) as { max_order: number | null }

    const sortOrder = (maxOrderResult.max_order || -1) + 1

    // Insert document record
    const result = db
      .prepare(
        `
      INSERT INTO entity_documents (entity_id, title, file_path, file_type, content, date, sort_order)
      VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
    `,
      )
      .run(entityId, title, uniqueFilename, 'pdf', '', sortOrder)

    // Return created document
    return {
      id: result.lastInsertRowid,
      entity_id: entityId,
      title,
      file_path: uniqueFilename,
      file_type: 'pdf',
      sort_order: sortOrder,
    }
  } catch (error) {
    console.error('PDF upload error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to upload PDF',
    })
  }
})
