#!/usr/bin/env node

/**
 * COMPLETE DATABASE RESET AND SEED SCRIPT
 *
 * This script:
 * 1. Deletes ALL user data (entities, relations, sessions, documents, images, audio)
 * 2. Creates fresh test data with proper relations
 *
 * Usage: node scripts/test-data/reset-and-seed.js
 */

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Go up from scripts/test-data/ to project root, then into data/
const projectRoot = join(__dirname, '..', '..')
const dbPath = join(projectRoot, 'data', 'dm-hero.db')

console.log('📍 Project root:', projectRoot)
console.log('📍 Database path:', dbPath)

const db = new Database(dbPath)

// ============================================================================
// STEP 1: COMPLETE DATABASE CLEANUP
// ============================================================================
console.log('\n🧹 COMPLETE DATABASE CLEANUP...')

const cleanup = db.transaction(() => {
  // Delete ALL data in correct order (foreign key dependencies)

  // 1. Delete FTS data
  db.prepare('DELETE FROM entities_fts').run()
  console.log('   ✓ Cleared entities_fts')

  // 2. Delete session-related data
  db.prepare('DELETE FROM audio_markers').run()
  db.prepare('DELETE FROM session_audio').run()
  db.prepare('DELETE FROM session_mentions').run()
  db.prepare('DELETE FROM sessions').run()
  console.log('   ✓ Cleared sessions and audio')

  // 3. Delete entity-related data
  db.prepare('DELETE FROM entity_relations').run()
  db.prepare('DELETE FROM entity_images').run()
  db.prepare('DELETE FROM entity_documents').run()
  console.log('   ✓ Cleared entity relations, images, documents')

  // 4. Delete all entities
  const deleted = db.prepare('DELETE FROM entities').run()
  console.log(`   ✓ Deleted ${deleted.changes} entities`)

  // 5. Reset auto-increment (optional but clean)
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'entities'").run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'entity_relations'").run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'sessions'").run()
  console.log('   ✓ Reset auto-increment counters')

  return deleted.changes
})

try {
  cleanup()
  console.log('✅ Database completely cleaned!')
} catch (error) {
  console.error('❌ Error during cleanup:', error.message)
  process.exit(1)
}

// ============================================================================
// Get entity type IDs and campaign
// ============================================================================
const campaign = db.prepare('SELECT id FROM campaigns LIMIT 1').get()
if (!campaign) {
  console.error('❌ No campaign found! Please create a campaign first.')
  process.exit(1)
}

const entityTypes = {}
const types = ['NPC', 'Item', 'Location', 'Faction', 'Lore', 'Player']
for (const typeName of types) {
  const type = db.prepare('SELECT id FROM entity_types WHERE name = ?').get(typeName)
  if (!type) {
    console.error(`❌ Entity type ${typeName} not found!`)
    process.exit(1)
  }
  entityTypes[typeName] = type.id
}

const campaignId = campaign.id
console.log(`\n📋 Using campaign ID: ${campaignId}`)
console.log('📋 Entity type IDs:', entityTypes)

// ============================================================================
// Prepare insert statements
// ============================================================================
const insertEntity = db.prepare(`
  INSERT INTO entities (name, description, type_id, campaign_id, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`)

const insertFts = db.prepare(`
  INSERT INTO entities_fts(rowid, name, description, metadata)
  VALUES (?, ?, ?, ?)
`)

const insertRelation = db.prepare(`
  INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes, created_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`)

// ============================================================================
// STEP 2: INSERT NPCs (20 NPCs)
// ============================================================================
console.log('\n👥 Inserting NPCs...')

