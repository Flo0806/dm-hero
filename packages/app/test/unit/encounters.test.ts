import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Encounter Tracker Tests
// Tests encounter CRUD, participants, initiative/turns, effects, and status transitions

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let playerTypeId: number

beforeAll(() => {
  db = getDb()

  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  const playerType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as { id: number }
  npcTypeId = npcType.id
  playerTypeId = playerType.id

  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Encounters', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM encounter_effects WHERE participant_id IN (SELECT id FROM encounter_participants WHERE encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?))').run(testCampaignId)
    db.prepare('DELETE FROM encounter_participants WHERE encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM encounters WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM encounter_effects WHERE participant_id IN (SELECT id FROM encounter_participants WHERE encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?))').run(testCampaignId)
  db.prepare('DELETE FROM encounter_participants WHERE encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM encounters WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// --- Helpers ---

function createEncounter(name: string, options?: {
  sessionId?: number
  status?: string
  round?: number
  currentTurnIndex?: number
}): number {
  const result = db.prepare(`
    INSERT INTO encounters (campaign_id, session_id, name, status, round, current_turn_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    testCampaignId,
    options?.sessionId || null,
    name,
    options?.status || 'setup',
    options?.round || 0,
    options?.currentTurnIndex || 0,
  )
  return Number(result.lastInsertRowid)
}

function createNpc(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

function createPlayer(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(playerTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

function addParticipant(encounterId: number, entityId: number, displayName: string, options?: {
  initiative?: number | null
  currentHp?: number
  maxHp?: number
  tempHp?: number
  sortOrder?: number
  isKo?: boolean
}): number {
  const result = db.prepare(`
    INSERT INTO encounter_participants
      (encounter_id, entity_id, display_name, duplicate_index, initiative, current_hp, max_hp, temp_hp, sort_order, is_ko)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(
    encounterId,
    entityId,
    displayName,
    options?.initiative ?? null,
    options?.currentHp ?? 0,
    options?.maxHp ?? 0,
    options?.tempHp ?? 0,
    options?.sortOrder ?? 0,
    options?.isKo ? 1 : 0,
  )
  return Number(result.lastInsertRowid)
}

function addEffect(participantId: number, name: string, options?: {
  icon?: string
  durationType?: string
  durationRounds?: number | null
  remainingRounds?: number | null
}): number {
  const durationType = options?.durationType || 'infinite'
  const rounds = options?.durationRounds ?? null
  const remaining = options?.remainingRounds ?? rounds
  const result = db.prepare(`
    INSERT INTO encounter_effects (participant_id, name, icon, duration_type, duration_rounds, remaining_rounds)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(participantId, name, options?.icon || null, durationType, rounds, remaining)
  return Number(result.lastInsertRowid)
}

function getEncounter(id: number) {
  return db.prepare('SELECT * FROM encounters WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

function getParticipant(id: number) {
  return db.prepare('SELECT * FROM encounter_participants WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

function getEffect(id: number) {
  return db.prepare('SELECT * FROM encounter_effects WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

// --- Tests ---

describe('Encounters - Basic CRUD', () => {
  it('should create an encounter with default values', () => {
    const id = createEncounter('Goblin Ambush')
    const enc = getEncounter(id)

    expect(enc).toBeDefined()
    expect(enc!.name).toBe('Goblin Ambush')
    expect(enc!.campaign_id).toBe(testCampaignId)
    expect(enc!.status).toBe('setup')
    expect(enc!.round).toBe(0)
    expect(enc!.current_turn_index).toBe(0)
    expect(enc!.session_id).toBeNull()
    expect(enc!.finished_at).toBeNull()
    expect(enc!.deleted_at).toBeNull()
  })

  it('should create an encounter linked to a session', () => {
    const session = db.prepare('INSERT INTO sessions (campaign_id, title) VALUES (?, ?)').run(testCampaignId, 'Session 1')
    const sessionId = Number(session.lastInsertRowid)

    const id = createEncounter('Boss Fight', { sessionId })
    const enc = getEncounter(id)

    expect(enc!.session_id).toBe(sessionId)

    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
  })

  it('should update encounter name', () => {
    const id = createEncounter('Old Name')
    db.prepare('UPDATE encounters SET name = ? WHERE id = ?').run('Dragon Lair', id)

    const enc = getEncounter(id)
    expect(enc!.name).toBe('Dragon Lair')
  })

  it('should soft-delete an encounter', () => {
    const id = createEncounter('To Delete')
    db.prepare('UPDATE encounters SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)

    const enc = getEncounter(id)
    expect(enc!.deleted_at).not.toBeNull()
  })

  it('should not return soft-deleted encounters in normal queries', () => {
    createEncounter('Visible')
    const deletedId = createEncounter('Hidden')
    db.prepare('UPDATE encounters SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(deletedId)

    const encounters = db.prepare(
      'SELECT * FROM encounters WHERE campaign_id = ? AND deleted_at IS NULL',
    ).all(testCampaignId)

    expect(encounters).toHaveLength(1)
    expect((encounters[0] as { name: string }).name).toBe('Visible')
  })

  it('should return participant count in list query', () => {
    const encId = createEncounter('With Participants')
    const npc1 = createNpc('Goblin 1')
    const npc2 = createNpc('Goblin 2')
    addParticipant(encId, npc1, 'Goblin 1')
    addParticipant(encId, npc2, 'Goblin 2')

    const enc = db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM encounter_participants WHERE encounter_id = e.id) as _participantCount
      FROM encounters e
      WHERE e.id = ? AND e.deleted_at IS NULL
    `).get(encId) as { _participantCount: number }

    expect(enc._participantCount).toBe(2)
  })

  it('should order encounters by updated_at DESC', () => {
    const id1 = createEncounter('First')
    const id2 = createEncounter('Second')

    // Force updated_at ordering
    db.prepare('UPDATE encounters SET updated_at = ? WHERE id = ?').run('2024-01-01', id1)
    db.prepare('UPDATE encounters SET updated_at = ? WHERE id = ?').run('2024-06-01', id2)

    const encounters = db.prepare(
      'SELECT name FROM encounters WHERE campaign_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
    ).all(testCampaignId) as Array<{ name: string }>

    expect(encounters[0].name).toBe('Second')
    expect(encounters[1].name).toBe('First')
  })
})

