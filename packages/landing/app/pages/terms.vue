<template>
  <div>
    <StoreBackground />
    <v-container class="py-8 position-relative" style="max-width: 900px; z-index: 1">
      <v-card elevation="0" class="terms-card pa-6 pa-md-10">
        <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">
          {{ $t('tos.title') }}
        </h1>
        <p class="text-caption text-medium-emphasis mb-8">
          {{ $t('tos.version') }}: {{ tosVersion }} | {{ $t('tos.lastUpdated') }}: {{ $t('tos.lastUpdatedDate') }}
        </p>

        <!-- German Version -->
        <div v-if="locale === 'de'" class="terms-content">
          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">1. Geltungsbereich</h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Plattform "DM Hero - Hero Basar"
              (nachfolgend "Plattform"), betrieben von Florian Heuberger (nachfolgend "Betreiber").
              Mit der Registrierung und/oder dem Hochladen von Inhalten erklären Sie sich mit diesen AGB einverstanden.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">2. Leistungsbeschreibung</h2>
            <p>
              Die Plattform ermöglicht es registrierten Nutzern, Abenteuer-Dateien (.dmhero) für das Programm "DM Hero"
              hochzuladen, zu teilen und herunterzuladen. Die Plattform dient ausschließlich als technische
              Vermittlungsplattform zwischen Inhaltsanbietern und Nutzern.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">3. Verantwortlichkeit für Inhalte</h2>
            <v-alert type="warning" variant="tonal" class="mb-4">
              <strong>WICHTIG:</strong> Der Betreiber übernimmt keinerlei Verantwortung für hochgeladene Inhalte.
            </v-alert>
            <p class="mb-4">
              <strong>3.1</strong> Sie als Nutzer sind allein und vollumfänglich verantwortlich für alle Inhalte,
              die Sie auf der Plattform hochladen, einschließlich aber nicht beschränkt auf:
            </p>
            <ul class="mb-4 pl-6">
              <li>Texte, Geschichten und Beschreibungen</li>
              <li>Bilder, Grafiken und Illustrationen</li>
              <li>Namen, Charaktere und Handlungen</li>
              <li>Audio-Dateien und Musik</li>
              <li>Jegliche anderen in der .dmhero-Datei enthaltenen Daten</li>
            </ul>
            <p class="mb-4">
              <strong>3.2</strong> Sie garantieren, dass Ihre Inhalte:
            </p>
            <ul class="mb-4 pl-6">
              <li>Keine Rechte Dritter verletzen (Urheberrecht, Markenrecht, Persönlichkeitsrechte)</li>
              <li>Keine illegalen, beleidigenden, diskriminierenden oder anstößigen Inhalte enthalten</li>
              <li>Keine Schadsoftware, Viren oder schädlichen Code enthalten</li>
              <li>Den geltenden Gesetzen entsprechen</li>
            </ul>
            <p>
              <strong>3.3</strong> Der Betreiber prüft hochgeladene Inhalte nicht auf Rechtmäßigkeit, Richtigkeit
              oder Vollständigkeit und macht sich diese nicht zu eigen.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">4. Urheberrecht und Lizenzen</h2>
            <p class="mb-4">
              <strong>4.1</strong> Sie behalten alle Rechte an Ihren Inhalten. Mit dem Hochladen gewähren Sie
              dem Betreiber jedoch eine nicht-exklusive, weltweite, unentgeltliche Lizenz, Ihre Inhalte auf der
              Plattform zu hosten, anzuzeigen und zum Download bereitzustellen.
            </p>
            <p class="mb-4">
              <strong>4.2</strong> Sie versichern, dass Sie alle erforderlichen Rechte an den hochgeladenen
              Inhalten besitzen oder entsprechende Lizenzen haben.
            </p>
            <p>
              <strong>4.3</strong> Bei Verwendung von Inhalten Dritter (z.B. Bilder, Musik) sind Sie verpflichtet,
              die entsprechenden Lizenzbedingungen einzuhalten und ggf. erforderliche Genehmigungen einzuholen.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">5. Rechte des Betreibers</h2>
            <p class="mb-4">
              <strong>5.1</strong> Der Betreiber behält sich das Recht vor, jederzeit und ohne Angabe von Gründen:
            </p>
            <ul class="mb-4 pl-6">
              <li>Inhalte zu löschen oder zu sperren</li>
              <li>Nutzerkonten zu sperren oder zu löschen</li>
              <li>Die Plattform ganz oder teilweise einzustellen</li>
              <li>Diese AGB zu ändern</li>
            </ul>
            <p>
              <strong>5.2</strong> Bei Änderung der AGB werden Sie informiert und müssen den neuen Bedingungen
              erneut zustimmen, bevor Sie weitere Inhalte hochladen können.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">6. Haftungsausschluss</h2>
            <v-alert type="error" variant="tonal" class="mb-4">
              <strong>6.1</strong> Der Betreiber haftet nicht für:
            </v-alert>
            <ul class="mb-4 pl-6">
              <li>Inhalte, die von Nutzern hochgeladen wurden</li>
              <li>Schäden, die durch die Nutzung heruntergeladener Inhalte entstehen</li>
              <li>Urheberrechtsverletzungen oder sonstige Rechtsverstöße durch Nutzerinhalte</li>
              <li>Datenverlust oder technische Störungen</li>
              <li>Verfügbarkeit der Plattform</li>
            </ul>
            <p>
              <strong>6.2</strong> Die Haftung des Betreibers ist auf Vorsatz und grobe Fahrlässigkeit beschränkt,
              soweit gesetzlich zulässig.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">7. Freistellung</h2>
            <p>
              Sie stellen den Betreiber von sämtlichen Ansprüchen Dritter frei, die aufgrund Ihrer Inhalte oder
              Ihrer Nutzung der Plattform entstehen. Dies umfasst auch die Kosten der Rechtsverteidigung
              einschließlich Anwaltsgebühren in angemessener Höhe.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">8. Datenschutz</h2>
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer Datenschutzerklärung und den
              geltenden Datenschutzgesetzen (DSGVO).
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">9. Schlussbestimmungen</h2>
            <p class="mb-4">
              <strong>9.1</strong> Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.
            </p>
            <p class="mb-4">
              <strong>9.2</strong> Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die
              Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>
            <p>
              <strong>9.3</strong> Für Streitigkeiten ist, soweit gesetzlich zulässig, der Sitz des Betreibers
              als Gerichtsstand vereinbart.
            </p>
          </section>
        </div>

        <!-- English Version -->
        <div v-else class="terms-content">
          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">1. Scope</h2>
            <p>
              These Terms of Service (ToS) apply to the use of the platform "DM Hero - Hero Basar"
              (hereinafter "Platform"), operated by Florian Heuberger (hereinafter "Operator").
              By registering and/or uploading content, you agree to these ToS.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">2. Service Description</h2>
            <p>
              The Platform allows registered users to upload, share, and download adventure files (.dmhero)
              for the "DM Hero" application. The Platform serves exclusively as a technical intermediary
              between content providers and users.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">3. Responsibility for Content</h2>
            <v-alert type="warning" variant="tonal" class="mb-4">
              <strong>IMPORTANT:</strong> The Operator assumes no responsibility for uploaded content.
            </v-alert>
            <p class="mb-4">
              <strong>3.1</strong> You as the user are solely and fully responsible for all content
              you upload to the Platform, including but not limited to:
            </p>
            <ul class="mb-4 pl-6">
              <li>Texts, stories, and descriptions</li>
              <li>Images, graphics, and illustrations</li>
              <li>Names, characters, and plots</li>
              <li>Audio files and music</li>
              <li>Any other data contained in the .dmhero file</li>
            </ul>
            <p class="mb-4">
              <strong>3.2</strong> You warrant that your content:
            </p>
            <ul class="mb-4 pl-6">
              <li>Does not infringe any third-party rights (copyright, trademark, personality rights)</li>
              <li>Does not contain illegal, offensive, discriminatory, or objectionable content</li>
              <li>Does not contain malware, viruses, or harmful code</li>
              <li>Complies with applicable laws</li>
            </ul>
            <p>
              <strong>3.3</strong> The Operator does not review uploaded content for legality, accuracy,
              or completeness and does not adopt it as their own.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">4. Copyright and Licenses</h2>
            <p class="mb-4">
              <strong>4.1</strong> You retain all rights to your content. However, by uploading, you grant
              the Operator a non-exclusive, worldwide, royalty-free license to host, display, and make
              your content available for download on the Platform.
            </p>
            <p class="mb-4">
              <strong>4.2</strong> You warrant that you own all necessary rights to the uploaded content
              or have obtained appropriate licenses.
            </p>
            <p>
              <strong>4.3</strong> When using third-party content (e.g., images, music), you are obligated
              to comply with the respective license terms and obtain any required permissions.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">5. Rights of the Operator</h2>
            <p class="mb-4">
              <strong>5.1</strong> The Operator reserves the right, at any time and without stating reasons, to:
            </p>
            <ul class="mb-4 pl-6">
              <li>Delete or block content</li>
              <li>Suspend or delete user accounts</li>
              <li>Discontinue the Platform in whole or in part</li>
              <li>Modify these ToS</li>
            </ul>
            <p>
              <strong>5.2</strong> In case of changes to the ToS, you will be notified and must agree to
              the new terms again before you can upload further content.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">6. Disclaimer of Liability</h2>
            <v-alert type="error" variant="tonal" class="mb-4">
              <strong>6.1</strong> The Operator is not liable for:
            </v-alert>
            <ul class="mb-4 pl-6">
              <li>Content uploaded by users</li>
              <li>Damages arising from the use of downloaded content</li>
              <li>Copyright infringements or other legal violations through user content</li>
              <li>Data loss or technical malfunctions</li>
              <li>Availability of the Platform</li>
            </ul>
            <p>
              <strong>6.2</strong> The Operator's liability is limited to intent and gross negligence,
              to the extent permitted by law.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">7. Indemnification</h2>
            <p>
              You indemnify and hold the Operator harmless from all third-party claims arising from
              your content or your use of the Platform. This includes the costs of legal defense,
              including reasonable attorney's fees.
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">8. Privacy</h2>
            <p>
              The processing of personal data is carried out in accordance with our Privacy Policy
              and applicable data protection laws (GDPR).
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-h5 font-weight-bold mb-4">9. Final Provisions</h2>
            <p class="mb-4">
              <strong>9.1</strong> German law applies, excluding the UN Convention on Contracts for
              the International Sale of Goods.
            </p>
            <p class="mb-4">
              <strong>9.2</strong> If individual provisions of these ToS are invalid, the validity
              of the remaining provisions remains unaffected.
            </p>
            <p>
              <strong>9.3</strong> For disputes, the Operator's place of business is agreed as the
              place of jurisdiction, to the extent permitted by law.
            </p>
          </section>
        </div>

        <v-divider class="my-8" />

        <div class="text-center">
          <v-btn
            v-if="!isAuthenticated"
            color="primary"
            variant="flat"
            size="large"
            to="/register"
          >
            {{ $t('tos.registerNow') }}
          </v-btn>
          <v-btn
            v-else
            color="primary"
            variant="flat"
            size="large"
            to="/profile"
          >
            {{ $t('tos.backToProfile') }}
          </v-btn>
        </div>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const { isAuthenticated } = useAuth()

// Fetch current ToS version
const { data: tosData } = await useFetch('/api/tos/version')
const tosVersion = computed(() => tosData.value?.version || '1.0.0')

useSeoMeta({
  title: 'Terms of Service - DM Hero',
  description: 'Terms of Service for DM Hero - Hero Basar',
})
</script>

<style scoped>
.terms-card {
  background: rgba(var(--v-theme-surface-variant), 0.5);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.terms-content {
  line-height: 1.8;
}

.terms-content ul {
  list-style-type: disc;
}

.terms-content li {
  margin-bottom: 0.5rem;
}

.terms-content p {
  margin-bottom: 1rem;
}
</style>
