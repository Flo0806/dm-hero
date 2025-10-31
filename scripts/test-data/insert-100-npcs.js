#!/usr/bin/env node

/**
 * Insert 100 test NPCs into the database
 * Usage: node scripts/test-data/insert-100-npcs.js
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

console.log('🗄️  Inserting 100 test NPCs...')

// Get campaign ID and NPC entity type ID
const campaign = db.prepare('SELECT id FROM campaigns LIMIT 1').get()
if (!campaign) {
  console.error('❌ No campaign found! Please create a campaign first.')
  process.exit(1)
}

const npcType = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get()
if (!npcType) {
  console.error('❌ NPC entity type not found!')
  process.exit(1)
}

const campaignId = campaign.id
const typeId = npcType.id

console.log(`📋 Using campaign ID: ${campaignId}`)
console.log(`📋 Using NPC type ID: ${typeId}`)

// Test NPCs data
const npcs = [
  // Fully filled NPCs (20)
  { name: 'Günther Müller', description: 'Ein alter Schmied aus Düsseldorf, der legendäre Waffen schmiedet. Bekannt für seine verschrobene Art und seine Liebe zu Met.', metadata: '{"race":"dwarf","class":"fighter","status":"alive","type":"merchant","location":"Düsseldorf Schmiede"}' },
  { name: 'Ælfrida die Weise', description: 'Hochelfische Magierin mit 300 Jahren Erfahrung. Hütet das Wissen der alten Bibliothek von Thärandor.', metadata: '{"race":"highelf","class":"wizard","status":"alive","type":"ally","location":"Bibliothek Thärandor"}' },
  { name: 'José "El Rápido" Fernández', description: 'Schneller Dolchkämpfer aus dem Süden. Hat eine Rechnung mit der Diebesgilde offen.', metadata: '{"race":"human","class":"rogue","status":"alive","type":"enemy","location":"Hafenviertel"}' },
  { name: 'Brün Eisenfaust', description: 'Zwergischer Kleriker des Schmiedegottes Moradin. Trägt einen Hammer, der Stahl spalten kann.', metadata: '{"race":"mountaindwarf","class":"cleric","status":"alive","type":"ally","location":"Tempel des Moradin"}' },
  { name: 'Naïve die Träumerin', description: 'Waldelfische Druidin, die mit Tieren spricht. Beschützt den Nebelwald vor Eindringlingen.', metadata: '{"race":"woodelf","class":"druid","status":"alive","type":"neutral","location":"Nebelwald"}' },
  { name: 'François D\'Artagnan', description: 'Menschlicher Adliger und Musketier. Sucht den Mörder seines Vaters.', metadata: '{"race":"human","class":"fighter","status":"alive","type":"questgiver","location":"Königspalast"}' },
  { name: 'Ömür der Feuertänzer', description: 'Tiefling-Hexenmeister mit einem Pakt zur Hölle. Jongliert mit Flammen zur Unterhaltung.', metadata: '{"race":"tiefling","class":"warlock","status":"alive","type":"merchant","location":"Marktplatz"}' },
  { name: 'Søren Sturmrufer', description: 'Menschlicher Barbar aus dem Norden. Kontrolliert die Winde mit seinem Schlachtschrei.', metadata: '{"race":"human","class":"barbarian","status":"alive","type":"ally","location":"Nordlande"}' },
  { name: 'Lüdmilla von Kärnstein', description: 'Vampirin und Gräfin des Schattenlandes. Sammelt seltene Blutweine.', metadata: '{"race":"human","class":"sorcerer","status":"undead","type":"villain","location":"Schloss Kärnstein"}' },
  { name: 'Çelik der Händler', description: 'Gnomischer Erfinder mit sprechenden Automatonen. Verkauft mechanische Kuriositäten.', metadata: '{"race":"gnome","class":"wizard","status":"alive","type":"merchant","location":"Erfinderwerkstatt"}' },
  { name: 'Björn Bärenklaue', description: 'Halbork-Waldläufer mit einem zahmen Bären namens "Brumm". Führt Reisende durch die Berge.', metadata: '{"race":"halforc","class":"ranger","status":"alive","type":"ally","location":"Gebirgspass"}' },
  { name: 'Åsa die Seherin', description: 'Menschliche Wahrsagerin, die in Runen liest. Ihre Prophezeiungen treffen immer ein - nur zu spät.', metadata: '{"race":"human","class":"cleric","status":"alive","type":"questgiver","location":"Runenzelt"}' },
  { name: 'Pétur Silberzunge', description: 'Halblingischer Barde, der mit Liedern Kriege beendet hat. Spielt eine verzauberte Laute.', metadata: '{"race":"lightfoothalfling","class":"bard","status":"alive","type":"ally","location":"Taverne \'Goldene Harfe\'"}' },
  { name: 'Živa die Naturverbundene', description: 'Drachenblütige Druidin mit grünen Schuppen. Kann Pflanzen zum Wachsen bringen mit einem Gedanken.', metadata: '{"race":"dragonborn","class":"druid","status":"alive","type":"neutral","location":"Smaragdgarten"}' },
  { name: 'Müslüm der Mystiker', description: 'Menschlicher Mönch, der Meditation lehrt. Kann auf Wasser laufen und durch Wände sehen.', metadata: '{"race":"human","class":"monk","status":"alive","type":"ally","location":"Kloster der Stille"}' },
  { name: 'Gérard Beaumont', description: 'Menschlicher Paladin des Lichts. Trägt eine Rüstung, die im Dunkeln leuchtet.', metadata: '{"race":"human","class":"paladin","status":"alive","type":"ally","location":"Lichtkathedrale"}' },
  { name: 'Özlem die Schattentänzerin', description: 'Halbelfische Schurkin, die Identitäten sammelt. Niemand kennt ihr wahres Gesicht.', metadata: '{"race":"halfelf","class":"rogue","status":"alive","type":"neutral","location":"Unterwelt"}' },
  { name: 'Jürgen "Der Hammer" Hartmann', description: 'Zwergischer Kämpfer und Arenachampion. Hat 500 Kämpfe ohne Niederlage gewonnen.', metadata: '{"race":"hilldwarf","class":"fighter","status":"alive","type":"merchant","location":"Arena"}' },
  { name: 'Eärendil Sternenwanderer', description: 'Hochelfischer Waldläufer, der Sternbilder liest. Führt Schiffe sicher durch Stürme.', metadata: '{"race":"highelf","class":"ranger","status":"alive","type":"ally","location":"Hafenturm"}' },
  { name: 'Yüksel die Flamme', description: 'Tiefling-Zauberin mit roten Hörnern. Beschwört Feuerdämonen für spektakuläre Shows.', metadata: '{"race":"tiefling","class":"sorcerer","status":"alive","type":"merchant","location":"Feuerthron"}' },

  // Medium filled NPCs (40)
  { name: 'Bernhard von Berg', description: 'Alter Stadthauptmann, der sich zur Ruhe setzen will.', metadata: '{"race":"human","class":"fighter","status":"alive"}' },
  { name: 'Elöise Lichtsang', description: 'Junge Klerikerin mit heilenden Händen.', metadata: '{"race":"human","class":"cleric","type":"ally"}' },
  { name: 'Grünwald Moosbart', description: 'Waldläufer, der den Wald beschützt.', metadata: '{"race":"woodelf","class":"ranger","status":"alive"}' },
  { name: 'Håkan der Starke', description: 'Barbar aus dem hohen Norden.', metadata: '{"race":"human","class":"barbarian"}' },
  { name: 'Süleyman der Weise', description: 'Alter Gelehrter in der Akademie.', metadata: '{"race":"human","class":"wizard","type":"questgiver"}' },
  { name: 'Løkke Trugbild', description: 'Illusionistin mit fragwürdiger Moral.', metadata: '{"race":"gnome","class":"wizard"}' },
  { name: 'André Dubois', description: 'Französischer Fechtmeister.', metadata: '{"race":"human","class":"fighter","status":"alive"}' },
  { name: 'Åshild Frosthauch', description: 'Eismagierin mit kaltem Herzen.', metadata: '{"race":"human","class":"wizard","type":"neutral"}' },
  { name: 'Özcan der Schatten', description: 'Diebesgildenmeister.', metadata: '{"race":"human","class":"rogue","type":"enemy"}' },
  { name: 'Günter Grünspan', description: 'Giftmischer und Alchemist.', metadata: '{"race":"gnome","class":"wizard"}' },
  { name: 'Thérèse Bonheur', description: 'Glücksritterin und Kartenspielerin.', metadata: '{"race":"human","class":"rogue","status":"alive"}' },
  { name: 'Mürsel der Händler', description: 'Gewürzverkäufer aus dem Osten.', metadata: '{"race":"human","type":"merchant"}' },
  { name: 'Jörmungandr Schlangenblut', description: 'Schurkischer Assassine.', metadata: '{"race":"human","class":"rogue","type":"enemy"}' },
  { name: 'Änne die Kräuterfrau', description: 'Heilerin im Dorf.', metadata: '{"race":"human","class":"druid","status":"alive"}' },
  { name: 'Lütfiye die Tänzerin', description: 'Bauchtänzerin in der Taverne.', metadata: '{"race":"human","class":"bard"}' },
  { name: 'Rémi Bordeaux', description: 'Weinverkäufer und Spion.', metadata: '{"race":"halfling","class":"rogue","type":"neutral"}' },
  { name: 'Åke Eisenbart', description: 'Zwergischer Braumeister.', metadata: '{"race":"mountaindwarf","type":"merchant"}' },
  { name: 'Çağla Mondhain', description: 'Elfische Priesterin.', metadata: '{"race":"highelf","class":"cleric","status":"alive"}' },
  { name: 'Jürg der Jäger', description: 'Kopfgeldjäger mit 50 Kills.', metadata: '{"race":"human","class":"ranger","type":"enemy"}' },
  { name: 'Gülsüm die Schneiderin', description: 'Magierin, die verzauberte Kleider näht.', metadata: '{"race":"human","class":"wizard"}' },
  { name: 'Ömer der Schmied', description: 'Hersteller verzauberter Waffen.', metadata: '{"race":"dwarf","class":"fighter","type":"merchant"}' },
  { name: 'Björk Donnerfaust', description: 'Kriegerin mit Blitzmagie.', metadata: '{"race":"human","class":"barbarian","status":"alive"}' },
  { name: 'François Leroy', description: 'Adliger mit dunklem Geheimnis.', metadata: '{"race":"human","type":"villain"}' },
  { name: 'Müge die Seherin', description: 'Wahrsagerin am Markt.', metadata: '{"race":"human","class":"wizard","type":"questgiver"}' },
  { name: 'Ärmin der Gerechte', description: 'Paladin der Ordnung.', metadata: '{"race":"human","class":"paladin","status":"alive"}' },
  { name: 'Søren Frostwolf', description: 'Waldläufer mit Wolfsgefährten.', metadata: '{"race":"human","class":"ranger"}' },
  { name: 'Yücel der Flinke', description: 'Akrobat und Taschendieb.', metadata: '{"race":"halfling","class":"rogue","type":"enemy"}' },
  { name: 'Élise Dumont', description: 'Bardin mit verzauberter Stimme.', metadata: '{"race":"human","class":"bard","status":"alive"}' },
  { name: 'Günay Mondschein', description: 'Nächtliche Jägerin.', metadata: '{"race":"elf","class":"ranger"}' },
  { name: 'Mårten der Bär', description: 'Großer Krieger.', metadata: '{"race":"human","class":"fighter","status":"alive"}' },
  { name: 'Özgür der Freie', description: 'Ehemaliger Sklave, jetzt Freiheitskämpfer.', metadata: '{"race":"human","class":"barbarian"}' },
  { name: 'Lüder der Alte', description: 'Pensionierter Abenteurer.', metadata: '{"race":"human","class":"wizard"}' },
  { name: 'Åse Sturmtochter', description: 'Klerikerin des Donnergottes.', metadata: '{"race":"human","class":"cleric","status":"alive"}' },
  { name: 'Çetin der Harte', description: 'Unbesiegbarer Gladiator.', metadata: '{"race":"halforc","class":"fighter"}' },
  { name: 'Régis le Grand', description: 'Großer Magier der Akademie.', metadata: '{"race":"human","class":"wizard","type":"questgiver"}' },
  { name: 'Ümit die Hoffnung', description: 'Klerikerin, die Hoffnung spendet.', metadata: '{"race":"human","class":"cleric"}' },
  { name: 'Jörn Erdschütterer', description: 'Zwerg mit Erdbeben-Hammer.', metadata: '{"race":"mountaindwarf","class":"fighter","status":"alive"}' },
  { name: 'Sümeyye die Geduldige', description: 'Mönchsmeisterin.', metadata: '{"race":"human","class":"monk"}' },
  { name: 'André Noir', description: 'Meisterdieb in schwarzer Kleidung.', metadata: '{"race":"human","class":"rogue","type":"enemy"}' },
  { name: 'Åsta Rabe', description: 'Hexe mit einem Rabenvertrauten.', metadata: '{"race":"human","class":"wizard","status":"alive"}' },

  // Minimal filled NPCs (40)
  { name: 'Bärnd', description: 'Wächter am Tor.', metadata: '{"race":"human"}' },
  { name: 'Émilie', description: 'Barfrau.', metadata: '{}' },
  { name: 'Öz', description: 'Straßenkind.', metadata: '{"status":"alive"}' },
  { name: 'Jütte', description: 'Marktfrau.', metadata: '{"race":"human"}' },
  { name: 'Søren', description: 'Fischer.', metadata: '{}' },
  { name: 'Müller', description: 'Bäcker.', metadata: '{"type":"merchant"}' },
  { name: 'Ås', description: 'Bauer.', metadata: '{"race":"human"}' },
  { name: 'Çağ', description: 'Kurier.', metadata: '{}' },
  { name: 'Lö', description: 'Bettler.', metadata: '{"status":"alive"}' },
  { name: 'Bjørn', description: 'Jäger.', metadata: '{"race":"human"}' },
  { name: 'Gül', description: 'Blumenverkäuferin.', metadata: '{}' },
  { name: 'Jør', description: 'Stallbursche.', metadata: '{"race":"halfling"}' },
  { name: 'Él', description: 'Straßenmusikant.', metadata: '{}' },
  { name: 'Yük', description: 'Lastenträger.', metadata: '{"race":"human"}' },
  { name: 'Änna', description: 'Magd.', metadata: '{}' },
  { name: 'Rémy', description: 'Laufbursche.', metadata: '{"race":"human"}' },
  { name: 'Öm', description: 'Händler.', metadata: '{"type":"merchant"}' },
  { name: 'Günni', description: 'Wirt.', metadata: '{}' },
  { name: 'Måns', description: 'Seemann.', metadata: '{"race":"human"}' },
  { name: 'Süley', description: 'Wächter.', metadata: '{}' },
  { name: 'Bern', description: 'Soldat.', metadata: '{"race":"human","class":"fighter"}' },
  { name: 'Éloi', description: 'Mönch.', metadata: '{"class":"monk"}' },
  { name: 'Özlem', description: 'Tänzerin.', metadata: '{}' },
  { name: 'Jürgen', description: 'Händler.', metadata: '{"type":"merchant"}' },
  { name: 'Åse', description: 'Priesterin.', metadata: '{"class":"cleric"}' },
  { name: 'Müge', description: 'Wahrsagerin.', metadata: '{}' },
  { name: 'Søs', description: 'Bettlerin.', metadata: '{"race":"human"}' },
  { name: 'Çelik', description: 'Schmied.', metadata: '{}' },
  { name: 'Lüd', description: 'Adlige.', metadata: '{"race":"human"}' },
  { name: 'Bjørk', description: 'Kriegerin.', metadata: '{"class":"fighter"}' },
  { name: 'Yüce', description: 'Gelehrter.', metadata: '{}' },
  { name: 'Ärn', description: 'Ritter.', metadata: '{"race":"human","class":"paladin"}' },
  { name: 'Gün', description: 'Dieb.', metadata: '{"class":"rogue"}' },
  { name: 'Ömer', description: 'Waffenschmied.', metadata: '{"type":"merchant"}' },
  { name: 'Jøran', description: 'Hirte.', metadata: '{}' },
  { name: 'Él', description: 'Sänger.', metadata: '{"class":"bard"}' },
  { name: 'Müs', description: 'Koch.', metadata: '{"race":"halfling"}' },
  { name: 'Søren II', description: 'Prinz.', metadata: '{}' },
  { name: 'Åke', description: 'Brauer.', metadata: '{"race":"dwarf"}' },
  { name: 'Çağlar', description: 'Späher.', metadata: '{"class":"ranger"}' },
]

// Prepare insert statements
const insertEntity = db.prepare(`
  INSERT INTO entities (name, description, type_id, campaign_id, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`)

const insertFts = db.prepare(`
  INSERT INTO entities_fts(rowid, name, description, metadata)
  VALUES (?, ?, ?, ?)
`)

// Insert NPCs in a transaction
const insertAll = db.transaction(() => {
  let count = 0
  for (const npc of npcs) {
    const result = insertEntity.run(npc.name, npc.description, typeId, campaignId, npc.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, npc.name, npc.description, npc.metadata)
    count++
  }
  return count
})

try {
  const inserted = insertAll()
  console.log(`✅ Inserted ${inserted} NPCs successfully!`)
  console.log(`\n📊 Summary:`)
  console.log(`   - 20 fully filled NPCs`)
  console.log(`   - 40 medium filled NPCs`)
  console.log(`   - 40 minimal filled NPCs`)
  console.log(`\n🎮 Ready to test search functionality!`)
} catch (error) {
  console.error('❌ Error inserting NPCs:', error.message)
  process.exit(1)
}

db.close()
