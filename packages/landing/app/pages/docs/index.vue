<script setup lang="ts">
const { t, locale } = useI18n()

// Fetch all docs using Nuxt Content v3 API
const { data: allDocs } = await useAsyncData('docs-list', () =>
  queryCollection('docs').order('stem', 'ASC').all()
)

// Filter docs based on current locale
const docs = computed(() => {
  if (!allDocs.value) return []

  const isGerman = locale.value === 'de'

  return allDocs.value.filter((doc) => {
    const isInDeFolder = doc.path.startsWith('/docs/de/')
    // German: show /docs/de/*, English: show /docs/* but not /docs/de/*
    return isGerman ? isInDeFolder : !isInDeFolder
  })
})

</script>

<template>
  <div class="docs-page">
    <v-container class="py-12">
      <v-row>
        <!-- Sidebar Navigation -->
        <v-col cols="12" md="3">
          <v-card class="docs-nav pa-4" color="surface">
            <h3 class="text-h6 font-weight-bold mb-4 gradient-text">
              {{ t('docs.title') }}
            </h3>
            <v-list nav density="compact" class="pa-0">
              <v-list-item
                v-for="doc in docs"
                :key="doc.path"
                :to="doc.path"
                color="primary"
                rounded
              >
                <v-list-item-title>{{ doc.title }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>

        <!-- Main Content -->
        <v-col cols="12" md="9">
          <v-card class="docs-content pa-8" color="surface">
            <h1 class="text-h3 font-weight-bold mb-6 gradient-text">
              {{ t('docs.welcome') }}
            </h1>
            <p class="text-body-1 text-medium-emphasis mb-8">
              {{ t('docs.intro') }}
            </p>

            <v-row>
              <v-col
                v-for="doc in docs"
                :key="doc.path"
                cols="12"
                sm="6"
              >
                <v-card
                  :to="doc.path"
                  class="docs-card pa-6 h-100"
                  color="grey-darken-4"
                  hover
                >
                  <h3 class="text-h6 font-weight-bold mb-2">
                    {{ doc.title }}
                  </h3>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ doc.description || t('docs.readMore') }}
                  </p>
                </v-card>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.docs-page {
  min-height: 100vh;
  padding-top: 64px;
}

.docs-nav {
  position: sticky;
  top: 80px;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.docs-content {
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.docs-card {
  transition: transform 0.2s ease, border-color 0.2s ease;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.docs-card:hover {
  transform: translateY(-4px);
  border-color: rgba(var(--v-theme-primary), 0.3);
}
</style>
