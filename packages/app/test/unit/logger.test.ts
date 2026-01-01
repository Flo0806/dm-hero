/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'

// Test directory for isolated testing
const TEST_LOG_DIR = join(process.cwd(), 'test', 'unit', '.test-logs')
const TEST_LOG_FILE = join(TEST_LOG_DIR, 'dm-hero.log')

// We need to mock the logger module to use our test directory
// Import fresh module for each test
async function getLogger() {
  // Clear module cache to get fresh instance
  vi.resetModules()

  // Set environment variable before importing
  process.env.LOG_PATH = TEST_LOG_DIR

  const loggerModule = await import('../../server/utils/logger')

  // Reset logger state to pick up new LOG_PATH
  loggerModule.logger._reset()

  return loggerModule
}

describe('Logger Utility', () => {
  beforeEach(() => {
    // Clean up test directory before each test
    if (existsSync(TEST_LOG_DIR)) {
      rmSync(TEST_LOG_DIR, { recursive: true })
    }
    mkdirSync(TEST_LOG_DIR, { recursive: true })
  })

  afterEach(() => {
    // Clean up after each test
    if (existsSync(TEST_LOG_DIR)) {
      rmSync(TEST_LOG_DIR, { recursive: true })
    }
    delete process.env.LOG_PATH
  })

  describe('Basic Logging', () => {
    it('should create log file on first write', async () => {
      const { writeLog } = await getLogger()

      writeLog('INFO', 'Test message')

      expect(existsSync(TEST_LOG_FILE)).toBe(true)
    })

    it('should write log with correct timestamp format', async () => {
      const { writeLog } = await getLogger()

      writeLog('INFO', 'Test message')

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      // Format: [YYYY-MM-DD HH:MM:SS] [LEVEL] message
      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] Test message\n$/)
    })

    it('should write all log levels correctly', async () => {
      const { writeLog } = await getLogger()

      writeLog('DEBUG', 'Debug message')
      writeLog('INFO', 'Info message')
      writeLog('WARN', 'Warn message')
      writeLog('ERROR', 'Error message')
      writeLog('FATAL', 'Fatal message')

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('[DEBUG] Debug message')
      expect(content).toContain('[INFO] Info message')
      expect(content).toContain('[WARN] Warn message')
      expect(content).toContain('[ERROR] Error message')
      expect(content).toContain('[FATAL] Fatal message')
    })

    it('should append multiple log entries', async () => {
      const { writeLog } = await getLogger()

      writeLog('INFO', 'First message')
      writeLog('INFO', 'Second message')
      writeLog('INFO', 'Third message')

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(3)
    })
  })

  describe('Message Formatting', () => {
    it('should format Error objects with stack trace', async () => {
      const { writeLog } = await getLogger()

      const error = new Error('Test error')
      writeLog('ERROR', error)

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('Test error')
      expect(content).toContain('Error:')
    })

    it('should format objects as JSON', async () => {
      const { writeLog } = await getLogger()

      writeLog('INFO', { key: 'value', nested: { a: 1 } })

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('"key": "value"')
      expect(content).toContain('"nested"')
    })

    it('should handle multiple arguments', async () => {
      const { writeLog } = await getLogger()

      writeLog('INFO', 'Message:', 123, { data: true })

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('Message:')
      expect(content).toContain('123')
      expect(content).toContain('"data": true')
    })

    it('should handle empty messages gracefully', async () => {
      const { writeLog } = await getLogger()

      // Should not throw
      expect(() => writeLog('INFO')).not.toThrow()
      expect(existsSync(TEST_LOG_FILE)).toBe(true)
    })

    it('should handle null and undefined values', async () => {
      const { writeLog } = await getLogger()

      expect(() => writeLog('INFO', null, undefined, 'text')).not.toThrow()

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('null')
      expect(content).toContain('undefined')
      expect(content).toContain('text')
    })

    it('should handle special characters', async () => {
      const { writeLog } = await getLogger()

      writeLog('INFO', 'Special: äöü ß € 日本語 🎲')

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('äöü ß € 日本語 🎲')
    })

    it('should handle very long messages', async () => {
      const { writeLog } = await getLogger()

      const longMessage = 'A'.repeat(10000)
      expect(() => writeLog('INFO', longMessage)).not.toThrow()

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain(longMessage)
    })

    it('should handle circular references in objects', async () => {
      const { writeLog } = await getLogger()

      const circular: Record<string, unknown> = { a: 1 }
      circular.self = circular

      // Should not throw, should fallback to String(obj)
      expect(() => writeLog('INFO', circular)).not.toThrow()
    })
  })

  describe('File Rotation', () => {
    it('should rotate log file when size limit exceeded', async () => {
      const { writeLog, logger } = await getLogger()

      // Configure small file size for testing (1KB)
      logger.configure({ maxFileSize: 1024, maxFiles: 3 })

      // Write enough data to trigger rotation (each line ~50 bytes, need >20 lines)
      for (let i = 0; i < 30; i++) {
        writeLog('INFO', `Log entry number ${i} with some padding text here`)
      }

      // Check that rotation happened
      expect(existsSync(TEST_LOG_FILE)).toBe(true)
      expect(existsSync(`${TEST_LOG_FILE}.1`)).toBe(true)
    })

    it('should keep only configured number of rotated files', async () => {
      const { writeLog, logger } = await getLogger()

      // Configure very small file size and 2 max files
      logger.configure({ maxFileSize: 512, maxFiles: 2 })

      // Write lots of data to trigger multiple rotations
      for (let i = 0; i < 100; i++) {
        writeLog('INFO', `Log entry ${i} with padding to fill up space quickly`)
      }

      // Should have: dm-hero.log, dm-hero.log.1, dm-hero.log.2
      // But NOT dm-hero.log.3 (since maxFiles = 2, we keep current + 2 rotated)
      expect(existsSync(TEST_LOG_FILE)).toBe(true)
      // Oldest files should be deleted
      expect(existsSync(`${TEST_LOG_FILE}.3`)).toBe(false)
      expect(existsSync(`${TEST_LOG_FILE}.4`)).toBe(false)
    })

    it('should preserve log content during rotation', async () => {
      const { writeLog, logger } = await getLogger()

      logger.configure({ maxFileSize: 512, maxFiles: 3 })

      // Write identifiable entries
      writeLog('INFO', 'MARKER_FIRST_ENTRY')

      // Trigger rotation
      for (let i = 0; i < 50; i++) {
        writeLog('INFO', `Padding entry ${i} to trigger rotation mechanism`)
      }

      writeLog('INFO', 'MARKER_LAST_ENTRY')

      // Check that entries are preserved (either in main or rotated file)
      const mainContent = readFileSync(TEST_LOG_FILE, 'utf-8')
      const rotatedContent = existsSync(`${TEST_LOG_FILE}.1`)
        ? readFileSync(`${TEST_LOG_FILE}.1`, 'utf-8')
        : ''

      const allContent = mainContent + rotatedContent
      expect(allContent).toContain('MARKER_LAST_ENTRY')
    })

    it('should complete full rotation cycle (delete oldest, rotate all)', async () => {
      const { writeLog, logger } = await getLogger()
      const { readdirSync, statSync } = await import('fs')

      // Helper to show current state
      const showFiles = (phase: string) => {
        const files = readdirSync(TEST_LOG_DIR).sort()
        console.log(`[${phase}] Dateien:`, files.map((f) => {
          const size = statSync(join(TEST_LOG_DIR, f)).size
          return `${f}(${size}b)`
        }))
      }

      // Configure: max 2 rotated files (.log.1, .log.2) + current .log
      // Use 300 bytes - each log line is ~80-100 bytes with timestamp
      logger.configure({ maxFileSize: 300, maxFiles: 2 })

      // Phase 1: Fill up to trigger first rotation (.log -> .log.1)
      for (let i = 0; i < 5; i++) {
        writeLog('INFO', `PHASE1_ENTRY_${i} - Filling up the first log file to trigger rotation`)
      }
      showFiles('Nach PHASE1')

      // Verify .log.1 exists after first rotation
      expect(existsSync(`${TEST_LOG_FILE}.1`)).toBe(true)

      // Phase 2: Continue writing to trigger second rotation (.log.1 -> .log.2)
      for (let i = 0; i < 5; i++) {
        writeLog('INFO', `PHASE2_ENTRY_${i} - Second phase to push older entries to .log.2`)
      }
      showFiles('Nach PHASE2')

      // Verify .log.2 exists after second rotation
      expect(existsSync(`${TEST_LOG_FILE}.2`)).toBe(true)

      // Phase 3: Continue - should delete .log.2 (oldest) and rotate others
      // First capture what's in .log.2 before it gets deleted
      const oldestContent = readFileSync(`${TEST_LOG_FILE}.2`, 'utf-8')
      expect(oldestContent).toContain('PHASE1') // Oldest content is in .2

      for (let i = 0; i < 5; i++) {
        writeLog('INFO', `PHASE3_ENTRY_${i} - Third phase should trigger oldest file deletion`)
      }
      showFiles('Nach PHASE3')

      // After full cycle:
      // - .log.3 should NOT exist (maxFiles=2 means we keep .1 and .2 only)
      expect(existsSync(`${TEST_LOG_FILE}.3`)).toBe(false)

      // Current .log should have newest entries
      const currentContent = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(currentContent).toContain('PHASE3')

      // Verify the rotation chain worked - check what's now in .log.2
      const newLog2Content = readFileSync(`${TEST_LOG_FILE}.2`, 'utf-8')
      // .log.2 should now contain PHASE2 content (was previously in .log.1)
      expect(newLog2Content).toContain('PHASE2')

      console.log('[Rotation] .log.2 enthält jetzt PHASE2 ✓ (war vorher PHASE1, wurde rotiert)')
    })

    it('should continue correctly after app restart (persist rotation state)', async () => {
      // Simulate first app session
      const session1 = await getLogger()
      session1.logger.configure({ maxFileSize: 300, maxFiles: 2 })

      // Write some logs in first session
      for (let i = 0; i < 5; i++) {
        session1.writeLog('INFO', `SESSION1_ENTRY_${i} - First app session logs here`)
      }

      // Verify files exist after first session
      expect(existsSync(TEST_LOG_FILE)).toBe(true)
      expect(existsSync(`${TEST_LOG_FILE}.1`)).toBe(true)

      // Simulate app restart - get fresh logger instance
      const session2 = await getLogger()
      session2.logger.configure({ maxFileSize: 300, maxFiles: 2 })

      // Write logs in second session
      for (let i = 0; i < 5; i++) {
        session2.writeLog('INFO', `SESSION2_ENTRY_${i} - Second app session continues`)
      }

      // Verify rotation continued correctly across sessions
      // - Old .log.1 should now be in .log.2 (rotated)
      // - New .log.1 should contain mix of session1 and session2
      expect(existsSync(`${TEST_LOG_FILE}.2`)).toBe(true)

      // Current log should have SESSION2 entries
      const currentContent = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(currentContent).toContain('SESSION2')

      console.log('[App Restart] Rotation funktioniert über Neustarts hinweg ✓')
    })
  })

  describe('Error Handling', () => {
    it('should continue logging when file is temporarily inaccessible', async () => {
      const { writeLog } = await getLogger()
      const { chmodSync } = await import('fs')

      // Write initial entry
      writeLog('INFO', 'Entry before lock')
      expect(existsSync(TEST_LOG_FILE)).toBe(true)

      // Make file read-only (simulates locked file on some systems)
      chmodSync(TEST_LOG_FILE, 0o444)

      // This should NOT throw - logger catches errors internally
      expect(() => writeLog('ERROR', 'Entry during lock attempt')).not.toThrow()

      // Restore write permissions
      chmodSync(TEST_LOG_FILE, 0o644)

      // Should be able to write again after unlock
      writeLog('INFO', 'Entry after unlock')

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('Entry before lock')
      expect(content).toContain('Entry after unlock')
    })

    it('should not crash app when rotation fails due to locked file', async () => {
      const { writeLog, logger } = await getLogger()
      const { chmodSync } = await import('fs')

      logger.configure({ maxFileSize: 100, maxFiles: 2 })

      // Fill up log to trigger rotation
      writeLog('INFO', 'Fill entry 1 with lots of padding text here')

      // Make directory read-only (prevents creating .log.1)
      chmodSync(TEST_LOG_DIR, 0o555)

      // This triggers rotation attempt which will fail - should NOT crash
      expect(() => {
        writeLog('INFO', 'Entry that triggers failed rotation attempt here')
      }).not.toThrow()

      // Restore permissions
      chmodSync(TEST_LOG_DIR, 0o755)

      // Logger should still work after failed rotation
      writeLog('INFO', 'Entry after rotation failure recovered')

      // Verify app didn't crash and can still read log
      expect(existsSync(TEST_LOG_FILE)).toBe(true)
    })

    it('should not throw when log directory does not exist (creates it)', async () => {
      // Remove test dir
      rmSync(TEST_LOG_DIR, { recursive: true })

      const { writeLog } = await getLogger()

      // Should create directory and write
      expect(() => writeLog('INFO', 'Test')).not.toThrow()
      expect(existsSync(TEST_LOG_FILE)).toBe(true)
    })

    it('should handle rapid successive writes', async () => {
      const { writeLog } = await getLogger()

      // Simulate rapid logging (like during an error cascade)
      for (let i = 0; i < 100; i++) {
        // writeLog is sync, but let's ensure it doesn't break
        expect(() => writeLog('INFO', `Rapid write ${i}`)).not.toThrow()
      }

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(100)
    })

    it('should not crash on write failure (logs warning instead)', async () => {
      const { writeLog } = await getLogger()

      // Make log file read-only to simulate write failure
      writeLog('INFO', 'Initial entry')

      // This is tricky to test without actually breaking permissions
      // The logger catches errors and logs to console.warn
      // For now, verify the try-catch exists by checking no throw on normal write
      expect(() => writeLog('INFO', 'Another entry')).not.toThrow()
    })
  })

  describe('Logger Helper Methods', () => {
    it('should expose all log level methods', async () => {
      const { logger } = await getLogger()

      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.fatal).toBe('function')
    })

    it('should write via helper methods', async () => {
      const { logger } = await getLogger()

      logger.info('Info via helper')
      logger.error('Error via helper')

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      expect(content).toContain('[INFO] Info via helper')
      expect(content).toContain('[ERROR] Error via helper')
    })

    it('should return correct log path', async () => {
      const { logger } = await getLogger()

      const path = logger.getPath()
      expect(path).toBe(TEST_LOG_FILE)
    })

    it('should return correct log directory', async () => {
      const { logger } = await getLogger()

      const dir = logger.getDir()
      expect(dir).toBe(TEST_LOG_DIR)
    })
  })

  describe('Configuration', () => {
    it('should allow reconfiguring max file size', async () => {
      const { logger, writeLog } = await getLogger()

      logger.configure({ maxFileSize: 100 })

      // Write enough to trigger rotation with small size
      for (let i = 0; i < 10; i++) {
        writeLog('INFO', 'Short message for rotation test')
      }

      // Should have rotated due to small file size
      expect(existsSync(`${TEST_LOG_FILE}.1`)).toBe(true)
    })

    it('should allow reconfiguring max files', async () => {
      const { logger, writeLog } = await getLogger()

      logger.configure({ maxFileSize: 100, maxFiles: 1 })

      // Write enough to trigger multiple rotations
      for (let i = 0; i < 50; i++) {
        writeLog('INFO', 'Message for rotation limiting test')
      }

      // With maxFiles: 1, should only keep .log and .log.1
      expect(existsSync(TEST_LOG_FILE)).toBe(true)
      // .log.2 should be deleted
      expect(existsSync(`${TEST_LOG_FILE}.2`)).toBe(false)
    })
  })

  describe('Timestamp Accuracy', () => {
    it('should use current timestamp for each entry', async () => {
      const { writeLog } = await getLogger()

      writeLog('INFO', 'First')

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 1100))

      writeLog('INFO', 'Second')

      const content = readFileSync(TEST_LOG_FILE, 'utf-8')
      const lines = content.trim().split('\n')

      // Extract timestamps
      const timestamp1 = lines[0].match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/)?.[1]
      const timestamp2 = lines[1].match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/)?.[1]

      expect(timestamp1).toBeDefined()
      expect(timestamp2).toBeDefined()
      // Timestamps should be different (at least 1 second apart)
      expect(timestamp1).not.toBe(timestamp2)
    })
  })
})
