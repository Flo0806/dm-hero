#!/usr/bin/env node

/**
 * Insert test NPCs, Items, and Relations into the database
 * IMPORTANT: Clears existing NPCs and Items before inserting!
 * Usage: node scripts/test-data/insert-test-data.js
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

// Get campaign ID and entity type IDs
const campaign = db.prepare('SELECT id FROM campaigns LIMIT 1').get()
if (!campaign) {
  console.error('❌ No campaign found! Please create a campaign first.')
  process.exit(1)
}

const npcType = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get()
const itemType = db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get()
const locationType = db.prepare("SELECT id FROM entity_types WHERE name = 'Location'").get()

if (!npcType || !itemType || !locationType) {
  console.error('❌ Entity types not found!')
  process.exit(1)
}

const campaignId = campaign.id
const npcTypeId = npcType.id
const itemTypeId = itemType.id
const locationTypeId = locationType.id

console.log(`📋 Using campaign ID: ${campaignId}`)
console.log(`📋 NPC type ID: ${npcTypeId}`)
console.log(`📋 Item type ID: ${itemTypeId}`)
console.log(`📋 Location type ID: ${locationTypeId}`)

// ============================================================================
// STEP 1: CLEANUP - Delete existing NPCs and Items
// ============================================================================
console.log('\n🧹 Cleaning up existing test data...')

const cleanup = db.transaction(() => {
  // Delete from FTS first
  db.prepare(`DELETE FROM entities_fts WHERE rowid IN (SELECT id FROM entities WHERE type_id IN (?, ?))`).run(npcTypeId, itemTypeId)

  // Delete entity relations
  db.prepare(`DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE type_id IN (?, ?))`).run(npcTypeId, itemTypeId)
  db.prepare(`DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE type_id IN (?, ?))`).run(npcTypeId, itemTypeId)

  // Delete entity images
  db.prepare(`DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE type_id IN (?, ?))`).run(npcTypeId, itemTypeId)

  // Delete entities
  const result = db.prepare(`DELETE FROM entities WHERE type_id IN (?, ?)`).run(npcTypeId, itemTypeId)

  return result.changes
})

try {
  const deleted = cleanup()
  console.log(`✅ Deleted ${deleted} existing NPCs and Items`)
} catch (error) {
  console.error('❌ Error during cleanup:', error.message)
  process.exit(1)
}

// ============================================================================
// STEP 2: INSERT NPCs (100 test NPCs)
// ============================================================================
console.log('\n🗄️  Inserting 100 test NPCs...')

const npcs = [
  // Fully filled NPCs (20) with Umlauts, accents, special chars
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

// ============================================================================
// STEP 3: INSERT ITEMS (100 test items with varying complexity)
// ============================================================================
const items = [
  // Fully filled items (30) - legendary/rare with special chars
  { name: 'Schwert des Dämmerlichts', description: 'Eine mächtige Klinge, geschmiedet in den Schmieden von Mithril. Leuchtet bei Anwesenheit von Untoten. Verleiht +3 auf Angriffswürfe.', metadata: '{"type":"weapon","rarity":"legendary","value":50000,"attunement":"yes","properties":"finesse, versatile"}' },
  { name: 'Mantel der Schattenläufer', description: 'Ein schwarzer Umhang, der seinen Träger mit Schatten verschmelzen lässt. Gewährt Vorteil auf Schleichen-Würfe bei Dunkelheit.', metadata: '{"type":"armor","rarity":"rare","value":8000,"attunement":"yes","properties":"stealth"}' },
  { name: 'Tränk der Höllenflammen', description: 'Ein brodelnder roter Trank, der nach Schwefel riecht. Verleiht Feuerresistenz für 1 Stunde und +2d6 Feuerschaden auf Angriffe.', metadata: '{"type":"potion","rarity":"rare","value":500,"consumable":"yes"}' },
  { name: 'Ring der Télépathïe', description: 'Ein silberner Ring mit eingraviertem Auge. Ermöglicht telepathische Kommunikation bis 120ft. Kann Gedanken lesen (DC 15 Wis Save).', metadata: '{"type":"ring","rarity":"very_rare","value":12000,"attunement":"yes"}' },
  { name: 'Åxträgårds Donnerhammer', description: 'Legendärer Kriegshammer aus dem Norden. Bei einem Treffer Donner im Umkreis von 30ft (3d8 Thunder damage). Kann Blitze beschwören.', metadata: '{"type":"weapon","rarity":"legendary","value":75000,"attunement":"yes","properties":"two-handed, heavy"}' },
  { name: 'Buch der Verbôtenen Künste', description: 'Ein in Leder gebundenes Grimoire mit goldenen Runen. Enthält 10 Zauber der Nekromantie (Level 1-5). Verlangt nach Blutopfern.', metadata: '{"type":"book","rarity":"rare","value":6000,"cursed":"yes"}' },
  { name: 'Sphäre des Élementaren Chaos', description: 'Eine kristallene Kugel mit wirbelnden Elementen. Beschwört einen Elementar (1/Tag). Kann explodieren bei falscher Benutzung (DC 18).', metadata: '{"type":"wondrous","rarity":"very_rare","value":20000,"attunement":"yes"}' },
  { name: 'Çeliks Mechanischer Falke', description: 'Ein mechanischer Vogel aus Bronze und Mithril. Kann 100 Meilen fliegen und Nachrichten überbringen. Sieht alles, was sein Träger sieht.', metadata: '{"type":"wondrous","rarity":"rare","value":5000}' },
  { name: 'Gürtel der Rïesenkraft', description: 'Ein breiter Ledergürtel mit Sturmgiganten-Runen. Setzt Stärke auf 25. Ermöglicht das Heben von 2 Tonnen.', metadata: '{"type":"belt","rarity":"legendary","value":40000,"attunement":"yes"}' },
  { name: 'Armbrust "Dönnerschlag"', description: 'Eine Zwergen-Armbrust aus Adamant. Schießt Bolzen, die explodieren (zusätzlich 2d6 Feuerschaden). Lädt automatisch nach.', metadata: '{"type":"weapon","rarity":"very_rare","value":15000,"attunement":"no","properties":"heavy, loading, range"}' },
  { name: 'Münze des Schïcksals', description: 'Eine goldene Münze mit zwei Gesichtern. Beim Wurf: Kopf = Vorteil auf nächsten Wurf, Zahl = Nachteil. Kann Realität verändern (1/Woche).', metadata: '{"type":"wondrous","rarity":"artifact","value":999999,"cursed":"maybe"}' },
  { name: 'Stâb der Fröste', description: 'Ein eisblauer Stab aus gefrorenem Wasser. +2 auf Angriffswürfe. Kann "Cone of Cold" wirken (5 Ladungen/Tag).', metadata: '{"type":"staff","rarity":"very_rare","value":25000,"attunement":"yes"}' },
  { name: 'Rüstung des Drächenbluts', description: 'Schuppenpanzer aus roten Drachenschuppen. AC 17. Verleiht Feuerimmunität und die Fähigkeit, Flammen zu atmen (3/Tag).', metadata: '{"type":"armor","rarity":"legendary","value":60000,"attunement":"yes"}' },
  { name: 'Laute der Verzâuberung', description: 'Eine goldene Laute mit Runen. Performance-Check +5. Kann "Charm Person" und "Suggestion" wirken (unbegrenzt).', metadata: '{"type":"instrument","rarity":"rare","value":7000,"attunement":"yes"}' },
  { name: 'Dolch "Séélenräuber"', description: 'Ein schwarzer Dolch mit purpurner Klinge. Bei kritischem Treffer: Ziel muss DC 17 Con Save oder stirbt sofort. Seele wird im Dolch gefangen.', metadata: '{"type":"weapon","rarity":"artifact","value":100000,"attunement":"yes","cursed":"yes"}' },
  { name: 'Flasché der Endlosen Wässer', description: 'Eine blaue Glasflasche mit Korken. Produziert unbegrenzt Wasser (1 Gallone/Action). Kann Geyser erzeugen (Str Save DC 15).', metadata: '{"type":"wondrous","rarity":"uncommon","value":1000}' },
  { name: 'Stïefel des Flüges', description: 'Lederboots mit Federn verziert. Fluggeschwindigkeit 60ft für 4 Stunden/Tag. Muss 12h ruhen danach.', metadata: '{"type":"boots","rarity":"rare","value":8000,"attunement":"yes"}' },
  { name: 'Âmulett des Göttlichen Schützes', description: 'Ein goldenes Amulett mit Heiligem Symbol. +1 AC. 1/Tag: "Shield of Faith" ohne Spell Slot. Glüht bei Untoten.', metadata: '{"type":"amulet","rarity":"uncommon","value":2000,"attunement":"no"}' },
  { name: 'Würfel der Reälität', description: 'Ein elfenbeinfarbener Würfel mit 20 Seiten. Beim Würfeln: zufälliger Effekt aus Tabelle. Kann Realität umschreiben.', metadata: '{"type":"wondrous","rarity":"artifact","value":999999,"cursed":"maybe"}' },
  { name: 'Speer des Jägers', description: 'Ein langer Speer aus Eichenholz und Mithrilspitze. +2 Angriff. Kehrt zum Werfer zurück. Verursacht doppelten Schaden gegen Bestien.', metadata: '{"type":"weapon","rarity":"rare","value":5000,"attunement":"no","properties":"thrown, versatile"}' },
  { name: 'Helŷn des Allwïssens', description: 'Ein silberner Helm mit Saphiren. Verleiht Truesight 60ft. Kann "Detect Thoughts" wirken (unlimitiert).', metadata: '{"type":"helmet","rarity":"legendary","value":50000,"attunement":"yes"}' },
  { name: 'Kétte der Gefängnis-Flucht', description: 'Eine eiserne Kette, die sich selbst löst. Action: entkommen aus Fesseln/Gefängnis (automatischer Erfolg). Funktioniert 3/Tag.', metadata: '{"type":"wondrous","rarity":"uncommon","value":1500}' },
  { name: 'Bögén "Möndenstrahl"', description: 'Ein silberner Langbogen mit Mondphasen eingraviert. +2 Angriff. Pfeile leuchten und ignorieren Deckung. Kritisch bei 19-20.', metadata: '{"type":"weapon","rarity":"very_rare","value":18000,"attunement":"yes","properties":"two-handed, range"}' },
  { name: 'Röbe der Sterne', description: 'Eine dunkelblaue Robe mit leuchtenden Sternen. AC 15. Kann "Levitate" und "Magic Missile" wirken (je 3 Ladungen/Tag).', metadata: '{"type":"robe","rarity":"very_rare","value":22000,"attunement":"yes"}' },
  { name: 'Schïld der Refléxion', description: 'Ein polierter Stahlschild mit magischem Spiegel. +2 AC. Kann Zauber reflektieren (Reaction, 3 Ladungen/Tag).', metadata: '{"type":"shield","rarity":"rare","value":9000,"attunement":"yes"}' },
  { name: 'Pfeïfe des Råttenbeschwörers', description: 'Eine hölzerne Pfeife mit Rattengravur. Beschwört 3d6 Ratten (1/Tag). Ratten gehorchen Befehlen für 1 Stunde.', metadata: '{"type":"wondrous","rarity":"uncommon","value":800}' },
  { name: 'Handschuhe des Díebes', description: 'Schwarze Lederhandschuhe. +5 auf Sleight of Hand. Kann durch Wände greifen (1/Tag).', metadata: '{"type":"gloves","rarity":"uncommon","value":2500,"attunement":"no"}' },
  { name: 'Zêpter der Herrschaft', description: 'Ein goldenes Zepter mit Rubin. Kann "Command" wirken (DC 17, unlimitiert). 1/Tag: "Dominate Person" (DC 18).', metadata: '{"type":"rod","rarity":"legendary","value":45000,"attunement":"yes"}' },
  { name: 'Båg of Holding', description: 'Ein schwarzer Lederbeutel. Öffnung 2 Fuß Durchmesser, Inneres 64 Kubikfuß. Wiegt immer nur 15 Pfund, egal was drin ist.', metadata: '{"type":"wondrous","rarity":"uncommon","value":4000}' },
  { name: 'Schwért der Rächung', description: 'Ein langes Schwert mit blutroter Klinge. +1 Angriff. Bei Tod eines Verbündeten in 30ft: +3 Angriff und +2d6 Schaden für 1 Minute.', metadata: '{"type":"weapon","rarity":"rare","value":10000,"attunement":"yes","properties":"versatile"}' },

  // Medium filled items (40)
  { name: 'Heiltränk (Groß)', description: 'Heilt 4d4+4 Trefferpunkte.', metadata: '{"type":"potion","rarity":"uncommon","value":150,"consumable":"yes"}' },
  { name: 'Zauberstab der Feuerbälle', description: 'Wirkt Feuerball (7 Ladungen).', metadata: '{"type":"wand","rarity":"rare","value":6000}' },
  { name: 'Langschwert +1', description: 'Ein magisches Langschwert.', metadata: '{"type":"weapon","rarity":"uncommon","value":1000}' },
  { name: 'Plattenrüstung +1', description: 'Magische Plattenrüstung, AC 19.', metadata: '{"type":"armor","rarity":"uncommon","value":5000}' },
  { name: 'Unsichtbarkeitstrank', description: 'Macht unsichtbar für 1 Stunde.', metadata: '{"type":"potion","rarity":"rare","value":500}' },
  { name: 'Dolch der Rückkehr', description: 'Kehrt nach Wurf zurück.', metadata: '{"type":"weapon","rarity":"uncommon","value":800}' },
  { name: 'Seil der Fesselung', description: 'Bindet Gegner automatisch.', metadata: '{"type":"wondrous","rarity":"uncommon","value":600}' },
  { name: 'Stein des Glücks', description: '+1 auf alle Saves.', metadata: '{"type":"wondrous","rarity":"uncommon","value":3000}' },
  { name: 'Antigifte Phiole', description: 'Heilt alle Gifte sofort.', metadata: '{"type":"potion","rarity":"common","value":50}' },
  { name: 'Kürass des Schutzes', description: 'AC 16, Resistenz gegen Hiebwaffen.', metadata: '{"type":"armor","rarity":"rare","value":7000}' },
  { name: 'Streitkolben +2', description: 'Magischer Streitkolben.', metadata: '{"type":"weapon","rarity":"rare","value":4000}' },
  { name: 'Umhang der Unsichtbarkeit', description: 'Macht unsichtbar (1 Stunde/Tag).', metadata: '{"type":"cloak","rarity":"legendary","value":30000}' },
  { name: 'Zaubertrank der Stärke', description: 'Stärke wird 21 für 1 Stunde.', metadata: '{"type":"potion","rarity":"rare","value":400}' },
  { name: 'Wurfaxt +1', description: 'Magische Wurfaxt.', metadata: '{"type":"weapon","rarity":"uncommon","value":900}' },
  { name: 'Lederpanzer +1', description: 'Leichte magische Rüstung.', metadata: '{"type":"armor","rarity":"uncommon","value":2000}' },
  { name: 'Armbrust der Präzision', description: '+2 Angriff, ignoriert halbe Deckung.', metadata: '{"type":"weapon","rarity":"rare","value":5000}' },
  { name: 'Fläschchen mit Säure', description: '2d6 Säureschaden.', metadata: '{"type":"alchemical","rarity":"common","value":25}' },
  { name: 'Rauchbombe', description: 'Erzeugt Rauchcloud 20ft Radius.', metadata: '{"type":"alchemical","rarity":"common","value":30}' },
  { name: 'Schutzring +1', description: '+1 AC und Saves.', metadata: '{"type":"ring","rarity":"rare","value":3500}' },
  { name: 'Stiefel des Springens', description: 'Sprungdistanz verdoppelt.', metadata: '{"type":"boots","rarity":"uncommon","value":1200}' },
  { name: 'Glutschwert', description: 'Verursacht +1d6 Feuerschaden.', metadata: '{"type":"weapon","rarity":"rare","value":6000}' },
  { name: 'Elfenmantel', description: 'Vorteil auf Stealth.', metadata: '{"type":"cloak","rarity":"uncommon","value":1500}' },
  { name: 'Runenamulett', description: 'Schützt vor Verzauberung.', metadata: '{"type":"amulet","rarity":"rare","value":4000}' },
  { name: 'Zauberbuch (leer)', description: '100 Seiten für Zauber.', metadata: '{"type":"book","rarity":"common","value":50}' },
  { name: 'Dietrich-Set', description: '+2 auf Schlösser knacken.', metadata: '{"type":"tool","rarity":"uncommon","value":200}' },
  { name: 'Fährtenfinder-Kompass', description: 'Zeigt zu gesuchtem Ziel.', metadata: '{"type":"wondrous","rarity":"rare","value":2000}' },
  { name: 'Feuerstahl (magisch)', description: 'Entzündet alles sofort.', metadata: '{"type":"tool","rarity":"common","value":100}' },
  { name: 'Kriegshammer +1', description: 'Magischer Kriegshammer.', metadata: '{"type":"weapon","rarity":"uncommon","value":1100}' },
  { name: 'Kettenhemd +1', description: 'AC 17.', metadata: '{"type":"armor","rarity":"uncommon","value":3000}' },
  { name: 'Magischer Kompass', description: 'Zeigt immer Norden.', metadata: '{"type":"wondrous","rarity":"common","value":50}' },
  { name: 'Leuchtstab', description: 'Leuchtet 60ft Radius.', metadata: '{"type":"wondrous","rarity":"common","value":20}' },
  { name: 'Wundsalbe', description: 'Heilt 1d4 Trefferpunkte.', metadata: '{"type":"consumable","rarity":"common","value":10}' },
  { name: 'Magierfokus +1', description: '+1 auf Zauberwürfe.', metadata: '{"type":"focus","rarity":"uncommon","value":1000}' },
  { name: 'Energietrank', description: 'Kein Schlaf nötig für 24h.', metadata: '{"type":"potion","rarity":"uncommon","value":100}' },
  { name: 'Silberschwert', description: 'Wirksam gegen Lykanthropen.', metadata: '{"type":"weapon","rarity":"uncommon","value":1500}' },
  { name: 'Handspiegelzauber', description: 'Zeigt Wahrheit.', metadata: '{"type":"wondrous","rarity":"rare","value":3000}' },
  { name: 'Feuerfeste Robe', description: 'Resistenz gegen Feuer.', metadata: '{"type":"robe","rarity":"uncommon","value":2500}' },
  { name: 'Wanderstab', description: 'Kann "Shillelagh" wirken.', metadata: '{"type":"staff","rarity":"uncommon","value":800}' },
  { name: 'Heiliges Wasser', description: '2d6 Radiant Schaden gegen Untote.', metadata: '{"type":"consumable","rarity":"common","value":25}' },
  { name: 'Vergifteter Dolch', description: '+1d4 Giftschaden.', metadata: '{"type":"weapon","rarity":"uncommon","value":700}' },

  // Minimal filled items (30)
  { name: 'Kurzschwert', description: 'Einfaches Schwert.', metadata: '{"type":"weapon"}' },
  { name: 'Holzschild', description: 'Einfacher Schild.', metadata: '{"type":"shield"}' },
  { name: 'Heiltränk', description: 'Heilt 2d4+2.', metadata: '{"type":"potion"}' },
  { name: 'Fackel', description: 'Brennt 1 Stunde.', metadata: '{}' },
  { name: 'Seil (50ft)', description: 'Hanfseil.', metadata: '{}' },
  { name: 'Brecheisen', description: 'Zum Aufbrechen.', metadata: '{"type":"tool"}' },
  { name: 'Laterne', description: 'Leuchtet 30ft.', metadata: '{}' },
  { name: 'Rucksack', description: 'Trägt 30 Pfund.', metadata: '{}' },
  { name: 'Wasserflasche', description: '1 Liter Wasser.', metadata: '{}' },
  { name: 'Ration', description: 'Essen für 1 Tag.', metadata: '{}' },
  { name: 'Decke', description: 'Warme Decke.', metadata: '{}' },
  { name: 'Kerze', description: 'Brennt 1 Stunde.', metadata: '{}' },
  { name: 'Hammer', description: 'Werkzeug.', metadata: '{}' },
  { name: 'Spitzhacke', description: 'Zum Graben.', metadata: '{}' },
  { name: 'Schaufel', description: 'Zum Graben.', metadata: '{}' },
  { name: 'Zelt', description: 'Für 2 Personen.', metadata: '{}' },
  { name: 'Würfel', description: 'Zum Spielen.', metadata: '{}' },
  { name: 'Karten', description: 'Spielkarten.', metadata: '{}' },
  { name: 'Flöte', description: 'Musikinstrument.', metadata: '{}' },
  { name: 'Kreide', description: 'Zum Schreiben.', metadata: '{}' },
  { name: 'Papier (10 Blatt)', description: 'Leere Blätter.', metadata: '{}' },
  { name: 'Tinte', description: 'Schwarze Tinte.', metadata: '{}' },
  { name: 'Feder', description: 'Schreibfeder.', metadata: '{}' },
  { name: 'Wetzstein', description: 'Zum Schärfen.', metadata: '{}' },
  { name: 'Nadel und Faden', description: 'Zum Nähen.', metadata: '{}' },
  { name: 'Seife', description: 'Zur Reinigung.', metadata: '{}' },
  { name: 'Parfüm', description: 'Duftet gut.', metadata: '{}' },
  { name: 'Spiegel', description: 'Kleiner Handspiegel.', metadata: '{}' },
  { name: 'Kamm', description: 'Zur Haarpflege.', metadata: '{}' },
  { name: 'Messer', description: 'Kleines Messer.', metadata: '{}' },
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

// Insert all data in a transaction
const insertAllData = db.transaction(() => {
  const npcIds = []
  const itemIds = []

  // Insert NPCs
  for (const npc of npcs) {
    const result = insertEntity.run(npc.name, npc.description, npcTypeId, campaignId, npc.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, npc.name, npc.description, npc.metadata)
    npcIds.push({ id: entityId, name: npc.name })
  }

  // Insert Items
  for (const item of items) {
    const result = insertEntity.run(item.name, item.description, itemTypeId, campaignId, item.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, item.name, item.description, item.metadata)
    itemIds.push({ id: entityId, name: item.name })
  }

  return { npcIds, itemIds }
})

let npcIds, itemIds

try {
  const result = insertAllData()
  npcIds = result.npcIds
  itemIds = result.itemIds

  console.log(`✅ Inserted ${npcIds.length} NPCs successfully!`)
  console.log(`✅ Inserted ${itemIds.length} Items successfully!`)
} catch (error) {
  console.error('❌ Error inserting data:', error.message)
  process.exit(1)
}

// ============================================================================
// STEP 4: CREATE RELATIONS (NPCs <-> Items, varying complexity)
// ============================================================================
console.log('\n🔗 Creating entity relations...')

const insertRelation = db.prepare(`
  INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes, created_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`)

const createRelations = db.transaction(() => {
  let relationCount = 0

  // Strategy:
  // - 10 NPCs with NO items (lonely characters)
  // - 30 NPCs with 1 item each (normal equipment)
  // - 30 NPCs with 2-3 items (adventurers)
  // - 20 NPCs with 5-10 items (merchants, collectors)
  // - 10 NPCs with 15-30 items (EXTREME hoarders)

  const relationTypes = ['trägt', 'besitzt', 'benutzt', 'verkauft', 'sucht', 'hat verloren', 'bewacht', 'hat gestohlen']

  // Group 1: 10 NPCs with 0 items (indices 0-9)
  // Skip these NPCs

  // Group 2: 30 NPCs with 1 item (indices 10-39)
  for (let i = 10; i < 40; i++) {
    const npc = npcIds[i]
    const item = itemIds[Math.floor(Math.random() * itemIds.length)]
    const relType = relationTypes[Math.floor(Math.random() * relationTypes.length)]
    insertRelation.run(npc.id, item.id, relType, null)
    relationCount++
  }

  // Group 3: 30 NPCs with 2-3 items (indices 40-69)
  for (let i = 40; i < 70; i++) {
    const npc = npcIds[i]
    const numItems = 2 + Math.floor(Math.random() * 2) // 2 or 3
    const usedItems = new Set()

    for (let j = 0; j < numItems; j++) {
      let item
      do {
        item = itemIds[Math.floor(Math.random() * itemIds.length)]
      } while (usedItems.has(item.id))
      usedItems.add(item.id)

      const relType = relationTypes[Math.floor(Math.random() * relationTypes.length)]
      insertRelation.run(npc.id, item.id, relType, null)
      relationCount++
    }
  }

  // Group 4: 20 NPCs with 5-10 items (indices 70-89)
  for (let i = 70; i < 90; i++) {
    const npc = npcIds[i]
    const numItems = 5 + Math.floor(Math.random() * 6) // 5-10
    const usedItems = new Set()

    for (let j = 0; j < numItems; j++) {
      let item
      do {
        item = itemIds[Math.floor(Math.random() * itemIds.length)]
      } while (usedItems.has(item.id))
      usedItems.add(item.id)

      const relType = relationTypes[Math.floor(Math.random() * relationTypes.length)]
      const notes = j === 0 ? JSON.stringify({ note: 'Hauptausrüstung' }) : null
      insertRelation.run(npc.id, item.id, relType, notes)
      relationCount++
    }
  }

  // Group 5: 10 NPCs with 15-30 items (indices 90-99) - EXTREME!
  for (let i = 90; i < 100; i++) {
    const npc = npcIds[i]
    const numItems = 15 + Math.floor(Math.random() * 16) // 15-30
    const usedItems = new Set()

    for (let j = 0; j < numItems; j++) {
      let item
      do {
        item = itemIds[Math.floor(Math.random() * itemIds.length)]
      } while (usedItems.has(item.id))
      usedItems.add(item.id)

      const relType = relationTypes[Math.floor(Math.random() * relationTypes.length)]
      const notes = j < 3 ? JSON.stringify({ note: `Wichtiges Item #${j + 1}` }) : null
      insertRelation.run(npc.id, item.id, relType, notes)
      relationCount++
    }
  }

  return relationCount
})

try {
  const relations = createRelations()
  console.log(`✅ Created ${relations} NPC→Item relations!`)
} catch (error) {
  console.error('❌ Error creating NPC→Item relations:', error.message)
  process.exit(1)
}

// ============================================================================
// STEP 5: INSERT LOCATIONS (50 locations)
// ============================================================================
console.log('\n🗺️  Inserting 50 test locations...')

const locations = [
  // Fully filled locations (15)
  { name: 'Taverne "Zum Goldenen Drachen"', description: 'Eine gemütliche Taverne im Hafenviertel. Der Wirt Günther schenkt den besten Met der Stadt aus. Beliebter Treffpunkt für Abenteurer.', metadata: '{"type":"tavern","region":"Hafenviertel","notes":"Berühmt für Met und Geschichten"}' },
  { name: 'Schmïede des Brün Eisenfaust', description: 'Zwergische Schmiede am Rande der Stadt. Hier werden legendäre Waffen geschmiedet. Der Amboss glüht Tag und Nacht.', metadata: '{"type":"smithy","region":"Handwerkerviertel","notes":"Beste Waffen der Region"}' },
  { name: 'Bïbliothek von Thärandor', description: 'Eine uralte Bibliothek mit 10.000 Büchern. Ælfrida die Weise hütet hier das Wissen der Jahrhunderte.', metadata: '{"type":"library","region":"Gelehrtenviertel","notes":"Magische Bücher, strenge Regeln"}' },
  { name: 'Der Nëbelwald', description: 'Ein mystischer Wald, ständig in Nebel gehüllt. Naïve die Träumerin beschützt diesen Ort vor Eindringlingen.', metadata: '{"type":"forest","region":"Außerhalb","notes":"Gefährlich, magisch"}' },
  { name: 'Schlöss Kärnstein', description: 'Eine düstere Burg auf einem Felsen. Lüdmilla von Kärnstein residiert hier und sammelt seltene Blutweine.', metadata: '{"type":"castle","region":"Schattenlande","notes":"Vampir-Gräfin, Vorsicht!"}' },
  { name: 'Märktplatz am Brunnen', description: 'Der zentrale Marktplatz der Stadt. Händler aus aller Welt bieten ihre Waren an. Ömür der Feuertänzer unterhält die Menge.', metadata: '{"type":"market","region":"Stadtzentrum","notes":"Täglich 6-18 Uhr geöffnet"}' },
  { name: 'Tëmpel des Moradin', description: 'Ein massiver Steintempel zu Ehren des Schmiedegottes. Brün Eisenfaust hält hier Gottesdienste ab.', metadata: '{"type":"temple","region":"Tempelberg","notes":"Zwergen-Gott, Schmiedekunst"}' },
  { name: 'Arëna "Donnerkuppel"', description: 'Eine riesige Arena mit 5000 Plätzen. Jürgen "Der Hammer" Hartmann hat hier 500 Kämpfe gewonnen.', metadata: '{"type":"arena","region":"Unterhaltungsviertel","notes":"Gladiatorenkämpfe jeden Sabbat"}' },
  { name: 'Hafën der Sturmsegler', description: 'Ein geschäftiger Hafen mit Schiffen aus fernen Ländern. Eärendil Sternenwanderer navigiert hier die Schiffe.', metadata: '{"type":"harbor","region":"Hafenviertel","notes":"Import/Export, Zollkontrolle"}' },
  { name: 'Ërfinderwerkstatt von Çelik', description: 'Eine chaotische Werkstatt voller sprechender Automatonen und mechanischer Kuriositäten.', metadata: '{"type":"workshop","region":"Erfinderviertel","notes":"Gnomische Erfindungen, experimentell"}' },
  { name: 'Königspalást', description: 'Der prächtige Palast des Königs. François D\'Artagnan dient hier als königlicher Musketier.', metadata: '{"type":"palace","region":"Adelsquartier","notes":"Strenge Wachen, Adelszugang"}' },
  { name: 'Untërwelt-Versteck', description: 'Ein geheimes Versteck in den Katakomben. Özlem die Schattentänzerin trifft hier ihre Kontakte.', metadata: '{"type":"hideout","region":"Untergrund","notes":"Geheim, nur Eingeweihte"}' },
  { name: 'Klöster der Stille', description: 'Ein abgeschiedenes Kloster in den Bergen. Müslüm der Mystiker lehrt hier Meditation und innere Ruhe.', metadata: '{"type":"monastery","region":"Berge","notes":"Schweigegelübde, Training"}' },
  { name: 'Smäragdgarten', description: 'Ein magischer Garten mit exotischen Pflanzen. Živa die Naturverbundene lässt hier Pflanzen in Sekunden wachsen.', metadata: '{"type":"garden","region":"Naturpark","notes":"Heilkräuter, magische Pflanzen"}' },
  { name: 'Rünenzelt der Åsa', description: 'Ein buntes Zelt auf dem Markt. Åsa die Seherin liest hier aus Runen die Zukunft.', metadata: '{"type":"tent","region":"Marktplatz","notes":"Wahrsagerei, 5 Gold pro Reading"}' },

  // Medium filled locations (20)
  { name: 'Gasthaus "Goldene Harfe"', description: 'Beliebtes Gasthaus mit Live-Musik.', metadata: '{"type":"inn","region":"Stadtzentrum"}' },
  { name: 'Waffenkammer der Stadt', description: 'Städtische Waffenkammer und Arsenal.', metadata: '{"type":"armory","region":"Kaserne"}' },
  { name: 'Alchemisten-Laden', description: 'Laden mit Tränken und Giften.', metadata: '{"type":"shop","region":"Handwerkerviertel"}' },
  { name: 'Nordlande-Außenposten', description: 'Militärischer Außenposten im Norden.', metadata: '{"type":"outpost","region":"Nordlande"}' },
  { name: 'Gebirgspass', description: 'Gefährlicher Pass durch die Berge.', metadata: '{"type":"passage","region":"Gebirge"}' },
  { name: 'Lichtkathedrale', description: 'Prächtige Kathedrale des Lichtgottes.', metadata: '{"type":"cathedral","region":"Tempelberg"}' },
  { name: 'Diebesgilde-Hauptquartier', description: 'Geheimes HQ der Diebesgilde.', metadata: '{"type":"guild","region":"Untergrund"}' },
  { name: 'Akademie der Magie', description: 'Hochschule für Magier und Gelehrte.', metadata: '{"type":"academy","region":"Gelehrtenviertel"}' },
  { name: 'Feuerthron-Zirkus', description: 'Wanderzirkus mit spektakulären Shows.', metadata: '{"type":"circus","region":"Außerhalb"}' },
  { name: 'Brauerei "Eisenbart"', description: 'Zwergische Brauerei mit bestem Bier.', metadata: '{"type":"brewery","region":"Handwerkerviertel"}' },
  { name: 'Hafenwache-Turm', description: 'Wachturm am Hafen.', metadata: '{"type":"tower","region":"Hafenviertel"}' },
  { name: 'Rätsel-Ruine', description: 'Alte Ruine voller Geheimnisse.', metadata: '{"type":"ruins","region":"Außerhalb"}' },
  { name: 'Heilkräuter-Hütte', description: 'Hütte einer Kräuterfrau im Wald.', metadata: '{"type":"hut","region":"Waldrand"}' },
  { name: 'Kartenspiel-Kasino', description: 'Kasino mit hohen Einsätzen.', metadata: '{"type":"casino","region":"Unterhaltungsviertel"}' },
  { name: 'Gewürzmarkt', description: 'Markt mit exotischen Gewürzen.', metadata: '{"type":"market","region":"Handelsviertel"}' },
  { name: 'Gefängnis-Zitadelle', description: 'Hochsicherheitsgefängnis der Stadt.', metadata: '{"type":"prison","region":"Festung"}' },
  { name: 'Mondtempel', description: 'Tempel der Mondgöttin.', metadata: '{"type":"temple","region":"Tempelberg"}' },
  { name: 'Jäger-Hütte', description: 'Einsame Hütte eines Jägers.', metadata: '{"type":"hut","region":"Wald"}' },
  { name: 'Schneider-Atelier', description: 'Atelier für verzauberte Kleidung.', metadata: '{"type":"workshop","region":"Modequartier"}' },
  { name: 'Arena-Trainingsplatz', description: 'Trainingsgelände für Gladiatoren.', metadata: '{"type":"training","region":"Arena"}' },

  // Minimal filled locations (15)
  { name: 'Stadttor Nord', description: 'Nördliches Stadttor.', metadata: '{"type":"gate"}' },
  { name: 'Stadttor Süd', description: 'Südliches Stadttor.', metadata: '{"type":"gate"}' },
  { name: 'Brunnen-Platz', description: 'Platz mit altem Brunnen.', metadata: '{}' },
  { name: 'Stall', description: 'Städtischer Pferdestall.', metadata: '{"type":"stable"}' },
  { name: 'Backstube', description: 'Bäckerei am Markt.', metadata: '{}' },
  { name: 'Fischmarkt', description: 'Markt für frischen Fisch.', metadata: '{"type":"market"}' },
  { name: 'Park', description: 'Kleiner Stadtpark.', metadata: '{}' },
  { name: 'Friedhof', description: 'Alter Friedhof.', metadata: '{}' },
  { name: 'Brücke', description: 'Steinbrücke über den Fluss.', metadata: '{}' },
  { name: 'Wachhaus', description: 'Wachhaus der Stadtwache.', metadata: '{"type":"guardhouse"}' },
  { name: 'Lagerhaus', description: 'Großes Lagerhaus.', metadata: '{}' },
  { name: 'Schiffswerft', description: 'Werft am Hafen.', metadata: '{}' },
  { name: 'Kaserne', description: 'Militärkaserne.', metadata: '{"type":"barracks"}' },
  { name: 'Rathaus', description: 'Städtisches Rathaus.', metadata: '{"type":"government"}' },
  { name: 'Marktstand', description: 'Einfacher Marktstand.', metadata: '{}' },
]

const insertAllLocations = db.transaction(() => {
  const locationIds = []

  // Insert Locations
  for (const location of locations) {
    const result = insertEntity.run(location.name, location.description, locationTypeId, campaignId, location.metadata)
    const entityId = result.lastInsertRowid
    insertFts.run(entityId, location.name, location.description, location.metadata)
    locationIds.push({ id: entityId, name: location.name })
  }

  return locationIds
})

let locationIds

try {
  locationIds = insertAllLocations()
  console.log(`✅ Inserted ${locationIds.length} Locations successfully!`)
} catch (error) {
  console.error('❌ Error inserting locations:', error.message)
  process.exit(1)
}

// ============================================================================
// STEP 6: CREATE LOCATION RELATIONS (NPCs → Locations, Items → Locations)
// ============================================================================
console.log('\n🔗 Creating location relations...')

const createLocationRelations = db.transaction(() => {
  let relationCount = 0

  const npcToLocationTypes = ['lebt in', 'arbeitet bei', 'besucht oft', 'versteckt sich in', 'besitzt', 'bewacht']
  const itemToLocationTypes = ['liegt in', 'versteckt in', 'ausgestellt in', 'gelagert in', 'verloren in']

  // Strategy for NPCs → Locations:
  // - 10 Locations with 0 NPCs (empty)
  // - 20 Locations with 1-2 NPCs (quiet)
  // - 15 Locations with 3-5 NPCs (normal)
  // - 5 Locations with 10-20 NPCs (VERY busy - like market, tavern)

  // Group 1: 10 Locations with 0 NPCs (indices 0-9) - SKIP

  // Group 2: 20 Locations with 1-2 NPCs (indices 10-29)
  for (let i = 10; i < 30; i++) {
    const location = locationIds[i]
    const numNpcs = 1 + Math.floor(Math.random() * 2) // 1 or 2
    const usedNpcs = new Set()

    for (let j = 0; j < numNpcs; j++) {
      let npc
      do {
        npc = npcIds[Math.floor(Math.random() * npcIds.length)]
      } while (usedNpcs.has(npc.id))
      usedNpcs.add(npc.id)

      const relType = npcToLocationTypes[Math.floor(Math.random() * npcToLocationTypes.length)]
      insertRelation.run(npc.id, location.id, relType, null)
      relationCount++
    }
  }

  // Group 3: 15 Locations with 3-5 NPCs (indices 30-44)
  for (let i = 30; i < 45; i++) {
    const location = locationIds[i]
    const numNpcs = 3 + Math.floor(Math.random() * 3) // 3-5
    const usedNpcs = new Set()

    for (let j = 0; j < numNpcs; j++) {
      let npc
      do {
        npc = npcIds[Math.floor(Math.random() * npcIds.length)]
      } while (usedNpcs.has(npc.id))
      usedNpcs.add(npc.id)

      const relType = npcToLocationTypes[Math.floor(Math.random() * npcToLocationTypes.length)]
      insertRelation.run(npc.id, location.id, relType, null)
      relationCount++
    }
  }

  // Group 4: 5 Locations with 10-20 NPCs (indices 45-49) - EXTREME!
  for (let i = 45; i < 50; i++) {
    const location = locationIds[i]
    const numNpcs = 10 + Math.floor(Math.random() * 11) // 10-20
    const usedNpcs = new Set()

    for (let j = 0; j < numNpcs; j++) {
      let npc
      do {
        npc = npcIds[Math.floor(Math.random() * npcIds.length)]
      } while (usedNpcs.has(npc.id))
      usedNpcs.add(npc.id)

      const relType = npcToLocationTypes[Math.floor(Math.random() * npcToLocationTypes.length)]
      const notes = j < 2 ? JSON.stringify({ note: `Wichtige Person #${j + 1}` }) : null
      insertRelation.run(npc.id, location.id, relType, notes)
      relationCount++
    }
  }

  // Strategy for Items → Locations:
  // - 30 Locations with 0 Items
  // - 10 Locations with 1-2 Items
  // - 10 Locations with 5-15 Items (treasure rooms!)

  // Group 1: 30 Locations with 0 Items (indices 0-29) - SKIP

  // Group 2: 10 Locations with 1-2 Items (indices 30-39)
  for (let i = 30; i < 40; i++) {
    const location = locationIds[i]
    const numItems = 1 + Math.floor(Math.random() * 2) // 1-2
    const usedItems = new Set()

    for (let j = 0; j < numItems; j++) {
      let item
      do {
        item = itemIds[Math.floor(Math.random() * itemIds.length)]
      } while (usedItems.has(item.id))
      usedItems.add(item.id)

      const relType = itemToLocationTypes[Math.floor(Math.random() * itemToLocationTypes.length)]
      insertRelation.run(item.id, location.id, relType, null)
      relationCount++
    }
  }

  // Group 3: 10 Locations with 5-15 Items (indices 40-49) - TREASURE ROOMS!
  for (let i = 40; i < 50; i++) {
    const location = locationIds[i]
    const numItems = 5 + Math.floor(Math.random() * 11) // 5-15
    const usedItems = new Set()

    for (let j = 0; j < numItems; j++) {
      let item
      do {
        item = itemIds[Math.floor(Math.random() * itemIds.length)]
      } while (usedItems.has(item.id))
      usedItems.add(item.id)

      const relType = itemToLocationTypes[Math.floor(Math.random() * itemToLocationTypes.length)]
      const notes = j < 3 ? JSON.stringify({ note: `Wertvoller Schatz #${j + 1}` }) : null
      insertRelation.run(item.id, location.id, relType, notes)
      relationCount++
    }
  }

  return relationCount
})

try {
  const locationRelations = createLocationRelations()
  console.log(`✅ Created ${locationRelations} location relations!`)
  console.log(`\n📊 Final Summary:`)
  console.log(`   - 100 NPCs total`)
  console.log(`   - 100 Items total`)
  console.log(`   - 50 Locations total`)
  console.log(`\n   Relations:`)
  console.log(`   - NPCs ↔ Items: Already created`)
  console.log(`   - NPCs → Locations: Created`)
  console.log(`   - Items → Locations: Created`)
  console.log(`\n🎮 Ready to test cross-entity search!`)
  console.log(`💡 Examples:`)
  console.log(`   - Items page → Search "Çağlar" → Find items owned by Çağlar`)
  console.log(`   - Locations page → Search "Günther" → Find locations where Günther lives/works`)
  console.log(`   - Locations page → Search "Schwert" → Find locations containing swords`)
} catch (error) {
  console.error('❌ Error creating location relations:', error.message)
  process.exit(1)
}

db.close()
