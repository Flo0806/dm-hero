<template>
  <v-card class="pa-6 mb-6">
    <div class="d-flex align-center flex-wrap ga-6">
      <div class="game-table-intro__text">
        <h1 class="text-headline-medium mb-2">
          {{ $t('gameTable.title') }}
        </h1>
        <p class="text-body-large text-medium-emphasis mb-0">
          {{ $t('gameTable.intro') }}
        </p>
      </div>
      <GameTableIntroGlow class="mx-auto" />
    </div>
  </v-card>
</template>

<style scoped>
.game-table-intro__text {
  flex: 1 1 320px;
}
</style>
