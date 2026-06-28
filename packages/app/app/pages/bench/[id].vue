<script setup lang="ts">
// BENCH-ONLY synthetic page for the prerender memory stress test. Renders a bit
// of non-trivial markup so each prerendered route does real SSR work.
const route = useRoute()
const id = computed(() => route.params.id)
const rows = Array.from({ length: 40 }, (_, i) => i)
</script>

<template>
  <div class="pa-4">
    <h1>Bench route {{ id }}</h1>
    <ul>
      <li v-for="r in rows" :key="r">
        Item {{ r }} on route {{ id }} — lorem ipsum dolor sit amet consectetur.
      </li>
    </ul>
  </div>
</template>