const npcs = [
  { name: 'Thorin Eisenschild', description: 'Ein alter Zwergenkönig, der sein Volk durch die dunklen Zeiten führte. Trägt eine Krone aus Mithril.', metadata: '{"race":"mountaindwarf","class":"fighter","status":"alive","type":"ally","age":250,"gender":"male"}' },
  { name: 'Elara Mondschein', description: 'Hochelfische Magierin und Beraterin des Rates. Hütet uralte Geheimnisse.', metadata: '{"race":"highelf","class":"wizard","status":"alive","type":"questgiver","age":320,"gender":"female"}' },
  { name: 'Ragnar Sturmfaust', description: 'Menschlicher Barbar aus dem Norden. Seine Axt hat schon viele Schlachten gesehen.', metadata: '{"race":"human","class":"barbarian","status":"alive","type":"ally","age":35,"gender":"male"}' },
  { name: 'Lyra Schattenflüster', description: 'Halbelfische Schurkin und Meisterdiebin. Arbeitet nur für den richtigen Preis.', metadata: '{"race":"halfelf","class":"rogue","status":"alive","type":"neutral","age":45,"gender":"female"}' },
  { name: 'Bruder Marcus', description: 'Menschlicher Kleriker des Lichtgottes. Heilt Kranke und bekämpft Untote.', metadata: '{"race":"human","class":"cleric","status":"alive","type":"ally","age":55,"gender":"male"}' },
  { name: 'Grimjaw der Henker', description: 'Halbork-Söldner mit finsterer Vergangenheit. Stellt keine Fragen, wenn der Preis stimmt.', metadata: '{"race":"halforc","class":"fighter","status":"alive","type":"enemy","age":40,"gender":"male"}' },
  { name: 'Seraphina Flammenkuss', description: 'Tiefling-Hexenmeisterin mit einem Pakt zu einem Erzengel. Kämpft für Gerechtigkeit.', metadata: '{"race":"tiefling","class":"warlock","status":"alive","type":"ally","age":28,"gender":"female"}' },
  { name: 'Finnegan Hopfenfuß', description: 'Halblingischer Barde und Tavernenbesitzer. Kennt alle Gerüchte der Stadt.', metadata: '{"race":"lightfoothalfling","class":"bard","status":"alive","type":"merchant","age":60,"gender":"male"}' },
  { name: 'Zara die Weise', description: 'Gnomische Alchemistin und Erfinderin. Ihre Tränke sind legendär - manchmal explosiv.', metadata: '{"race":"gnome","class":"wizard","status":"alive","type":"merchant","age":120,"gender":"female"}' },
  { name: 'Kira Wolfherz', description: 'Menschliche Waldläuferin mit Wolfsbegleiterin. Beschützt die Grenzen des Waldes.', metadata: '{"race":"human","class":"ranger","status":"alive","type":"ally","age":30,"gender":"female"}' },
  { name: 'Lord Valdris von Dunkelstein', description: 'Vampir und Herrscher des Schattenlandes. Sammelt Seelen und seltene Weine.', metadata: '{"race":"human","class":"sorcerer","status":"undead","type":"villain","age":450,"gender":"male"}' },
  { name: 'Thalia Sonnentau', description: 'Waldelfische Druidin des Heiligen Hains. Spricht mit Tieren und Pflanzen.', metadata: '{"race":"woodelf","class":"druid","status":"alive","type":"questgiver","age":200,"gender":"female"}' },
  { name: 'Brom der Schmied', description: 'Zwergischer Schmiedemeister. Fertigt die besten Waffen der Region.', metadata: '{"race":"dwarf","class":"fighter","status":"alive","type":"merchant","age":180,"gender":"male"}' },
  { name: 'Mystica die Seherin', description: 'Menschliche Wahrsagerin mit dem Dritten Auge. Ihre Visionen sind kryptisch aber wahr.', metadata: '{"race":"human","class":"wizard","status":"alive","type":"questgiver","age":70,"gender":"female"}' },
  { name: 'Garrick Eisenhand', description: 'Menschlicher Paladin des Ordens. Kämpft unermüdlich gegen das Böse.', metadata: '{"race":"human","class":"paladin","status":"alive","type":"ally","age":38,"gender":"male"}' },
  { name: 'Nyx Schattentänzerin', description: 'Drow-Assassinin auf der Flucht vor ihrer Vergangenheit. Sucht Erlösung.', metadata: '{"race":"darkelf","class":"rogue","status":"alive","type":"neutral","age":130,"gender":"female"}' },
  { name: 'Meister Chen', description: 'Menschlicher Mönch aus dem fernen Osten. Lehrt die Kunst des Kampfes und der Meditation.', metadata: '{"race":"human","class":"monk","status":"alive","type":"ally","age":65,"gender":"male"}' },
  { name: 'Ignis der Brennende', description: 'Drachenblütiger Zauberer mit Feuermagie. Seine Schuppen glühen im Kampf.', metadata: '{"race":"dragonborn","class":"sorcerer","status":"alive","type":"neutral","age":25,"gender":"male"}' },
  { name: 'Greta die Kräuterfrau', description: 'Alte Menschenfrau am Waldrand. Heilt mit Kräutern und guter Suppe.', metadata: '{"race":"human","class":"druid","status":"alive","type":"ally","age":75,"gender":"female"}' },
  { name: 'Kronprinz Aldric', description: 'Junger Thronfolger des Königreichs. Muss noch viel lernen über die Welt.', metadata: '{"race":"human","class":"fighter","status":"alive","type":"questgiver","age":19,"gender":"male"}' },
]

// ============================================================================
// STEP 3: INSERT ITEMS (15 Items)
// ============================================================================
console.log('⚔️  Inserting Items...')

