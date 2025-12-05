<script setup lang="ts">
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

// Fetch all docs for sidebar using Nuxt Content v3 API
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

// Compute correct path for current locale
const localizedPath = computed(() => {
  const currentPath = route.path
  const isGerman = locale.value === 'de'
  const isCurrentlyInDe = currentPath.startsWith('/docs/de/')

  if (isGerman && !isCurrentlyInDe) {
    // Switch to German: /docs/getting-started -> /docs/de/getting-started
    return currentPath.replace('/docs/', '/docs/de/')
  } else if (!isGerman && isCurrentlyInDe) {
    // Switch to English: /docs/de/getting-started -> /docs/getting-started
    return currentPath.replace('/docs/de/', '/docs/')
  }
  return currentPath
})

// Watch for locale changes and navigate to corresponding doc
watch(locale, () => {
  if (localizedPath.value !== route.path) {
    router.push(localizedPath.value)
  }
})

// Fetch current page content based on localized path
const { data: page } = await useAsyncData(
  () => `docs-${localizedPath.value}`,
  () => queryCollection('docs').path(localizedPath.value).first(),
  { watch: [localizedPath] }
)
</script>

<template>
  <div class="docs-page">
    <v-container class="py-12">
      <v-row>
        <!-- Sidebar Navigation -->
        <v-col cols="12" md="3">
          <v-card class="docs-nav pa-4" color="surface">
            <NuxtLink to="/docs" class="text-decoration-none">
              <h3 class="text-h6 font-weight-bold mb-4 gradient-text">
                {{ t('docs.title') }}
              </h3>
            </NuxtLink>
            <v-list nav density="compact" class="pa-0">
              <v-list-item
                v-for="doc in docs"
                :key="doc.path"
                :to="doc.path"
                :active="localizedPath === doc.path"
                color="primary"
                rounded
              >
                <v-list-item-title>{{ doc.title }}</v-list-item-title>
              </v-list-item>
            </v-list>

            <v-divider class="my-4" />

            <v-btn
              to="/"
              variant="text"
              color="primary"
              size="small"
              block
            >
              <v-icon start>mdi-arrow-left</v-icon>
              {{ t('docs.backToHome') }}
            </v-btn>
          </v-card>
        </v-col>

        <!-- Main Content -->
        <v-col cols="12" md="9">
          <v-card class="docs-content pa-8" color="surface">
            <ContentRenderer v-if="page" :value="page" class="docs-prose" />
            <div v-else class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
            </div>
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

/* Prose styling for markdown content */
.docs-prose :deep(h1) {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, var(--dm-gold), var(--dm-gold-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.docs-prose :deep(h2) {
  font-size: 1.75rem;
  font-weight: 600;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  color: rgb(var(--v-theme-primary));
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.2);
  padding-bottom: 0.5rem;
}

.docs-prose :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  color: rgb(var(--v-theme-on-surface));
}

.docs-prose :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

.docs-prose :deep(ul),
.docs-prose :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.docs-prose :deep(li) {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.docs-prose :deep(code) {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}

.docs-prose :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.docs-prose :deep(pre code) {
  background: none;
  padding: 0;
  color: rgb(var(--v-theme-on-surface));
}

.docs-prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.docs-prose :deep(th),
.docs-prose :deep(td) {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.docs-prose :deep(th) {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.docs-prose :deep(strong) {
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.docs-prose :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.docs-prose :deep(a:hover) {
  text-decoration: underline;
}

.docs-prose :deep(blockquote) {
  border-left: 4px solid rgb(var(--v-theme-primary));
  padding-left: 1rem;
  margin: 1rem 0;
  color: rgba(var(--v-theme-on-surface), 0.8);
  font-style: italic;
}
</style>