describe('Encounters - Status Transitions', () => {
  it('should transition setup → initiative', () => {
    const id = createEncounter('Status Test')
    db.prepare('UPDATE encounters SET status = ? WHERE id = ?').run('initiative', id)

    expect(getEncounter(id)!.status).toBe('initiative')
  })

  it('should transition initiative → active with round=1 and turn=0', () => {
    const id = createEncounter('Combat Start', { status: 'initiative' })
    db.prepare('UPDATE encounters SET status = ?, round = ?, current_turn_index = ? WHERE id = ?')
      .run('active', 1, 0, id)

    const enc = getEncounter(id)
    expect(enc!.status).toBe('active')
    expect(enc!.round).toBe(1)
    expect(enc!.current_turn_index).toBe(0)
  })

  it('should transition active → finished with finished_at', () => {
    const id = createEncounter('Finishing', { status: 'active', round: 3 })
    const finishedAt = new Date().toISOString()
    db.prepare('UPDATE encounters SET status = ?, finished_at = ? WHERE id = ?')
      .run('finished', finishedAt, id)

    const enc = getEncounter(id)
    expect(enc!.status).toBe('finished')
    expect(enc!.finished_at).not.toBeNull()
  })

  it('should reset finished → setup clearing round and finished_at', () => {
    const id = createEncounter('Reset Test', { status: 'active', round: 5 })
    db.prepare('UPDATE encounters SET status = ?, finished_at = ? WHERE id = ?')
      .run('finished', '2024-06-01T12:00:00Z', id)

    // Reset
    db.prepare('UPDATE encounters SET status = ?, round = ?, current_turn_index = ?, finished_at = NULL WHERE id = ?')
      .run('setup', 0, 0, id)

    const enc = getEncounter(id)
    expect(enc!.status).toBe('setup')
    expect(enc!.round).toBe(0)
    expect(enc!.current_turn_index).toBe(0)
    expect(enc!.finished_at).toBeNull()
  })
})