const items = [
  { name: 'Schwert des Drachentöters', description: 'Eine mächtige Klinge, geschmiedet aus dem Zahn eines alten Drachen. Verursacht extra Schaden gegen Drachen.', metadata: '{"type":"weapon","rarity":"legendary","value":50000,"attunement":"yes"}' },
  { name: 'Mantel der Unsichtbarkeit', description: 'Ein feiner Elfenmantel, der seinen Träger verbirgt. Macht unsichtbar für 1 Stunde pro Tag.', metadata: '{"type":"armor","rarity":"very_rare","value":25000,"attunement":"yes"}' },
  { name: 'Heiltrank (Groß)', description: 'Ein roter Trank in kristallener Phiole. Heilt 4d4+4 Trefferpunkte.', metadata: '{"type":"potion","rarity":"uncommon","value":150,"consumable":"yes"}' },
  { name: 'Ring der Feuerbälle', description: 'Ein rubinbesetzter Ring, der Feuerbälle wirken kann. 3 Ladungen pro Tag.', metadata: '{"type":"ring","rarity":"rare","value":8000,"attunement":"yes"}' },
  { name: 'Bag of Holding', description: 'Ein magischer Beutel mit unendlichem Fassungsvermögen. Wiegt immer nur 5 Pfund.', metadata: '{"type":"wondrous","rarity":"uncommon","value":4000}' },
  { name: 'Stab der Macht', description: 'Ein Eichenstab mit silbernen Runen. Verstärkt alle Zauber des Trägers.', metadata: '{"type":"staff","rarity":"rare","value":12000,"attunement":"yes"}' },
  { name: 'Plattenrüstung +1', description: 'Magisch verstärkte Plattenrüstung. AC 19, kein Nachteil auf Schleichen.', metadata: '{"type":"armor","rarity":"rare","value":5000}' },
  { name: 'Dolch der Rückkehr', description: 'Ein Wurfdolch, der magisch zum Werfer zurückkehrt.', metadata: '{"type":"weapon","rarity":"uncommon","value":800}' },
  { name: 'Amulett des Lebensschutzes', description: 'Ein goldenes Amulett, das einmal am Tag den Tod abwendet.', metadata: '{"type":"amulet","rarity":"very_rare","value":15000,"attunement":"yes"}' },
  { name: 'Stiefel der Schnelligkeit', description: 'Magische Lederstiefel. Erhöhen die Bewegungsrate um 10 Fuß.', metadata: '{"type":"boots","rarity":"uncommon","value":2500,"attunement":"yes"}' },
  { name: 'Zauberbuch des Erzmagen', description: 'Ein uraltes Buch mit 20 Zaubern der Stufen 1-5.', metadata: '{"type":"book","rarity":"rare","value":6000}' },
  { name: 'Kurzschwert', description: 'Ein einfaches, aber gut gepflegtes Kurzschwert.', metadata: '{"type":"weapon","rarity":"common","value":10}' },
  { name: 'Heiltrank (Klein)', description: 'Ein kleiner roter Trank. Heilt 2d4+2 Trefferpunkte.', metadata: '{"type":"potion","rarity":"common","value":50,"consumable":"yes"}' },
  { name: 'Fackel', description: 'Eine einfache Fackel. Brennt 1 Stunde.', metadata: '{"type":"mundane","rarity":"common","value":1}' },
  { name: 'Seil (50ft)', description: 'Ein stabiles Hanfseil, 50 Fuß lang.', metadata: '{"type":"mundane","rarity":"common","value":1}' },
]

// ============================================================================
// STEP 4: INSERT LOCATIONS (15 Locations)
// ============================================================================
console.log('🗺️  Inserting Locations...')

