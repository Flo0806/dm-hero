import { defineStore } from 'pinia'
import type { CampaignNote } from '~~/types/note'

export const useNotesStore = defineStore('notes', {
  state: () => ({
    notes: [] as CampaignNote[],
    loading: false,
    lastFetchedCampaignId: null as number | null,
  }),

  getters: {
    // Count of pending (not completed) notes
    pendingCount: (state) => state.notes.filter((n) => !n.completed).length,

    // Count of completed notes
    completedCount: (state) => state.notes.filter((n) => n.completed).length,

    // Total note count
    noteCount: (state) => state.notes.length,

    // Get pending notes
    pendingNotes: (state) => state.notes.filter((n) => !n.completed),

    // Get completed notes
    completedNotes: (state) => state.notes.filter((n) => n.completed),
  },

  actions: {
    // Fetch all notes for a campaign
    async fetchNotes(campaignId: number) {
      if (this.loading) return

      this.loading = true
      try {
        const data = await $fetch<CampaignNote[]>('/api/notes', {
          query: { campaignId },
        })
        this.notes = data
        this.lastFetchedCampaignId = campaignId
      } catch (error) {
        console.error('Failed to fetch notes:', error)
        this.notes = []
      } finally {
        this.loading = false
      }
    },

    // Add a new note
    async addNote(campaignId: number, content: string): Promise<CampaignNote | null> {
      try {
        const note = await $fetch<CampaignNote>('/api/notes', {
          method: 'POST',
          body: { campaignId, content },
        })
        this.notes.push(note)
        return note
      } catch (error) {
        console.error('Failed to add note:', error)
        return null
      }
    },

    // Update a note
    async updateNote(noteId: number, updates: { content?: string; completed?: boolean }): Promise<CampaignNote | null> {
      try {
        const updated = await $fetch<CampaignNote>(`/api/notes/${noteId}`, {
          method: 'PATCH',
          body: updates,
        })
        const index = this.notes.findIndex((n) => n.id === noteId)
        if (index !== -1) {
          this.notes[index] = updated
        }
        return updated
      } catch (error) {
        console.error('Failed to update note:', error)
        return null
      }
    },

    // Toggle note completed status
    async toggleCompleted(noteId: number): Promise<boolean> {
      const note = this.notes.find((n) => n.id === noteId)
      if (!note) return false

      const updated = await this.updateNote(noteId, { completed: !note.completed })
      return updated !== null
    },

    // Delete a note
    async deleteNote(noteId: number): Promise<boolean> {
      try {
        await $fetch(`/api/notes/${noteId}`, {
          method: 'DELETE',
        })
        this.notes = this.notes.filter((n) => n.id !== noteId)
        return true
      } catch (error) {
        console.error('Failed to delete note:', error)
        return false
      }
    },

    // Clear all completed notes
    async clearCompleted(): Promise<void> {
      const completed = this.notes.filter((n) => n.completed)
      for (const note of completed) {
        await this.deleteNote(note.id)
      }
    },

    // Reorder notes
    async reorderNotes(noteIds: number[]): Promise<boolean> {
      // Update local order first
      const noteMap = new Map(this.notes.map((n) => [n.id, n]))
      this.notes = noteIds
        .map((id) => noteMap.get(id))
        .filter((n): n is CampaignNote => n !== undefined)

      try {
        await $fetch('/api/notes/reorder', {
          method: 'PATCH',
          body: { noteIds },
        })
        return true
      } catch (error) {
        console.error('Failed to reorder notes:', error)
        // Refetch on error to restore correct order
        if (this.lastFetchedCampaignId) {
          await this.fetchNotes(this.lastFetchedCampaignId)
        }
        return false
      }
    },

    // Clear all notes (e.g., when switching campaigns)
    clearNotes() {
      this.notes = []
      this.lastFetchedCampaignId = null
    },
  },
})