describe('Encounters - Participants', () => {
  it('should add a participant to an encounter', () => {
    const encId = createEncounter('Participant Test')
    const npcId = createNpc('Orc Warrior')
    const partId = addParticipant(encId, npcId, 'Orc Warrior')

    const part = getParticipant(partId)
    expect(part).toBeDefined()
    expect(part!.encounter_id).toBe(encId)
    expect(part!.entity_id).toBe(npcId)
    expect(part!.display_name).toBe('Orc Warrior')
    expect(part!.initiative).toBeNull()
    expect(part!.current_hp).toBe(0)
    expect(part!.max_hp).toBe(0)
    expect(part!.temp_hp).toBe(0)
    expect(part!.is_ko).toBe(0)
  })

  it('should add a participant with HP values', () => {
    const encId = createEncounter('HP Test')
    const npcId = createNpc('Tough Ogre')
    const partId = addParticipant(encId, npcId, 'Tough Ogre', { currentHp: 45, maxHp: 60, tempHp: 5 })

    const part = getParticipant(partId)
    expect(part!.current_hp).toBe(45)
    expect(part!.max_hp).toBe(60)
    expect(part!.temp_hp).toBe(5)
  })

  it('should track duplicate_index for same entity added multiple times', () => {
    const encId = createEncounter('Dup Test')
    const npcId = createNpc('Skeleton')

    addParticipant(encId, npcId, 'Skeleton')

    // Second copy with manual duplicate_index
    const result = db.prepare(`
      INSERT INTO encounter_participants
        (encounter_id, entity_id, display_name, duplicate_index, current_hp, max_hp, sort_order)
      VALUES (?, ?, ?, 1, 0, 0, 1)
    `).run(encId, npcId, 'Skeleton')
    const partId2 = Number(result.lastInsertRowid)

    const part2 = getParticipant(partId2)
    expect(part2!.duplicate_index).toBe(1)
  })

  it('should hard-delete a participant', () => {
    const encId = createEncounter('Delete Part Test')
    const npcId = createNpc('Doomed Goblin')
    const partId = addParticipant(encId, npcId, 'Doomed Goblin')

    db.prepare('DELETE FROM encounter_participants WHERE id = ? AND encounter_id = ?').run(partId, encId)

    expect(getParticipant(partId)).toBeUndefined()
  })

  it('should update participant initiative', () => {
    const encId = createEncounter('Ini Test')
    const npcId = createNpc('Fast Rogue')
    const partId = addParticipant(encId, npcId, 'Fast Rogue')

    db.prepare('UPDATE encounter_participants SET initiative = ? WHERE id = ?').run(18, partId)

    expect(getParticipant(partId)!.initiative).toBe(18)
  })

  it('should update participant HP values', () => {
    const encId = createEncounter('HP Update Test')
    const npcId = createNpc('Bruised Knight')
    const partId = addParticipant(encId, npcId, 'Bruised Knight', { currentHp: 30, maxHp: 40 })

    db.prepare('UPDATE encounter_participants SET current_hp = ?, temp_hp = ? WHERE id = ?').run(20, 10, partId)

    const part = getParticipant(partId)
    expect(part!.current_hp).toBe(20)
    expect(part!.temp_hp).toBe(10)
    expect(part!.max_hp).toBe(40) // Unchanged
  })

  it('should toggle KO status', () => {
    const encId = createEncounter('KO Test')
    const npcId = createNpc('Fragile Mage')
    const partId = addParticipant(encId, npcId, 'Fragile Mage')

    expect(getParticipant(partId)!.is_ko).toBe(0)

    db.prepare('UPDATE encounter_participants SET is_ko = 1 WHERE id = ?').run(partId)
    expect(getParticipant(partId)!.is_ko).toBe(1)

    db.prepare('UPDATE encounter_participants SET is_ko = 0 WHERE id = ?').run(partId)
    expect(getParticipant(partId)!.is_ko).toBe(0)
  })

  it('should store and update notes', () => {
    const encId = createEncounter('Notes Test')
    const npcId = createNpc('Mysterious NPC')
    const partId = addParticipant(encId, npcId, 'Mysterious NPC')

    expect(getParticipant(partId)!.notes).toBeNull()

    db.prepare('UPDATE encounter_participants SET notes = ? WHERE id = ?').run('Resistant to fire', partId)
    expect(getParticipant(partId)!.notes).toBe('Resistant to fire')
  })

  it('should return participants with entity type via JOIN', () => {
    const encId = createEncounter('Join Test')
    const npcId = createNpc('Named NPC')
    const playerId = createPlayer('Named Player')
    addParticipant(encId, npcId, 'Named NPC', { sortOrder: 0 })
    addParticipant(encId, playerId, 'Named Player', { sortOrder: 1 })

    const participants = db.prepare(`
      SELECT ep.*, et.name as entity_type, e.image_url as entity_image
      FROM encounter_participants ep
      LEFT JOIN entities e ON e.id = ep.entity_id
      LEFT JOIN entity_types et ON et.id = e.type_id
      WHERE ep.encounter_id = ?
      ORDER BY ep.sort_order ASC
    `).all(encId) as Array<{ display_name: string, entity_type: string }>

    expect(participants).toHaveLength(2)
    expect(participants[0].entity_type).toBe('NPC')
    expect(participants[1].entity_type).toBe('Player')
  })
})

describe('Encounters - Initiative Sorting', () => {
  it('should sort participants by initiative descending', () => {
    const encId = createEncounter('Sort Test', { status: 'initiative' })
    const npc1 = createNpc('Slow')
    const npc2 = createNpc('Fast')
    const npc3 = createNpc('Medium')

    addParticipant(encId, npc1, 'Slow', { initiative: 5, sortOrder: 0 })
    addParticipant(encId, npc2, 'Fast', { initiative: 20, sortOrder: 1 })
    addParticipant(encId, npc3, 'Medium', { initiative: 12, sortOrder: 2 })

    // Sort by initiative descending → update sort_order
    const participants = db.prepare(
      'SELECT id, initiative FROM encounter_participants WHERE encounter_id = ? ORDER BY initiative DESC',
    ).all(encId) as Array<{ id: number, initiative: number }>

    participants.forEach((p, i) => {
      db.prepare('UPDATE encounter_participants SET sort_order = ? WHERE id = ?').run(i, p.id)
    })

    const sorted = db.prepare(
      'SELECT display_name, initiative FROM encounter_participants WHERE encounter_id = ? ORDER BY sort_order ASC',
    ).all(encId) as Array<{ display_name: string, initiative: number }>

    expect(sorted[0].display_name).toBe('Fast')
    expect(sorted[0].initiative).toBe(20)
    expect(sorted[1].display_name).toBe('Medium')
    expect(sorted[1].initiative).toBe(12)
    expect(sorted[2].display_name).toBe('Slow')
    expect(sorted[2].initiative).toBe(5)
  })

  it('should handle equal initiative values', () => {
    const encId = createEncounter('Tie Test')
    const npc1 = createNpc('A')
    const npc2 = createNpc('B')
    addParticipant(encId, npc1, 'A', { initiative: 15, sortOrder: 0 })
    addParticipant(encId, npc2, 'B', { initiative: 15, sortOrder: 1 })

    const sorted = db.prepare(
      'SELECT display_name FROM encounter_participants WHERE encounter_id = ? ORDER BY initiative DESC, sort_order ASC',
    ).all(encId) as Array<{ display_name: string }>

    expect(sorted).toHaveLength(2)
    // Both should be present, order is stable
    expect(sorted.map(s => s.display_name)).toContain('A')
    expect(sorted.map(s => s.display_name)).toContain('B')
  })
})