const locations = [
  { name: 'Stadt Falkenpfeil', description: 'Die große Handelsstadt im Herzen des Königreichs. Über 50.000 Einwohner leben hier.', metadata: '{"type":"city","region":"Zentralreich","population":50000}' },
  { name: 'Taverne "Zum Goldenen Drachen"', description: 'Die beliebteste Taverne der Stadt. Finnegan Hopfenfuß ist hier der Wirt.', metadata: '{"type":"tavern","region":"Falkenpfeil"}' },
  { name: 'Schmiede des Brom', description: 'Die beste Schmiede der Region. Hier fertigt Brom legendäre Waffen.', metadata: '{"type":"smithy","region":"Falkenpfeil"}' },
  { name: 'Der Nebelwald', description: 'Ein mystischer Wald, ständig in Nebel gehüllt. Viele gehen hinein, wenige kommen zurück.', metadata: '{"type":"forest","region":"Wildnis"}' },
  { name: 'Schloss Dunkelstein', description: 'Eine düstere Burg auf einem Felsen. Lord Valdris residiert hier.', metadata: '{"type":"castle","region":"Schattenlande"}' },
  { name: 'Heiliger Hain', description: 'Ein uralter Hain mit riesigen Eichen. Die Druiden treffen sich hier zu Zeremonien.', metadata: '{"type":"grove","region":"Wildnis"}' },
  { name: 'Akademie der Magie', description: 'Die renommierteste Magierschule des Kontinents. Elara Mondschein lehrt hier.', metadata: '{"type":"academy","region":"Falkenpfeil"}' },
  { name: 'Hafenviertel', description: 'Das geschäftige Hafenviertel von Falkenpfeil. Handel und Schmuggel gehen hier Hand in Hand.', metadata: '{"type":"district","region":"Falkenpfeil"}' },
  { name: 'Tempel des Lichts', description: 'Der größte Tempel der Lichtgottheit. Bruder Marcus predigt hier regelmäßig.', metadata: '{"type":"temple","region":"Falkenpfeil"}' },
  { name: 'Die Unterstadt', description: 'Ein Labyrinth aus Tunneln unter Falkenpfeil. Hier leben die Ausgestoßenen.', metadata: '{"type":"underground","region":"Falkenpfeil"}' },
  { name: 'Bergfestung der Zwerge', description: 'Die uralte Festung von König Thorins Volk. Reich an Gold und Mithril.', metadata: '{"type":"fortress","region":"Eisenberge"}' },
  { name: 'Königspalast', description: 'Der prächtige Palast des Königs. Kronprinz Aldric wohnt hier.', metadata: '{"type":"palace","region":"Falkenpfeil"}' },
  { name: 'Marktplatz', description: 'Der zentrale Marktplatz von Falkenpfeil. Täglich tauschen hier Händler Waren.', metadata: '{"type":"market","region":"Falkenpfeil"}' },
  { name: 'Kloster der Stille', description: 'Ein abgeschiedenes Kloster in den Bergen. Meister Chen lehrt hier Kampfkunst.', metadata: '{"type":"monastery","region":"Östliche Berge"}' },
  { name: 'Ruinen von Alt-Eldoria', description: 'Die Überreste einer uralten Zivilisation. Voller Schätze und Gefahren.', metadata: '{"type":"ruins","region":"Wildnis"}' },
]

// ============================================================================
// STEP 5: INSERT FACTIONS (8 Factions)
// ============================================================================
console.log('⚔️  Inserting Factions...')

const factions = [
  { name: 'Die Harpers', description: 'Eine geheime Organisation von Barden und Waldläufern, die Freiheit und Gerechtigkeit schützen.', metadata: '{"type":"guild","alignment":"Chaotisch Gut","goals":"Bekämpfung von Tyrannei"}' },
  { name: 'Der Orden des Lichts', description: 'Ein Orden von Paladinen und Klerikern, die gegen das Böse kämpfen.', metadata: '{"type":"religious","alignment":"Rechtschaffen Gut","goals":"Vernichtung des Bösen"}' },
  { name: 'Die Diebesgilde', description: 'Eine organisierte Verbrecherbande, die in den Schatten operiert.', metadata: '{"type":"criminal","alignment":"Neutral Böse","goals":"Reichtum und Macht"}' },
  { name: 'Der Zirkel der Druiden', description: 'Ein Zusammenschluss von Druiden, die die Natur beschützen.', metadata: '{"type":"druidic","alignment":"Neutral","goals":"Naturschutz"}' },
  { name: 'Die Händlergilde', description: 'Eine mächtige Gilde von Kaufleuten, die den Handel kontrollieren.', metadata: '{"type":"trade","alignment":"Rechtschaffen Neutral","goals":"Wirtschaftliche Dominanz"}' },
  { name: 'Der Kult der Schatten', description: 'Ein dunkler Kult, der Lord Valdris dient und nach Macht strebt.', metadata: '{"type":"cult","alignment":"Chaotisch Böse","goals":"Herrschaft der Untoten"}' },
  { name: 'Die Königliche Garde', description: 'Die Elitekrieger des Königs, loyal zur Krone.', metadata: '{"type":"military","alignment":"Rechtschaffen Neutral","goals":"Schutz des Königreichs"}' },
  { name: 'Die Akademie der Künste', description: 'Eine Vereinigung von Magiern, Gelehrten und Künstlern.', metadata: '{"type":"academic","alignment":"Neutral","goals":"Wissen und Forschung"}' },
]

// ============================================================================
// STEP 6: INSERT LORE (10 Lore entries)
// ============================================================================
console.log('📜 Inserting Lore...')

