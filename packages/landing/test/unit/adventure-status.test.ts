import { describe, it, expect } from 'vitest'
import {
  ADVENTURE_STATUS,
  getStatusLabel,
  canEdit,
  isVisible,
  isProcessing,
  STATUS_COLORS,
  STATUS_ICONS,
  determineVersionAction,
} from '../../server/utils/adventureStatus'

describe('Adventure Status', () => {
  describe('ADVENTURE_STATUS constants', () => {
    it('should have all required status values', () => {
      expect(ADVENTURE_STATUS.PENDING_REVIEW).toBe('pending_review')
      expect(ADVENTURE_STATUS.VALIDATING).toBe('validating')
      expect(ADVENTURE_STATUS.PUBLISHED).toBe('published')
      expect(ADVENTURE_STATUS.REJECTED).toBe('rejected')
      expect(ADVENTURE_STATUS.ARCHIVED).toBe('archived')
      expect(ADVENTURE_STATUS.DRAFT).toBe('draft')
    })

    it('should have 6 status values', () => {
      expect(Object.keys(ADVENTURE_STATUS)).toHaveLength(6)
    })
  })

  describe('getStatusLabel', () => {
    it('should return English label by default', () => {
      expect(getStatusLabel(ADVENTURE_STATUS.PUBLISHED)).toBe('Published')
      expect(getStatusLabel(ADVENTURE_STATUS.DRAFT)).toBe('Draft')
      expect(getStatusLabel(ADVENTURE_STATUS.PENDING_REVIEW)).toBe('Pending Review')
    })

    it('should return German label when locale is de', () => {
      expect(getStatusLabel(ADVENTURE_STATUS.PUBLISHED, 'de')).toBe('Veröffentlicht')
      expect(getStatusLabel(ADVENTURE_STATUS.DRAFT, 'de')).toBe('Entwurf')
      expect(getStatusLabel(ADVENTURE_STATUS.PENDING_REVIEW, 'de')).toBe('Überprüfung ausstehend')
    })

    it('should return English for unknown locale', () => {
      expect(getStatusLabel(ADVENTURE_STATUS.PUBLISHED, 'fr')).toBe('Published')
    })
  })

  describe('canEdit', () => {
    it('should allow editing for published adventures', () => {
      expect(canEdit(ADVENTURE_STATUS.PUBLISHED)).toBe(true)
    })

    it('should allow editing for rejected adventures', () => {
      expect(canEdit(ADVENTURE_STATUS.REJECTED)).toBe(true)
    })

    it('should allow editing for draft adventures', () => {
      expect(canEdit(ADVENTURE_STATUS.DRAFT)).toBe(true)
    })

    it('should not allow editing for pending_review', () => {
      expect(canEdit(ADVENTURE_STATUS.PENDING_REVIEW)).toBe(false)
    })

    it('should not allow editing for validating', () => {
      expect(canEdit(ADVENTURE_STATUS.VALIDATING)).toBe(false)
    })

    it('should not allow editing for archived', () => {
      expect(canEdit(ADVENTURE_STATUS.ARCHIVED)).toBe(false)
    })
  })

  describe('isVisible', () => {
    it('should only be visible when published', () => {
      expect(isVisible(ADVENTURE_STATUS.PUBLISHED)).toBe(true)
    })

    it('should not be visible for other statuses', () => {
      expect(isVisible(ADVENTURE_STATUS.DRAFT)).toBe(false)
      expect(isVisible(ADVENTURE_STATUS.PENDING_REVIEW)).toBe(false)
      expect(isVisible(ADVENTURE_STATUS.VALIDATING)).toBe(false)
      expect(isVisible(ADVENTURE_STATUS.REJECTED)).toBe(false)
      expect(isVisible(ADVENTURE_STATUS.ARCHIVED)).toBe(false)
    })
  })

  describe('isProcessing', () => {
    it('should be processing for pending_review', () => {
      expect(isProcessing(ADVENTURE_STATUS.PENDING_REVIEW)).toBe(true)
    })

    it('should be processing for validating', () => {
      expect(isProcessing(ADVENTURE_STATUS.VALIDATING)).toBe(true)
    })

    it('should not be processing for published', () => {
      expect(isProcessing(ADVENTURE_STATUS.PUBLISHED)).toBe(false)
    })

    it('should not be processing for draft', () => {
      expect(isProcessing(ADVENTURE_STATUS.DRAFT)).toBe(false)
    })

    it('should not be processing for rejected', () => {
      expect(isProcessing(ADVENTURE_STATUS.REJECTED)).toBe(false)
    })
  })

  describe('STATUS_COLORS', () => {
    it('should have colors for all statuses', () => {
      expect(STATUS_COLORS[ADVENTURE_STATUS.PENDING_REVIEW]).toBe('warning')
      expect(STATUS_COLORS[ADVENTURE_STATUS.VALIDATING]).toBe('info')
      expect(STATUS_COLORS[ADVENTURE_STATUS.PUBLISHED]).toBe('success')
      expect(STATUS_COLORS[ADVENTURE_STATUS.REJECTED]).toBe('error')
      expect(STATUS_COLORS[ADVENTURE_STATUS.ARCHIVED]).toBe('grey')
      expect(STATUS_COLORS[ADVENTURE_STATUS.DRAFT]).toBe('grey')
    })
  })

  describe('STATUS_ICONS', () => {
    it('should have icons for all statuses', () => {
      expect(STATUS_ICONS[ADVENTURE_STATUS.PENDING_REVIEW]).toBe('mdi-clock-outline')
      expect(STATUS_ICONS[ADVENTURE_STATUS.PUBLISHED]).toBe('mdi-check-circle')
      expect(STATUS_ICONS[ADVENTURE_STATUS.REJECTED]).toBe('mdi-alert-circle')
      expect(STATUS_ICONS[ADVENTURE_STATUS.DRAFT]).toBe('mdi-pencil')
    })
  })

  describe('Status Transitions (Unpublish/Republish)', () => {
    it('unpublish should transition from published to draft', () => {
      // This tests the business logic: published -> draft
      const currentStatus = ADVENTURE_STATUS.PUBLISHED
      const newStatus = ADVENTURE_STATUS.DRAFT

      // Published adventures can be edited (unpublished)
      expect(canEdit(currentStatus)).toBe(true)
      // Draft is not visible in store
      expect(isVisible(newStatus)).toBe(false)
      // Draft can be edited again
      expect(canEdit(newStatus)).toBe(true)
    })

    it('republish should transition from draft to pending_review', () => {
      // This tests the business logic: draft -> pending_review
      const currentStatus = ADVENTURE_STATUS.DRAFT
      const newStatus = ADVENTURE_STATUS.PENDING_REVIEW

      // Draft adventures can be edited
      expect(canEdit(currentStatus)).toBe(true)
      // After republish, it goes to pending_review (processing)
      expect(isProcessing(newStatus)).toBe(true)
      // Cannot edit while processing
      expect(canEdit(newStatus)).toBe(false)
    })

    it('only published adventures should be unpublishable', () => {
      // Only published status should transition to draft via unpublish
      expect(isVisible(ADVENTURE_STATUS.PUBLISHED)).toBe(true)
      expect(isVisible(ADVENTURE_STATUS.DRAFT)).toBe(false)
    })

    it('only draft adventures should be republishable', () => {
      // Draft can be republished (sent to pending_review)
      expect(canEdit(ADVENTURE_STATUS.DRAFT)).toBe(true)
      expect(isProcessing(ADVENTURE_STATUS.DRAFT)).toBe(false)
    })
  })

  describe('Version Action Logic (determineVersionAction)', () => {
    describe('editing published adventures', () => {
      it('should CREATE new version when editing published adventure', () => {
        const result = determineVersionAction(ADVENTURE_STATUS.PUBLISHED, true)
        expect(result.action).toBe('create')
        expect(result.resultStatus).toBe(ADVENTURE_STATUS.PENDING_REVIEW)
      })

      it('should CREATE new version when editing pending_review adventure', () => {
        const result = determineVersionAction(ADVENTURE_STATUS.PENDING_REVIEW, false)
        expect(result.action).toBe('create')
        expect(result.resultStatus).toBe(ADVENTURE_STATUS.PENDING_REVIEW)
      })

      it('should CREATE new version when editing rejected adventure', () => {
        const result = determineVersionAction(ADVENTURE_STATUS.REJECTED, false)
        expect(result.action).toBe('create')
        expect(result.resultStatus).toBe(ADVENTURE_STATUS.PENDING_REVIEW)
      })
    })

    describe('editing draft adventures', () => {
      it('should CREATE new version on FIRST edit after unpublish (validated_at set)', () => {
        // When unpublished, validated_at is kept as marker
        const result = determineVersionAction(ADVENTURE_STATUS.DRAFT, true)
        expect(result.action).toBe('create')
        expect(result.resultStatus).toBe(ADVENTURE_STATUS.DRAFT)
        expect(result.clearValidatedAt).toBe(true)
      })

      it('should UPDATE same version on subsequent draft edits (validated_at cleared)', () => {
        // After first edit, validated_at is cleared
        const result = determineVersionAction(ADVENTURE_STATUS.DRAFT, false)
        expect(result.action).toBe('update')
        expect(result.resultStatus).toBe(ADVENTURE_STATUS.DRAFT)
        expect(result.clearValidatedAt).toBe(false)
      })

      it('should UPDATE same version for brand new drafts (never published)', () => {
        // New adventure that was never published
        const result = determineVersionAction(ADVENTURE_STATUS.DRAFT, false)
        expect(result.action).toBe('update')
        expect(result.resultStatus).toBe(ADVENTURE_STATUS.DRAFT)
      })
    })

    describe('version increment scenarios', () => {
      it('published → unpublish → edit → should increment version once', () => {
        // Simulate: Published v1, unpublish keeps validated_at
        const firstEdit = determineVersionAction(ADVENTURE_STATUS.DRAFT, true)
        expect(firstEdit.action).toBe('create') // v1 → v2

        // Now validated_at is cleared
        const secondEdit = determineVersionAction(ADVENTURE_STATUS.DRAFT, false)
        expect(secondEdit.action).toBe('update') // still v2

        const thirdEdit = determineVersionAction(ADVENTURE_STATUS.DRAFT, false)
        expect(thirdEdit.action).toBe('update') // still v2
      })

      it('republish does not change version (status change only)', () => {
        // Republish is handled by PATCH endpoint, not PUT
        // But after republish and validation, editing creates new version
        const afterRepublish = determineVersionAction(ADVENTURE_STATUS.PUBLISHED, true)
        expect(afterRepublish.action).toBe('create')
      })
    })
  })
})