describe('Encounters - Turn Tracking', () => {
  it('should advance turn index', () => {
    const encId = createEncounter('Turn Test', { status: 'active', round: 1, currentTurnIndex: 0 })

    db.prepare('UPDATE encounters SET current_turn_index = 1 WHERE id = ?').run(encId)
    expect(getEncounter(encId)!.current_turn_index).toBe(1)
  })

  it('should wrap turn index and increment round', () => {
    const encId = createEncounter('Wrap Test', { status: 'active', round: 1, currentTurnIndex: 2 })
    const npc1 = createNpc('P1')
    const npc2 = createNpc('P2')
    const npc3 = createNpc('P3')
    addParticipant(encId, npc1, 'P1', { sortOrder: 0 })
    addParticipant(encId, npc2, 'P2', { sortOrder: 1 })
    addParticipant(encId, npc3, 'P3', { sortOrder: 2 })

    const participantCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM encounter_participants WHERE encounter_id = ?',
    ).get(encId) as { cnt: number }).cnt

    // Current index is 2 (last participant), advancing should wrap to 0, round++
    let newIndex = 2 + 1
    let newRound = 1
    if (newIndex >= participantCount) {
      newIndex = 0
      newRound++
    }

    db.prepare('UPDATE encounters SET current_turn_index = ?, round = ? WHERE id = ?')
      .run(newIndex, newRound, encId)

    const enc = getEncounter(encId)
    expect(enc!.current_turn_index).toBe(0)
    expect(enc!.round).toBe(2)
  })

  it('should go to previous turn', () => {
    const encId = createEncounter('Prev Test', { status: 'active', round: 1, currentTurnIndex: 1 })

    db.prepare('UPDATE encounters SET current_turn_index = 0 WHERE id = ?').run(encId)
    expect(getEncounter(encId)!.current_turn_index).toBe(0)
  })

  it('should wrap previous turn to last participant and decrement round', () => {
    const encId = createEncounter('Prev Wrap', { status: 'active', round: 2, currentTurnIndex: 0 })
    const npc1 = createNpc('W1')
    const npc2 = createNpc('W2')
    const npc3 = createNpc('W3')
    addParticipant(encId, npc1, 'W1', { sortOrder: 0 })
    addParticipant(encId, npc2, 'W2', { sortOrder: 1 })
    addParticipant(encId, npc3, 'W3', { sortOrder: 2 })

    const participantCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM encounter_participants WHERE encounter_id = ?',
    ).get(encId) as { cnt: number }).cnt

    // Index 0, going back should wrap to last, round--
    let newIndex = 0 - 1
    let newRound = 2
    if (newIndex < 0) {
      newIndex = participantCount - 1
      newRound--
    }

    db.prepare('UPDATE encounters SET current_turn_index = ?, round = ? WHERE id = ?')
      .run(newIndex, newRound, encId)

    const enc = getEncounter(encId)
    expect(enc!.current_turn_index).toBe(2)
    expect(enc!.round).toBe(1)
  })

  it('should not go below round 1 when wrapping back', () => {
    const encId = createEncounter('Min Round', { status: 'active', round: 1, currentTurnIndex: 0 })
    const npc = createNpc('Solo')
    addParticipant(encId, npc, 'Solo', { sortOrder: 0 })

    // Going back at round 1, index 0 should stay at round 1
    let newIndex = 0 - 1
    let newRound = 1
    const participantCount = 1
    if (newIndex < 0) {
      newIndex = participantCount - 1
      newRound = Math.max(1, newRound - 1)
    }

    db.prepare('UPDATE encounters SET current_turn_index = ?, round = ? WHERE id = ?')
      .run(newIndex, newRound, encId)

    expect(getEncounter(encId)!.round).toBe(1)
  })
})