const lore = [
  { name: 'Die Prophezeiung des Drachen', description: 'Eine uralte Prophezeiung besagt, dass ein Held den schlafenden Drachen wecken und besiegen wird, um das Königreich zu retten.', metadata: '{"type":"prophecy","era":"Altes Zeitalter"}' },
  { name: 'Der Krieg der Götter', description: 'Vor tausend Jahren kämpften die Götter gegeneinander. Die Narben dieses Krieges zeichnen noch heute die Landschaft.', metadata: '{"type":"history","era":"Göttlicher Krieg"}' },
  { name: 'Das Geheimnis des Nebelwaldes', description: 'Der Nebel im Wald ist kein natürliches Phänomen, sondern die Seelen der dort Gestorbenen.', metadata: '{"type":"mystery","era":"Unbekannt"}' },
  { name: 'Die Gründung von Falkenpfeil', description: 'Die Stadt wurde von einem Helden namens Aric dem Falken gegründet, der einen Riesen besiegte.', metadata: '{"type":"history","era":"Gründerzeit"}' },
  { name: 'Der Fluch der Dunkelsteins', description: 'Lord Valdris wurde verflucht, ewig als Vampir zu leben, nachdem er einen dunklen Pakt schloss.', metadata: '{"type":"curse","era":"Dunkle Zeitalter"}' },
  { name: 'Die Heilige Reliquie', description: 'Im Tempel des Lichts wird eine Reliquie aufbewahrt, die angeblich jeden heilen kann.', metadata: '{"type":"artifact","era":"Heiliges Zeitalter"}' },
  { name: 'Das Verlorene Königreich', description: 'Die Ruinen von Alt-Eldoria waren einst eine blühende Zivilisation, die durch Magie vernichtet wurde.', metadata: '{"type":"history","era":"Eldorianisches Reich"}' },
  { name: 'Die Sieben Siegel', description: 'Sieben magische Siegel halten einen mächtigen Dämon gefangen. Werden sie gebrochen, droht die Apokalypse.', metadata: '{"type":"prophecy","era":"Unbekannt"}' },
  { name: 'Der Pakt der Zwerge', description: 'Die Zwerge schlossen einen Pakt mit den Menschen, der seit 500 Jahren Frieden zwischen den Völkern sichert.', metadata: '{"type":"treaty","era":"Friedenszeitalter"}' },
  { name: 'Die Legende des Mondschwerts', description: 'Ein magisches Schwert, das nur bei Vollmond seine wahre Macht zeigt. Es gilt als verschollen.', metadata: '{"type":"legend","era":"Mythisches Zeitalter"}' },
]

// ============================================================================
// STEP 7: INSERT PLAYERS (4 Players)
// ============================================================================
console.log('🎮 Inserting Players...')

const players = [
  { name: 'Aria Sturmwind', description: 'Halbelfische Waldläuferin aus dem Nebelwald. Auf der Suche nach ihrem verschollenen Vater.', metadata: '{"race":"halfelf","class":"ranger","level":5,"player_name":"Max"}' },
  { name: 'Dorn Ambossbrecher', description: 'Zwergischer Kleriker des Schmiedegottes. Will den perfekten Hammer erschaffen.', metadata: '{"race":"dwarf","class":"cleric","level":5,"player_name":"Lisa"}' },
  { name: 'Zephyr Silberzunge', description: 'Menschlicher Barde mit einer Laute aus Drachenholz. Sammelt die größten Geschichten.', metadata: '{"race":"human","class":"bard","level":5,"player_name":"Tom"}' },
  { name: 'Nira Schattenklinge', description: 'Tiefling-Schurkin mit goldenem Herzen. Stiehlt von den Reichen, gibt den Armen.', metadata: '{"race":"tiefling","class":"rogue","level":5,"player_name":"Sarah"}' },
]

// ============================================================================
// INSERT ALL DATA
// ============================================================================
const insertAllData = db.transaction(() => {
  const ids = {
    npcs: [],
    items: [],
    locations: [],
    factions: [],
    lore: [],
    players: [],
  }

  // Insert NPCs
  for (const npc of npcs) {
    const result = insertEntity.run(npc.name, npc.description, entityTypes.NPC, campaignId, npc.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, npc.name, npc.description, npc.metadata)
    ids.npcs.push({ id: entityId, name: npc.name })
  }

  // Insert Items
  for (const item of items) {
    const result = insertEntity.run(item.name, item.description, entityTypes.Item, campaignId, item.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, item.name, item.description, item.metadata)
    ids.items.push({ id: entityId, name: item.name })
  }

  // Insert Locations
  for (const location of locations) {
    const result = insertEntity.run(location.name, location.description, entityTypes.Location, campaignId, location.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, location.name, location.description, location.metadata)
    ids.locations.push({ id: entityId, name: location.name })
  }

  // Insert Factions
  for (const faction of factions) {
    const result = insertEntity.run(faction.name, faction.description, entityTypes.Faction, campaignId, faction.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, faction.name, faction.description, faction.metadata)
    ids.factions.push({ id: entityId, name: faction.name })
  }

  // Insert Lore
  for (const l of lore) {
    const result = insertEntity.run(l.name, l.description, entityTypes.Lore, campaignId, l.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, l.name, l.description, l.metadata)
    ids.lore.push({ id: entityId, name: l.name })
  }

  // Insert Players
  for (const player of players) {
    const result = insertEntity.run(player.name, player.description, entityTypes.Player, campaignId, player.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, player.name, player.description, player.metadata)
    ids.players.push({ id: entityId, name: player.name })
  }

  return ids
})

