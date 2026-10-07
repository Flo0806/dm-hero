import { defineStore } from 'pinia'
import type { StoryNode, StoryNodeKind, StoryNodeLinks, StoryNodeListItem } from '~~/types/story'

export interface StoryTreeNode extends StoryNodeListItem {
  children: StoryTreeNode[]
}

// The campaign manager's tree (GM-only scenario prep)
export const useStoryStore = defineStore('story', {
  /** Flat node list of the loaded campaign. */
  state: () => ({
    nodes: [] as StoryNodeListItem[],
    loading: false,
    lastFetchedCampaignId: null as number | null,
    /** Bumped by every tree load: an answer only applies if no newer load started */
    treeRequest: 0,
  }),

  getters: {
    /** Nested tree built from the flat list (ordered by sort_order). */
    tree: (state): StoryTreeNode[] => {
      const byId = new Map<number, StoryTreeNode>()
      for (const n of state.nodes) byId.set(n.id, { ...n, children: [] })
      const roots: StoryTreeNode[] = []
      for (const n of [...byId.values()].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)) {
        const parent = n.parent_id !== null ? byId.get(n.parent_id) : undefined
        if (parent) parent.children.push(n)
        else roots.push(n)
      }
      return roots
    },
    /** Look up a node by id. */
    byId: state => (id: number) => state.nodes.find(n => n.id === id),

    /** Reading order (depth-first, like the tree shows it) - for previous/next. */
    ordered(): StoryNodeListItem[] {
      const result: StoryNodeListItem[] = []
      /** Append nodes and their descendants in order. */
      const walk = (nodes: StoryTreeNode[]) => {
        for (const n of nodes) {
          result.push(n)
          walk(n.children)
        }
      }
      walk(this.tree)
      return result
    },

    /** Ancestors of a node, root first, without the node itself (stops on a parent cycle). */
    ancestors: state => (id: number): StoryNodeListItem[] => {
      const chain: StoryNodeListItem[] = []
      const seen = new Set<number>([id])
      let current = state.nodes.find(n => n.id === id)
      while (current?.parent_id && !seen.has(current.parent_id)) {
        seen.add(current.parent_id)
        current = state.nodes.find(n => n.id === current!.parent_id)
        if (current) chain.unshift(current)
      }
      return chain
    },

    /** Per node with scenes below it: how many of them are done (played or skipped). */
    progress(): Map<number, { done: number, total: number }> {
      const result = new Map<number, { done: number, total: number }>()
      /** Count the scenes below a node, recording every node that has some. */
      const count = (node: StoryTreeNode): { done: number, total: number } => {
        const sum = { done: 0, total: 0 }
        for (const child of node.children) {
          if (child.kind === 'scene') {
            sum.total++
            if (child.status === 'played' || child.status === 'skipped') sum.done++
          }
          const below = count(child)
          sum.done += below.done
          sum.total += below.total
        }
        if (sum.total > 0) result.set(node.id, sum)
        return sum
      }
      this.tree.forEach(count)
      return result
    },
  },

  actions: {
    /**
     * Load a campaign's flat node list, ignoring responses superseded by another load.
     * Request failures are caught and clear the list; the last successful campaign id is retained.
     */
    async fetchNodes(campaignId: number) {
      // Switching campaigns quickly: an older, slower answer must not replace the newer tree
      const request = ++this.treeRequest
      this.loading = true
      try {
        const nodes = await $fetch<StoryNodeListItem[]>('/api/story', { query: { campaignId } })
        if (request !== this.treeRequest) return
        this.nodes = nodes
        this.lastFetchedCampaignId = campaignId
      }
      catch (error) {
        if (request !== this.treeRequest) return
        console.error('Failed to fetch story nodes:', error)
        this.nodes = []
      }
      finally {
        if (request === this.treeRequest) this.loading = false
      }
    },

    /** Reload the tree of the last loaded campaign. */
    async refresh() {
      if (this.lastFetchedCampaignId) await this.fetchNodes(this.lastFetchedCampaignId)
    },

    /** Create a node (appended to its siblings) and reload the tree if its campaign is still active. */
    async createNode(campaignId: number, name: string, kind: StoryNodeKind, parentId: number | null, isActive: () => boolean) {
      const node = await $fetch<StoryNode>('/api/story', {
        method: 'POST',
        body: { campaignId, name, kind, parentId },
      })
      if (isActive()) await this.fetchNodes(campaignId)
      return node
    },

    /** Patch a node and update its tree entry. */
    async updateNode(id: number, patch: Record<string, unknown>) {
      const node = await $fetch<StoryNode>(`/api/story/${id}`, { method: 'PATCH', body: patch })
      this.applyNode(node)
      return node
    },

    /** Replace a node's session / encounter / map links. */
    async setLinks(id: number, links: StoryNodeLinks) {
      const node = await $fetch<StoryNode>(`/api/story/${id}/links`, { method: 'PUT', body: links })
      this.applyNode(node)
      return node
    },

    /** Delete a node with its subtree; returns the deleted ids. */
    async deleteNode(id: number) {
      const { deletedIds } = await $fetch<{ deletedIds: number[] }>(`/api/story/${id}`, { method: 'DELETE' })
      this.treeRequest++
      this.loading = false
      this.nodes = this.nodes.filter(n => !deletedIds.includes(n.id))
      return deletedIds
    },

    /** Move a node under parentId at index; on failure, reload its campaign if still active and rethrow. */
    async moveNode(campaignId: number, id: number, parentId: number | null, index: number, isActive: () => boolean) {
      // A tree loaded meanwhile (e.g. another campaign) wins over this answer
      const request = this.treeRequest
      try {
        const nodes = await $fetch<StoryNodeListItem[]>('/api/story/move', {
          method: 'POST',
          body: { id, parentId, index },
        })
        if (request === this.treeRequest) this.nodes = nodes
      }
      catch (error) {
        // Drop the optimistic drag result
        if (isActive()) await this.fetchNodes(campaignId)
        throw error
      }
    },

    /** Keep the list entry in sync after editing a node. */
    applyNode(node: StoryNode) {
      const item = this.nodes.find(n => n.id === node.id)
      if (!item) return
      item.name = node.name
      item.kind = node.metadata.kind ?? item.kind
      item.status = node.metadata.status ?? item.status
      item.session_count = node.sessions.length
      item.encounter_count = node.encounters.length
      item.map_count = node.maps.length
    },
  },
})
