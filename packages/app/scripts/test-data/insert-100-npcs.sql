-- Insert 100 test NPCs with diverse names, races, classes, and fill levels
-- Usage: sqlite3 data/dm-hero.db < scripts/test-data/insert-100-npcs.sql

-- Get campaign ID (assumes first campaign exists)
-- Get NPC entity type ID
WITH campaign AS (SELECT id FROM campaigns LIMIT 1),
     npc_type AS (SELECT id FROM entity_types WHERE name = 'NPC' LIMIT 1)

INSERT INTO entities (name, description, type_id, campaign_id, metadata, created_at, updated_at)
SELECT name, description, (SELECT id FROM npc_type), (SELECT id FROM campaign), metadata, datetime('now'), datetime('now')
FROM (VALUES
  -- Fully filled NPCs (20)
  ('Günther Müller', 'Ein alter Schmied aus Düsseldorf, der legendäre Waffen schmiedet. Bekannt für seine verschrobene Art und seine Liebe zu Met.', '{"race":"dwarf","class":"fighter","status":"alive","type":"merchant","location":"Düsseldorf Schmiede"}'),
  ('Ælfrida die Weise', 'Hochelfische Magierin mit 300 Jahren Erfahrung. Hütet das Wissen der alten Bibliothek von Thärandor.', '{"race":"highelf","class":"wizard","status":"alive","type":"ally","location":"Bibliothek Thärandor"}'),
  ('José "El Rápido" Fernández', 'Schneller Dolchkämpfer aus dem Süden. Hat eine Rechnung mit der Diebesgilde offen.', '{"race":"human","class":"rogue","status":"alive","type":"enemy","location":"Hafenviertel"}'),
  ('Brün Eisenfaust', 'Zwergischer Kleriker des Schmiedegottes Moradin. Trägt einen Hammer, der Stahl spalten kann.', '{"race":"mountaindwarf","class":"cleric","status":"alive","type":"ally","location":"Tempel des Moradin"}'),
  ('Naïve die Träumerin', 'Waldelfische Druidin, die mit Tieren spricht. Beschützt den Nebelwald vor Eindringlingen.', '{"race":"woodelf","class":"druid","status":"alive","type":"neutral","location":"Nebelwald"}'),
  ('François D''Artagnan', 'Menschlicher Adliger und Musketier. Sucht den Mörder seines Vaters.', '{"race":"human","class":"fighter","status":"alive","type":"questgiver","location":"Königspalast"}'),
  ('Ömür der Feuertänzer', 'Tiefling-Hexenmeister mit einem Pakt zur Hölle. Jongliert mit Flammen zur Unterhaltung.', '{"race":"tiefling","class":"warlock","status":"alive","type":"merchant","location":"Marktplatz"}'),
  ('Søren Sturmrufer', 'Menschlicher Barbar aus dem Norden. Kontrolliert die Winde mit seinem Schlachtschrei.', '{"race":"human","class":"barbarian","status":"alive","type":"ally","location":"Nordlande"}'),
  ('Lüdmilla von Kärnstein', 'Vampirin und Gräfin des Schattenlandes. Sammelt seltene Blutweine.', '{"race":"human","class":"sorcerer","status":"undead","type":"villain","location":"Schloss Kärnstein"}'),
  ('Çelik der Händler', 'Gnomischer Erfinder mit sprechenden Automatonen. Verkauft mechanische Kuriositäten.', '{"race":"gnome","class":"wizard","status":"alive","type":"merchant","location":"Erfinderwerkstatt"}'),
  ('Björn Bärenklaue', 'Halbork-Waldläufer mit einem zahmen Bären namens "Brumm". Führt Reisende durch die Berge.', '{"race":"halforc","class":"ranger","status":"alive","type":"ally","location":"Gebirgspass"}'),
  ('Åsa die Seherin', 'Menschliche Wahrsagerin, die in Runen liest. Ihre Prophezeiungen treffen immer ein - nur zu spät.', '{"race":"human","class":"cleric","status":"alive","type":"questgiver","location":"Runenzelt"}'),
  ('Pétur Silberzunge', 'Halblingischer Barde, der mit Liedern Kriege beendet hat. Spielt eine verzauberte Laute.', '{"race":"lightfoothalfling","class":"bard","status":"alive","type":"ally","location":"Taverne "Goldene Harfe""}'),
  ('Živa die Naturverbundene', 'Drachenblütige Druidin mit grünen Schuppen. Kann Pflanzen zum Wachsen bringen mit einem Gedanken.', '{"race":"dragonborn","class":"druid","status":"alive","type":"neutral","location":"Smaragdgarten"}'),
  ('Müslüm der Mystiker', 'Menschlicher Mönch, der Meditation lehrt. Kann auf Wasser laufen und durch Wände sehen.', '{"race":"human","class":"monk","status":"alive","type":"ally","location":"Kloster der Stille"}'),
  ('Gérard Beaumont', 'Menschlicher Paladin des Lichts. Trägt eine Rüstung, die im Dunkeln leuchtet.', '{"race":"human","class":"paladin","status":"alive","type":"ally","location":"Lichtkathedrale"}'),
  ('Özlem die Schattentänzerin', 'Halbelfische Schurkin, die Identitäten sammelt. Niemand kennt ihr wahres Gesicht.', '{"race":"halfelf","class":"rogue","status":"alive","type":"neutral","location":"Unterwelt"}'),
  ('Jürgen "Der Hammer" Hartmann', 'Zwergischer Kämpfer und Arenachampion. Hat 500 Kämpfe ohne Niederlage gewonnen.', '{"race":"hilldwarf","class":"fighter","status":"alive","type":"merchant","location":"Arena"}'),
  ('Eärendil Sternenwanderer', 'Hochelfischer Waldläufer, der Sternbilder liest. Führt Schiffe sicher durch Stürme.', '{"race":"highelf","class":"ranger","status":"alive","type":"ally","location":"Hafenturm"}'),
  ('Yüksel die Flamme', 'Tiefling-Zauberin mit roten Hörnern. Beschwört Feuerdämonen für spektakuläre Shows.', '{"race":"tiefling","class":"sorcerer","status":"alive","type":"merchant","location":"Feuerthron"}'),

  -- Medium filled NPCs (40)
  ('Bernhard von Berg', 'Alter Stadthauptmann, der sich zur Ruhe setzen will.', '{"race":"human","class":"fighter","status":"alive"}'),
  ('Elöise Lichtsang', 'Junge Klerikerin mit heilenden Händen.', '{"race":"human","class":"cleric","type":"ally"}'),
  ('Grünwald Moosbart', 'Waldläufer, der den Wald beschützt.', '{"race":"woodelf","class":"ranger","status":"alive"}'),
  ('Håkan der Starke', 'Barbar aus dem hohen Norden.', '{"race":"human","class":"barbarian"}'),
  ('Süleyman der Weise', 'Alter Gelehrter in der Akademie.', '{"race":"human","class":"wizard","type":"questgiver"}'),
  ('Løkke Trugbild', 'Illusionistin mit fragwürdiger Moral.', '{"race":"gnome","class":"wizard"}'),
  ('André Dubois', 'Französischer Fechtmeister.', '{"race":"human","class":"fighter","status":"alive"}'),
  ('Åshild Frosthauch', 'Eismagierin mit kaltem Herzen.', '{"race":"human","class":"wizard","type":"neutral"}'),
  ('Özcan der Schatten', 'Diebesgildenmeister.', '{"race":"human","class":"rogue","type":"enemy"}'),
  ('Günter Grünspan', 'Giftmischer und Alchemist.', '{"race":"gnome","class":"wizard"}'),
  ('Thérèse Bonheur', 'Glücksritterin und Kartenspielerin.', '{"race":"human","class":"rogue","status":"alive"}'),
  ('Mürsel der Händler', 'Gewürzverkäufer aus dem Osten.', '{"race":"human","type":"merchant"}'),
  ('Jörmungandr Schlangenblut', 'Schurkischer Assassine.', '{"race":"human","class":"rogue","type":"enemy"}'),
  ('Änne die Kräuterfrau', 'Heilerin im Dorf.', '{"race":"human","class":"druid","status":"alive"}'),
  ('Lütfiye die Tänzerin', 'Bauchtänzerin in der Taverne.', '{"race":"human","class":"bard"}'),
  ('Rémi Bordeaux', 'Weinverkäufer und Spion.', '{"race":"halfling","class":"rogue","type":"neutral"}'),
  ('Åke Eisenbart', 'Zwergischer Braumeister.', '{"race":"mountaindwarf","type":"merchant"}'),
  ('Çağla Mondhain', 'Elfische Priesterin.', '{"race":"highelf","class":"cleric","status":"alive"}'),
  ('Jürg der Jäger', 'Kopfgeldjäger mit 50 Kills.', '{"race":"human","class":"ranger","type":"enemy"}'),
  ('Gülsüm die Schneiderin', 'Magierin, die verzauberte Kleider näht.', '{"race":"human","class":"wizard"}'),
  ('Ömer der Schmied', 'Hersteller verzauberter Waffen.', '{"race":"dwarf","class":"fighter","type":"merchant"}'),
  ('Björk Donnerfaust', 'Kriegerin mit Blitzmagie.', '{"race":"human","class":"barbarian","status":"alive"}'),
  ('François Leroy', 'Adliger mit dunklem Geheimnis.', '{"race":"human","type":"villain"}'),
  ('Müge die Seherin', 'Wahrsagerin am Markt.', '{"race":"human","class":"wizard","type":"questgiver"}'),
  ('Ärmin der Gerechte', 'Paladin der Ordnung.', '{"race":"human","class":"paladin","status":"alive"}'),
  ('Søren Frostwolf', 'Waldläufer mit Wolfsgefährten.', '{"race":"human","class":"ranger"}'),
  ('Yücel der Flinke', 'Akrobat und Taschendieb.', '{"race":"halfling","class":"rogue","type":"enemy"}'),
  ('Élise Dumont', 'Bardin mit verzauberter Stimme.', '{"race":"human","class":"bard","status":"alive"}'),
  ('Günay Mondschein', 'Nächtliche Jägerin.', '{"race":"elf","class":"ranger"}'),
  ('Mårten der Bär', 'Großer Krieger.', '{"race":"human","class":"fighter","status":"alive"}'),
  ('Özgür der Freie', 'Ehemaliger Sklave, jetzt Freiheitskämpfer.', '{"race":"human","class":"barbarian"}'),
  ('Lüder der Alte', 'Pensionierter Abenteurer.', '{"race":"human","class":"wizard"}'),
  ('Åse Sturmtochter', 'Klerikerin des Donnergottes.', '{"race":"human","class":"cleric","status":"alive"}'),
  ('Çetin der Harte', 'Unbesiegbarer Gladiator.', '{"race":"halforc","class":"fighter"}'),
  ('Régis le Grand', 'Großer Magier der Akademie.', '{"race":"human","class":"wizard","type":"questgiver"}'),
  ('Ümit die Hoffnung', 'Klerikerin, die Hoffnung spendet.', '{"race":"human","class":"cleric"}'),
  ('Jörn Erdschütterer', 'Zwerg mit Erdbeben-Hammer.', '{"race":"mountaindwarf","class":"fighter","status":"alive"}'),
  ('Sümeyye die Geduldige', 'Mönchsmeisterin.', '{"race":"human","class":"monk"}'),
  ('André Noir', 'Meisterdieb in schwarzer Kleidung.', '{"race":"human","class":"rogue","type":"enemy"}'),
  ('Åsta Rabe', 'Hexe mit einem Rabenvertrauten.', '{"race":"human","class":"wizard","status":"alive"}'),

  -- Minimal filled NPCs (40)
  ('Bärnd', 'Wächter am Tor.', '{"race":"human"}'),
  ('Émilie', 'Barfrau.', '{}'),
  ('Öz', 'Straßenkind.', '{"status":"alive"}'),
  ('Jütte', 'Marktfrau.', '{"race":"human"}'),
  ('Søren', 'Fischer.', '{}'),
  ('Müller', 'Bäcker.', '{"type":"merchant"}'),
  ('Ås', 'Bauer.', '{"race":"human"}'),
  ('Çağ', 'Kurier.', '{}'),
  ('Lö', 'Bettler.', '{"status":"alive"}'),
  ('Bjørn', 'Jäger.', '{"race":"human"}'),
  ('Gül', 'Blumenverkäuferin.', '{}'),
  ('Jør', 'Stallbursche.', '{"race":"halfling"}'),
  ('Él', 'Straßenmusikant.', '{}'),
  ('Yük', 'Lastenträger.', '{"race":"human"}'),
  ('Änna', 'Magd.', '{}'),
  ('Rémy', 'Laufbursche.', '{"race":"human"}'),
  ('Öm', 'Händler.', '{"type":"merchant"}'),
  ('Günni', 'Wirt.', '{}'),
  ('Måns', 'Seemann.', '{"race":"human"}'),
  ('Süley', 'Wächter.', '{}'),
  ('Bern', 'Soldat.', '{"race":"human","class":"fighter"}'),
  ('Éloi', 'Mönch.', '{"class":"monk"}'),
  ('Özlem', 'Tänzerin.', '{}'),
  ('Jürgen', 'Händler.', '{"type":"merchant"}'),
  ('Åse', 'Priesterin.', '{"class":"cleric"}'),
  ('Müge', 'Wahrsagerin.', '{}'),
  ('Søs', 'Bettlerin.', '{"race":"human"}'),
  ('Çelik', 'Schmied.', '{}'),
  ('Lüd', 'Adlige.', '{"race":"human"}'),
  ('Bjørk', 'Kriegerin.', '{"class":"fighter"}'),
  ('Yüce', 'Gelehrter.', '{}'),
  ('Ärn', 'Ritter.', '{"race":"human","class":"paladin"}'),
  ('Gün', 'Dieb.', '{"class":"rogue"}'),
  ('Ömer', 'Waffenschmied.', '{"type":"merchant"}'),
  ('Jøran', 'Hirte.', '{}'),
  ('Él', 'Sänger.', '{"class":"bard"}'),
  ('Müs', 'Koch.', '{"race":"halfling"}'),
  ('Søren II', 'Prinz.', '{}'),
  ('Åke', 'Brauer.', '{"race":"dwarf"}'),
  ('Çağlar', 'Späher.', '{"class":"ranger"}')
);

-- Also insert into FTS index
INSERT INTO entities_fts(rowid, name, description, metadata)
SELECT e.id, e.name, e.description, e.metadata
FROM entities e
WHERE e.id NOT IN (SELECT rowid FROM entities_fts)
  AND e.deleted_at IS NULL;

-- Print summary
SELECT 'Inserted ' || COUNT(*) || ' NPCs successfully!' as result
FROM entities
WHERE type_id = (SELECT id FROM entity_types WHERE name = 'NPC')
  AND created_at >= datetime('now', '-1 minute');