describe('Encounters - Participant Removal During Combat', () => {
  it('should adjust turn index when removing participant before current', () => {
    const encId = createEncounter('Remove Before', { status: 'active', round: 1, currentTurnIndex: 2 })
    const npc1 = createNpc('R1')
    const npc2 = createNpc('R2')
    const npc3 = createNpc('R3')
    const p1 = addParticipant(encId, npc1, 'R1', { sortOrder: 0 })
    addParticipant(encId, npc2, 'R2', { sortOrder: 1 })
    addParticipant(encId, npc3, 'R3', { sortOrder: 2 })

    // Remove participant at index 0 (before current index 2)
    db.prepare('DELETE FROM encounter_participants WHERE id = ?').run(p1)

    // Current turn index should shift down by 1
    db.prepare('UPDATE encounters SET current_turn_index = 1 WHERE id = ?').run(encId)
    expect(getEncounter(encId)!.current_turn_index).toBe(1)
  })

  it('should clamp turn index when removing the current participant', () => {
    const encId = createEncounter('Remove Current', { status: 'active', round: 1, currentTurnIndex: 2 })
    const npc1 = createNpc('C1')
    const npc2 = createNpc('C2')
    const npc3 = createNpc('C3')
    addParticipant(encId, npc1, 'C1', { sortOrder: 0 })
    addParticipant(encId, npc2, 'C2', { sortOrder: 1 })
    const p3 = addParticipant(encId, npc3, 'C3', { sortOrder: 2 })

    // Remove current participant (index 2, last)
    db.prepare('DELETE FROM encounter_participants WHERE id = ?').run(p3)

    // Should clamp to max valid index (now 1)
    const remaining = (db.prepare(
      'SELECT COUNT(*) as cnt FROM encounter_participants WHERE encounter_id = ?',
    ).get(encId) as { cnt: number }).cnt
    const clampedIndex = Math.min(2, remaining - 1)

    db.prepare('UPDATE encounters SET current_turn_index = ? WHERE id = ?').run(clampedIndex, encId)
    expect(getEncounter(encId)!.current_turn_index).toBe(1)
  })

  it('should not change turn index when removing participant after current', () => {
    const encId = createEncounter('Remove After', { status: 'active', round: 1, currentTurnIndex: 0 })
    const npc1 = createNpc('A1')
    const npc2 = createNpc('A2')
    addParticipant(encId, npc1, 'A1', { sortOrder: 0 })
    const p2 = addParticipant(encId, npc2, 'A2', { sortOrder: 1 })

    // Remove participant at index 1 (after current index 0)
    db.prepare('DELETE FROM encounter_participants WHERE id = ?').run(p2)

    // Turn index stays at 0
    expect(getEncounter(encId)!.current_turn_index).toBe(0)
  })

  it('should cascade delete participants when encounter is hard-deleted', () => {
    const encId = createEncounter('Cascade Test')
    const npcId = createNpc('Cascaded')
    const partId = addParticipant(encId, npcId, 'Cascaded')
    addEffect(partId, 'Shield')

    // Hard delete encounter (bypasses soft-delete for test)
    db.prepare('DELETE FROM encounters WHERE id = ?').run(encId)

    // Participants and effects should be gone (FK CASCADE)
    expect(getParticipant(partId)).toBeUndefined()
    const effects = db.prepare('SELECT * FROM encounter_effects WHERE participant_id = ?').all(partId)
    expect(effects).toHaveLength(0)
  })
})

describe('Encounters - Effects', () => {
  it('should add an infinite duration effect', () => {
    const encId = createEncounter('Effect Test')
    const npcId = createNpc('Buffed Warrior')
    const partId = addParticipant(encId, npcId, 'Buffed Warrior')

    const effId = addEffect(partId, 'Bless', { durationType: 'infinite' })
    const eff = getEffect(effId)

    expect(eff).toBeDefined()
    expect(eff!.name).toBe('Bless')
    expect(eff!.duration_type).toBe('infinite')
    expect(eff!.duration_rounds).toBeNull()
    expect(eff!.remaining_rounds).toBeNull()
  })

  it('should add a round-based effect', () => {
    const encId = createEncounter('Round Effect')
    const npcId = createNpc('Hexed Target')
    const partId = addParticipant(encId, npcId, 'Hexed Target')

    const effId = addEffect(partId, 'Hold Person', {
      durationType: 'rounds',
      durationRounds: 3,
      remainingRounds: 3,
    })

    const eff = getEffect(effId)
    expect(eff!.duration_type).toBe('rounds')
    expect(eff!.duration_rounds).toBe(3)
    expect(eff!.remaining_rounds).toBe(3)
  })

  it('should add a concentration effect', () => {
    const encId = createEncounter('Conc Effect')
    const npcId = createNpc('Concentrating Wizard')
    const partId = addParticipant(encId, npcId, 'Concentrating Wizard')

    const effId = addEffect(partId, 'Haste', { durationType: 'concentration' })
    const eff = getEffect(effId)

    expect(eff!.duration_type).toBe('concentration')
  })

  it('should decrement remaining_rounds on tick', () => {
    const encId = createEncounter('Tick Test')
    const npcId = createNpc('Ticking')
    const partId = addParticipant(encId, npcId, 'Ticking')
    const effId = addEffect(partId, 'Shield of Faith', {
      durationType: 'rounds',
      durationRounds: 3,
      remainingRounds: 3,
    })

    // Tick: decrement remaining_rounds
    db.prepare('UPDATE encounter_effects SET remaining_rounds = remaining_rounds - 1 WHERE id = ?').run(effId)

    expect(getEffect(effId)!.remaining_rounds).toBe(2)
  })

  it('should identify expired effects (remaining_rounds = 0)', () => {
    const encId = createEncounter('Expire Test')
    const npcId = createNpc('Expiring')
    const partId = addParticipant(encId, npcId, 'Expiring')

    addEffect(partId, 'Long Buff', { durationType: 'rounds', durationRounds: 5, remainingRounds: 3 })
    addEffect(partId, 'Expired Buff', { durationType: 'rounds', durationRounds: 2, remainingRounds: 0 })
    addEffect(partId, 'Infinite', { durationType: 'infinite' })

    const expired = db.prepare(
      'SELECT name FROM encounter_effects WHERE participant_id = ? AND duration_type = ? AND remaining_rounds <= 0',
    ).all(partId, 'rounds') as Array<{ name: string }>

    expect(expired).toHaveLength(1)
    expect(expired[0].name).toBe('Expired Buff')
  })

  it('should not tick infinite or concentration effects', () => {
    const encId = createEncounter('No Tick')
    const npcId = createNpc('Stable')
    const partId = addParticipant(encId, npcId, 'Stable')

    const infId = addEffect(partId, 'Permanent', { durationType: 'infinite' })
    const concId = addEffect(partId, 'Concentration', { durationType: 'concentration' })

    // Only tick round-based effects
    db.prepare(
      'UPDATE encounter_effects SET remaining_rounds = remaining_rounds - 1 WHERE participant_id = ? AND duration_type = ?',
    ).run(partId, 'rounds')

    expect(getEffect(infId)!.remaining_rounds).toBeNull()
    expect(getEffect(concId)!.remaining_rounds).toBeNull()
  })

  it('should delete an effect', () => {
    const encId = createEncounter('Delete Effect')
    const npcId = createNpc('Cleansed')
    const partId = addParticipant(encId, npcId, 'Cleansed')
    const effId = addEffect(partId, 'Curse', { durationType: 'infinite' })

    db.prepare('DELETE FROM encounter_effects WHERE id = ?').run(effId)
    expect(getEffect(effId)).toBeUndefined()
  })

  it('should cascade delete effects when participant is removed', () => {
    const encId = createEncounter('Cascade Effect')
    const npcId = createNpc('Leaving')
    const partId = addParticipant(encId, npcId, 'Leaving')
    const eff1 = addEffect(partId, 'Buff 1')
    const eff2 = addEffect(partId, 'Buff 2')

    db.prepare('DELETE FROM encounter_participants WHERE id = ?').run(partId)

    expect(getEffect(eff1)).toBeUndefined()
    expect(getEffect(eff2)).toBeUndefined()
  })

  it('should load effects with participant query', () => {
    const encId = createEncounter('Load Effects')
    const npcId = createNpc('Loaded')
    const partId = addParticipant(encId, npcId, 'Loaded')
    addEffect(partId, 'Effect A')
    addEffect(partId, 'Effect B')

    const effects = db.prepare('SELECT * FROM encounter_effects WHERE participant_id = ?').all(partId)
    expect(effects).toHaveLength(2)
  })

  it('should store effect icon', () => {
    const encId = createEncounter('Icon Test')
    const npcId = createNpc('Iconic')
    const partId = addParticipant(encId, npcId, 'Iconic')
    const effId = addEffect(partId, 'Fire Shield', { icon: 'mdi-fire' })

    expect(getEffect(effId)!.icon).toBe('mdi-fire')
  })
})