let ids
try {
  ids = insertAllData()
  console.log(`✅ Inserted ${ids.npcs.length} NPCs`)
  console.log(`✅ Inserted ${ids.items.length} Items`)
  console.log(`✅ Inserted ${ids.locations.length} Locations`)
  console.log(`✅ Inserted ${ids.factions.length} Factions`)
  console.log(`✅ Inserted ${ids.lore.length} Lore entries`)
  console.log(`✅ Inserted ${ids.players.length} Players`)
} catch (error) {
  console.error('❌ Error inserting data:', error.message)
  process.exit(1)
}

// ============================================================================
// CREATE RELATIONS
// ============================================================================
console.log('\n🔗 Creating relations...')

const createRelations = db.transaction(() => {
  let count = 0

  // NPC ↔ NPC Relations (bidirectional!)
  // These are the important ones for testing!
  const npcRelations = [
    // Thorin knows several NPCs
    { from: 'Thorin Eisenschild', to: 'Brom der Schmied', type: 'Freund', notes: '{"text":"Alte Freunde aus der Bergfestung"}' },
    { from: 'Thorin Eisenschild', to: 'Elara Mondschein', type: 'Verbündeter', notes: null },
    { from: 'Thorin Eisenschild', to: 'Kronprinz Aldric', type: 'Berater', notes: '{"text":"Politische Allianz"}' },

    // Elara knows several NPCs
    { from: 'Elara Mondschein', to: 'Mystica die Seherin', type: 'Mentorin', notes: null },
    { from: 'Elara Mondschein', to: 'Ignis der Brennende', type: 'Schülerin', notes: '{"text":"Elara unterrichtet Ignis"}' },

    // Ragnar knows several NPCs
    { from: 'Ragnar Sturmfaust', to: 'Grimjaw der Henker', type: 'Rivale', notes: '{"text":"Alte Feindschaft"}' },
    { from: 'Ragnar Sturmfaust', to: 'Kira Wolfherz', type: 'Freund', notes: null },

    // Lyra has connections
    { from: 'Lyra Schattenflüster', to: 'Nyx Schattentänzerin', type: 'Kontakt', notes: '{"text":"Geschäftspartner im Schatten"}' },
    { from: 'Lyra Schattenflüster', to: 'Finnegan Hopfenfuß', type: 'Informant', notes: null },

    // Lord Valdris - villain connections
    { from: 'Lord Valdris von Dunkelstein', to: 'Grimjaw der Henker', type: 'Untergebener', notes: '{"text":"Valdris bezahlt Grimjaw gut"}' },

    // More connections
    { from: 'Bruder Marcus', to: 'Garrick Eisenhand', type: 'Ordensbruder', notes: null },
    { from: 'Seraphina Flammenkuss', to: 'Bruder Marcus', type: 'Verbündete', notes: null },
    { from: 'Thalia Sonnentau', to: 'Kira Wolfherz', type: 'Lehrerin', notes: '{"text":"Druidische Ausbildung"}' },
    { from: 'Meister Chen', to: 'Garrick Eisenhand', type: 'Lehrer', notes: '{"text":"Kampftraining"}' },
    { from: 'Greta die Kräuterfrau', to: 'Zara die Weise', type: 'Kollegin', notes: null },
  ]

  for (const rel of npcRelations) {
    const fromNpc = ids.npcs.find(n => n.name === rel.from)
    const toNpc = ids.npcs.find(n => n.name === rel.to)
    if (fromNpc && toNpc) {
      insertRelation.run(fromNpc.id, toNpc.id, rel.type, rel.notes)
      count++
    }
  }
  console.log(`   ✓ Created ${count} NPC↔NPC relations`)

  // NPC → Faction Relations
  let factionCount = 0
  const factionMemberships = [
    { npc: 'Finnegan Hopfenfuß', faction: 'Die Harpers', type: 'Mitglied' },
    { npc: 'Kira Wolfherz', faction: 'Die Harpers', type: 'Mitglied' },
    { npc: 'Bruder Marcus', faction: 'Der Orden des Lichts', type: 'Priester' },
    { npc: 'Garrick Eisenhand', faction: 'Der Orden des Lichts', type: 'Paladin' },
    { npc: 'Seraphina Flammenkuss', faction: 'Der Orden des Lichts', type: 'Verbündete' },
    { npc: 'Lyra Schattenflüster', faction: 'Die Diebesgilde', type: 'Meisterdiebin' },
    { npc: 'Nyx Schattentänzerin', faction: 'Die Diebesgilde', type: 'Ehemalig' },
    { npc: 'Thalia Sonnentau', faction: 'Der Zirkel der Druiden', type: 'Erzdruidin' },
    { npc: 'Greta die Kräuterfrau', faction: 'Der Zirkel der Druiden', type: 'Mitglied' },
    { npc: 'Zara die Weise', faction: 'Die Händlergilde', type: 'Alchemistin' },
    { npc: 'Brom der Schmied', faction: 'Die Händlergilde', type: 'Meister' },
    { npc: 'Lord Valdris von Dunkelstein', faction: 'Der Kult der Schatten', type: 'Anführer' },
    { npc: 'Grimjaw der Henker', faction: 'Der Kult der Schatten', type: 'Söldner' },
    { npc: 'Kronprinz Aldric', faction: 'Die Königliche Garde', type: 'Kommandant' },
    { npc: 'Elara Mondschein', faction: 'Die Akademie der Künste', type: 'Erzmagierin' },
    { npc: 'Mystica die Seherin', faction: 'Die Akademie der Künste', type: 'Seherin' },
    { npc: 'Ignis der Brennende', faction: 'Die Akademie der Künste', type: 'Schüler' },
  ]

  for (const mem of factionMemberships) {
    const npc = ids.npcs.find(n => n.name === mem.npc)
    const faction = ids.factions.find(f => f.name === mem.faction)
    if (npc && faction) {
      insertRelation.run(npc.id, faction.id, mem.type, null)
      factionCount++
    }
  }
  console.log(`   ✓ Created ${factionCount} NPC→Faction relations`)

  // NPC → Location Relations
  let locationCount = 0
  const npcLocations = [
    { npc: 'Finnegan Hopfenfuß', location: 'Taverne "Zum Goldenen Drachen"', type: 'Besitzer' },
    { npc: 'Brom der Schmied', location: 'Schmiede des Brom', type: 'Arbeitet' },
    { npc: 'Thorin Eisenschild', location: 'Bergfestung der Zwerge', type: 'Herrscht' },
    { npc: 'Lord Valdris von Dunkelstein', location: 'Schloss Dunkelstein', type: 'Residiert' },
    { npc: 'Thalia Sonnentau', location: 'Heiliger Hain', type: 'Hütet' },
    { npc: 'Elara Mondschein', location: 'Akademie der Magie', type: 'Lehrt' },
    { npc: 'Bruder Marcus', location: 'Tempel des Lichts', type: 'Predigt' },
    { npc: 'Kronprinz Aldric', location: 'Königspalast', type: 'Wohnt' },
    { npc: 'Meister Chen', location: 'Kloster der Stille', type: 'Lehrt' },
    { npc: 'Lyra Schattenflüster', location: 'Die Unterstadt', type: 'Operiert' },
    { npc: 'Kira Wolfherz', location: 'Der Nebelwald', type: 'Beschützt' },
    { npc: 'Zara die Weise', location: 'Marktplatz', type: 'Verkauft' },
  ]

  for (const loc of npcLocations) {
    const npc = ids.npcs.find(n => n.name === loc.npc)
    const location = ids.locations.find(l => l.name === loc.location)
    if (npc && location) {
      insertRelation.run(npc.id, location.id, loc.type, null)
      locationCount++
    }
  }
  console.log(`   ✓ Created ${locationCount} NPC→Location relations`)

  // NPC → Item Relations
  let itemCount = 0
  const npcItems = [
    { npc: 'Ragnar Sturmfaust', item: 'Schwert des Drachentöters', type: 'Trägt' },
    { npc: 'Lyra Schattenflüster', item: 'Mantel der Unsichtbarkeit', type: 'Besitzt' },
    { npc: 'Elara Mondschein', item: 'Stab der Macht', type: 'Trägt' },
    { npc: 'Garrick Eisenhand', item: 'Plattenrüstung +1', type: 'Trägt' },
    { npc: 'Seraphina Flammenkuss', item: 'Ring der Feuerbälle', type: 'Trägt' },
    { npc: 'Bruder Marcus', item: 'Amulett des Lebensschutzes', type: 'Trägt' },
    { npc: 'Meister Chen', item: 'Stiefel der Schnelligkeit', type: 'Trägt' },
    { npc: 'Zara die Weise', item: 'Bag of Holding', type: 'Besitzt' },
    { npc: 'Mystica die Seherin', item: 'Zauberbuch des Erzmagen', type: 'Hütet' },
    { npc: 'Nyx Schattentänzerin', item: 'Dolch der Rückkehr', type: 'Trägt' },
  ]

  for (const item of npcItems) {
    const npc = ids.npcs.find(n => n.name === item.npc)
    const it = ids.items.find(i => i.name === item.item)
    if (npc && it) {
      insertRelation.run(npc.id, it.id, item.type, null)
      itemCount++
    }
  }
  console.log(`   ✓ Created ${itemCount} NPC→Item relations`)

  // NPC → Lore Relations
  let loreCount = 0
  const npcLore = [
    { npc: 'Elara Mondschein', lore: 'Die Prophezeiung des Drachen', type: 'Kennt' },
    { npc: 'Mystica die Seherin', lore: 'Die Prophezeiung des Drachen', type: 'Sah' },
    { npc: 'Thorin Eisenschild', lore: 'Der Pakt der Zwerge', type: 'Hütet' },
    { npc: 'Lord Valdris von Dunkelstein', lore: 'Der Fluch der Dunkelsteins', type: 'Erlebte' },
    { npc: 'Thalia Sonnentau', lore: 'Das Geheimnis des Nebelwaldes', type: 'Kennt' },
    { npc: 'Bruder Marcus', lore: 'Die Heilige Reliquie', type: 'Bewacht' },
    { npc: 'Kronprinz Aldric', lore: 'Die Gründung von Falkenpfeil', type: 'Studierte' },
    { npc: 'Garrick Eisenhand', lore: 'Die Sieben Siegel', type: 'Sucht' },
  ]

  for (const l of npcLore) {
    const npc = ids.npcs.find(n => n.name === l.npc)
    const loreItem = ids.lore.find(lo => lo.name === l.lore)
    if (npc && loreItem) {
      insertRelation.run(npc.id, loreItem.id, l.type, null)
      loreCount++
    }
  }
  console.log(`   ✓ Created ${loreCount} NPC→Lore relations`)

  // Player → NPC Relations
  let playerCount = 0
  const playerRelations = [
    { player: 'Aria Sturmwind', npc: 'Kira Wolfherz', type: 'Freundin' },
    { player: 'Aria Sturmwind', npc: 'Thalia Sonnentau', type: 'Mentorin' },
    { player: 'Dorn Ambossbrecher', npc: 'Brom der Schmied', type: 'Meister' },
    { player: 'Dorn Ambossbrecher', npc: 'Thorin Eisenschild', type: 'König' },
    { player: 'Zephyr Silberzunge', npc: 'Finnegan Hopfenfuß', type: 'Kollege' },
    { player: 'Nira Schattenklinge', npc: 'Lyra Schattenflüster', type: 'Kontakt' },
    { player: 'Nira Schattenklinge', npc: 'Seraphina Flammenkuss', type: 'Freundin' },
  ]

  for (const rel of playerRelations) {
    const player = ids.players.find(p => p.name === rel.player)
    const npc = ids.npcs.find(n => n.name === rel.npc)
    if (player && npc) {
      insertRelation.run(player.id, npc.id, rel.type, null)
      playerCount++
    }
  }
  console.log(`   ✓ Created ${playerCount} Player→NPC relations`)

  return count + factionCount + locationCount + itemCount + loreCount + playerCount
})

try {
  const totalRelations = createRelations()
  console.log(`\n✅ Created ${totalRelations} total relations!`)
} catch (error) {
  console.error('❌ Error creating relations:', error.message)
  process.exit(1)
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(60))
console.log('📊 DATABASE SEEDED SUCCESSFULLY!')
console.log('='.repeat(60))
console.log(`
Entities:
  - ${ids.npcs.length} NPCs
  - ${ids.items.length} Items
  - ${ids.locations.length} Locations
  - ${ids.factions.length} Factions
  - ${ids.lore.length} Lore entries
  - ${ids.players.length} Players

Relations:
  - NPC ↔ NPC (bidirectional test!)
  - NPC → Factions
  - NPC → Locations
  - NPC → Items
  - NPC → Lore
  - Player → NPC

Test the NPC relations delete bug by:
  1. Open any NPC (e.g., Thorin Eisenschild)
  2. Go to "NPC Relations" tab
  3. Try to delete a relation
  4. Reopen the dialog - relation should be gone!
`)

db.close()