describe('Encounters - COALESCE Update Pattern', () => {
  it('should only update provided fields on participant PATCH', () => {
    const encId = createEncounter('COALESCE Test')
    const npcId = createNpc('Partial Update')
    const partId = addParticipant(encId, npcId, 'Partial Update', {
      initiative: 15,
      currentHp: 30,
      maxHp: 40,
    })

    // Only update current_hp, leave everything else
    db.prepare(`
      UPDATE encounter_participants
      SET
        initiative = COALESCE(?, initiative),
        current_hp = COALESCE(?, current_hp),
        max_hp = COALESCE(?, max_hp),
        temp_hp = COALESCE(?, temp_hp),
        is_ko = COALESCE(?, is_ko),
        notes = COALESCE(?, notes),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(null, 25, null, null, null, null, null, partId)

    const part = getParticipant(partId)
    expect(part!.initiative).toBe(15) // Unchanged
    expect(part!.current_hp).toBe(25) // Updated
    expect(part!.max_hp).toBe(40) // Unchanged
  })

  it('should only update provided fields on encounter PATCH', () => {
    const encId = createEncounter('Enc COALESCE', { status: 'active', round: 3 })

    db.prepare(`
      UPDATE encounters
      SET
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        round = COALESCE(?, round),
        current_turn_index = COALESCE(?, current_turn_index),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(null, null, 4, null, encId)

    const enc = getEncounter(encId)
    expect(enc!.name).toBe('Enc COALESCE') // Unchanged
    expect(enc!.status).toBe('active') // Unchanged
    expect(enc!.round).toBe(4) // Updated
  })
})

describe('Encounters - Campaign Isolation', () => {
  it('should only return encounters from the active campaign', () => {
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Other Campaign')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    createEncounter('My Encounter')
    db.prepare('INSERT INTO encounters (campaign_id, name, status, round, current_turn_index) VALUES (?, ?, ?, ?, ?)')
      .run(campaign2Id, 'Other Encounter', 'setup', 0, 0)

    const myEncounters = db.prepare(
      'SELECT * FROM encounters WHERE campaign_id = ? AND deleted_at IS NULL',
    ).all(testCampaignId)

    const otherEncounters = db.prepare(
      'SELECT * FROM encounters WHERE campaign_id = ? AND deleted_at IS NULL',
    ).all(campaign2Id)

    expect(myEncounters).toHaveLength(1)
    expect(otherEncounters).toHaveLength(1)
    expect((myEncounters[0] as { name: string }).name).toBe('My Encounter')
    expect((otherEncounters[0] as { name: string }).name).toBe('Other Encounter')

    // Cleanup
    db.prepare('DELETE FROM encounters WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Encounters - Full Combat Flow', () => {
  it('should simulate a complete combat from setup to finish', () => {
    // 1. Create encounter in setup
    const encId = createEncounter('Full Flow')
    const npc1 = createNpc('Dragon')
    const npc2 = createNpc('Knight')
    const player1 = createPlayer('Wizard')

    // 2. Add participants
    const pDragon = addParticipant(encId, npc1, 'Dragon', { currentHp: 100, maxHp: 100 })
    const pKnight = addParticipant(encId, npc2, 'Knight', { currentHp: 50, maxHp: 50 })
    const pWizard = addParticipant(encId, player1, 'Wizard', { currentHp: 30, maxHp: 30 })

    // 3. Transition to initiative
    db.prepare('UPDATE encounters SET status = ? WHERE id = ?').run('initiative', encId)
    expect(getEncounter(encId)!.status).toBe('initiative')

    // 4. Set initiative values
    db.prepare('UPDATE encounter_participants SET initiative = ? WHERE id = ?').run(5, pDragon)
    db.prepare('UPDATE encounter_participants SET initiative = ? WHERE id = ?').run(18, pKnight)
    db.prepare('UPDATE encounter_participants SET initiative = ? WHERE id = ?').run(12, pWizard)

    // Verify all initiative set
    const allSet = db.prepare(
      'SELECT COUNT(*) as cnt FROM encounter_participants WHERE encounter_id = ? AND initiative IS NULL',
    ).get(encId) as { cnt: number }
    expect(allSet.cnt).toBe(0)

    // 5. Sort by initiative (descending) and update sort_order
    const sorted = db.prepare(
      'SELECT id FROM encounter_participants WHERE encounter_id = ? ORDER BY initiative DESC',
    ).all(encId) as Array<{ id: number }>
    sorted.forEach((p, i) => {
      db.prepare('UPDATE encounter_participants SET sort_order = ? WHERE id = ?').run(i, p.id)
    })

    // 6. Start combat
    db.prepare('UPDATE encounters SET status = ?, round = ?, current_turn_index = ? WHERE id = ?')
      .run('active', 1, 0, encId)

    const activeEnc = getEncounter(encId)
    expect(activeEnc!.status).toBe('active')
    expect(activeEnc!.round).toBe(1)

    // Verify sort order: Knight (18) > Wizard (12) > Dragon (5)
    const combatOrder = db.prepare(
      'SELECT display_name, initiative FROM encounter_participants WHERE encounter_id = ? ORDER BY sort_order ASC',
    ).all(encId) as Array<{ display_name: string, initiative: number }>
    expect(combatOrder[0].display_name).toBe('Knight')
    expect(combatOrder[1].display_name).toBe('Wizard')
    expect(combatOrder[2].display_name).toBe('Dragon')

    // 7. Add effects during combat
    addEffect(pWizard, 'Mage Armor', { durationType: 'infinite' })
    addEffect(pDragon, 'Frightful Presence', { durationType: 'rounds', durationRounds: 3, remainingRounds: 3 })

    // 8. Deal damage - Dragon takes 20 damage
    db.prepare('UPDATE encounter_participants SET current_hp = ? WHERE id = ?').run(80, pDragon)
    expect(getParticipant(pDragon)!.current_hp).toBe(80)

    // 9. Wizard takes lethal damage → KO
    db.prepare('UPDATE encounter_participants SET current_hp = 0, is_ko = 1 WHERE id = ?').run(pWizard)
    const koWizard = getParticipant(pWizard)
    expect(koWizard!.current_hp).toBe(0)
    expect(koWizard!.is_ko).toBe(1)

    // 10. Heal wizard → un-KO
    db.prepare('UPDATE encounter_participants SET current_hp = 10, is_ko = 0 WHERE id = ?').run(pWizard)
    const healedWizard = getParticipant(pWizard)
    expect(healedWizard!.current_hp).toBe(10)
    expect(healedWizard!.is_ko).toBe(0)

    // 11. Advance turns through round
    db.prepare('UPDATE encounters SET current_turn_index = 1 WHERE id = ?').run(encId) // Knight → Wizard
    db.prepare('UPDATE encounters SET current_turn_index = 2 WHERE id = ?').run(encId) // Wizard → Dragon

    // Tick round-based effects for Dragon
    db.prepare(
      'UPDATE encounter_effects SET remaining_rounds = remaining_rounds - 1 WHERE participant_id = ? AND duration_type = ?',
    ).run(pDragon, 'rounds')

    const dragonEffects = db.prepare(
      'SELECT remaining_rounds FROM encounter_effects WHERE participant_id = ? AND duration_type = ?',
    ).all(pDragon, 'rounds') as Array<{ remaining_rounds: number }>
    expect(dragonEffects[0].remaining_rounds).toBe(2)

    // 12. Wrap to round 2
    db.prepare('UPDATE encounters SET current_turn_index = 0, round = 2 WHERE id = ?').run(encId)
    expect(getEncounter(encId)!.round).toBe(2)

    // 13. End combat
    const finishedAt = new Date().toISOString()
    db.prepare('UPDATE encounters SET status = ?, finished_at = ? WHERE id = ?')
      .run('finished', finishedAt, encId)

    const finished = getEncounter(encId)
    expect(finished!.status).toBe('finished')
    expect(finished!.finished_at).not.toBeNull()

    // 14. Verify all data persisted
    const finalParticipants = db.prepare(
      'SELECT * FROM encounter_participants WHERE encounter_id = ?',
    ).all(encId)
    expect(finalParticipants).toHaveLength(3)

    const allEffects = db.prepare(`
      SELECT ee.* FROM encounter_effects ee
      JOIN encounter_participants ep ON ep.id = ee.participant_id
      WHERE ep.encounter_id = ?
    `).all(encId)
    expect(allEffects).toHaveLength(2)

    // 15. Reset encounter
    db.prepare('UPDATE encounters SET status = ?, round = 0, current_turn_index = 0, finished_at = NULL WHERE id = ?')
      .run('setup', encId)

    const reset = getEncounter(encId)
    expect(reset!.status).toBe('setup')
    expect(reset!.round).toBe(0)
    expect(reset!.finished_at).toBeNull()
  })
})

describe('Encounters - Temp HP Damage Absorption', () => {
  it('should absorb damage with temp HP first (D&D rules)', () => {
    const encId = createEncounter('Temp HP Test')
    const npcId = createNpc('Shielded')
    const partId = addParticipant(encId, npcId, 'Shielded', { currentHp: 30, maxHp: 30, tempHp: 10 })

    // Take 15 damage: 10 absorbed by temp, 5 from actual HP
    const part = getParticipant(partId)!
    const damage = 15
    let tempHp = part.temp_hp as number
    let currentHp = part.current_hp as number

    const tempAbsorbed = Math.min(tempHp, damage)
    tempHp -= tempAbsorbed
    const remaining = damage - tempAbsorbed
    currentHp = Math.max(0, currentHp - remaining)

    db.prepare('UPDATE encounter_participants SET current_hp = ?, temp_hp = ? WHERE id = ?')
      .run(currentHp, tempHp, partId)

    const updated = getParticipant(partId)
    expect(updated!.temp_hp).toBe(0) // 10 - 10 = 0
    expect(updated!.current_hp).toBe(25) // 30 - 5 = 25
  })

  it('should not affect temp HP when damage is less than temp HP', () => {
    const encId = createEncounter('Small Damage')
    const npcId = createNpc('Very Shielded')
    const partId = addParticipant(encId, npcId, 'Very Shielded', { currentHp: 30, maxHp: 30, tempHp: 20 })

    const damage = 8
    let tempHp = 20
    const tempAbsorbed = Math.min(tempHp, damage)
    tempHp -= tempAbsorbed
    const remaining = damage - tempAbsorbed
    const currentHp = Math.max(0, 30 - remaining)

    db.prepare('UPDATE encounter_participants SET current_hp = ?, temp_hp = ? WHERE id = ?')
      .run(currentHp, tempHp, partId)

    const updated = getParticipant(partId)
    expect(updated!.temp_hp).toBe(12) // 20 - 8 = 12
    expect(updated!.current_hp).toBe(30) // No actual HP damage
  })
})

describe('Encounters - Sort Order Persistence', () => {
  it('should maintain sort_order across participant additions', () => {
    const encId = createEncounter('Sort Order')
    const npc1 = createNpc('First')
    const npc2 = createNpc('Second')
    const npc3 = createNpc('Third')

    addParticipant(encId, npc1, 'First', { sortOrder: 0 })
    addParticipant(encId, npc2, 'Second', { sortOrder: 1 })
    addParticipant(encId, npc3, 'Third', { sortOrder: 2 })

    const ordered = db.prepare(
      'SELECT display_name FROM encounter_participants WHERE encounter_id = ? ORDER BY sort_order ASC',
    ).all(encId) as Array<{ display_name: string }>

    expect(ordered[0].display_name).toBe('First')
    expect(ordered[1].display_name).toBe('Second')
    expect(ordered[2].display_name).toBe('Third')
  })

  it('should handle re-sorting after adding new participant mid-combat', () => {
    const encId = createEncounter('Mid-Combat Add', { status: 'active', round: 2, currentTurnIndex: 1 })
    const npc1 = createNpc('High Ini')
    const npc2 = createNpc('Low Ini')
    const npc3 = createNpc('Mid Ini')

    addParticipant(encId, npc1, 'High Ini', { initiative: 20, sortOrder: 0 })
    addParticipant(encId, npc2, 'Low Ini', { initiative: 5, sortOrder: 1 })

    // Add new participant mid-combat with initiative 12
    addParticipant(encId, npc3, 'Mid Ini', { initiative: 12, sortOrder: 2 })

    // Re-sort all by initiative
    const resorted = db.prepare(
      'SELECT id FROM encounter_participants WHERE encounter_id = ? ORDER BY initiative DESC',
    ).all(encId) as Array<{ id: number }>
    resorted.forEach((p, i) => {
      db.prepare('UPDATE encounter_participants SET sort_order = ? WHERE id = ?').run(i, p.id)
    })

    const final = db.prepare(
      'SELECT display_name, initiative FROM encounter_participants WHERE encounter_id = ? ORDER BY sort_order ASC',
    ).all(encId) as Array<{ display_name: string, initiative: number }>

    expect(final[0].display_name).toBe('High Ini')
    expect(final[0].initiative).toBe(20)
    expect(final[1].display_name).toBe('Mid Ini')
    expect(final[1].initiative).toBe(12)
    expect(final[2].display_name).toBe('Low Ini')
    expect(final[2].initiative).toBe(5)
  })
})
