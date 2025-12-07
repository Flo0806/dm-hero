<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div>
        <h1 class="text-h4">{{ $t('calendar.title') }}</h1>
        <p class="text-medium-emphasis">{{ $t('calendar.subtitle') }}</p>
      </div>
      <div class="d-flex ga-2 align-center">
        <v-btn-toggle v-model="showSessions" mandatory density="compact" class="mr-2">
          <v-btn :value="true" variant="tonal" size="small">
            <v-icon start>mdi-book-open-page-variant</v-icon>
            {{ $t('calendar.sessions') }}
            <v-chip size="x-small" class="ml-1" :color="showSessions ? 'primary' : undefined">
              {{ sessions.length }}
            </v-chip>
          </v-btn>
        </v-btn-toggle>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-weather-cloudy"
          :loading="generatingWeather"
          @click="generateWeatherForMonth"
        >
          {{ $t('calendar.weather.generate') }}
        </v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-cog" @click="openSettingsDialog">
          {{ $t('calendar.settings') }}
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openNewEventDialog()">
          {{ $t('calendar.newEvent') }}
        </v-btn>
      </div>
    </div>

    <!-- Calendar not configured -->
    <v-card v-if="!isConfigured" class="pa-8 text-center">
      <v-icon size="64" color="grey">mdi-calendar-blank</v-icon>
      <h2 class="text-h5 mt-4">{{ $t('calendar.notConfigured') }}</h2>
      <p class="text-medium-emphasis mt-2">{{ $t('calendar.notConfiguredHint') }}</p>
      <v-btn color="primary" class="mt-4" @click="openSettingsDialog">
        {{ $t('calendar.setup') }}
      </v-btn>
    </v-card>

    <!-- Calendar View -->
    <template v-else>
      <!-- Current Date Display -->
      <v-card class="mb-4 pa-4">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center ga-4">
            <v-chip color="primary" size="large">
              <v-icon start>mdi-calendar-today</v-icon>
              {{ $t('calendar.today') }}: {{ currentDateFormatted }}
            </v-chip>
            <div v-for="moonPhase in currentMoonPhases" :key="moonPhase.name" class="d-flex align-center ga-2">
              <v-icon :color="getMoonColor(moonPhase.name)">{{ getMoonIconForPhase(moonPhase.phaseIndex) }}</v-icon>
              <span class="text-body-2">{{ moonPhase.name }}: {{ moonPhase.phase }}</span>
            </div>
          </div>
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-skip-next"
            :loading="advancingDay"
            @click="advanceDay"
          >
            {{ $t('calendar.advanceDay') }}
          </v-btn>
        </div>
      </v-card>

      <!-- Month Navigation -->
      <v-card class="mb-4 calendar-card">
        <!-- Season Background Image -->
        <div
          v-if="seasonBackgroundUrl"
          class="season-background"
          :style="{ backgroundImage: `url(${seasonBackgroundUrl})` }"
        />
        <v-card-title class="d-flex align-center justify-space-between">
          <v-btn icon="mdi-chevron-left" variant="text" @click="prevMonth" />
          <div class="text-center">
            <span class="text-h5">{{ currentMonthName }}</span>
            <div class="d-flex align-center justify-center ga-2 mt-1">
              <v-btn icon="mdi-chevron-left" size="x-small" variant="text" @click="prevYear" />
              <span class="text-body-1">
                {{ $t('calendar.year') }} {{ viewYear }}
                <span v-if="calendarConfig.config.era_name">{{ calendarConfig.config.era_name }}</span>
              </span>
              <v-chip v-if="isLeapYear(viewYear)" size="x-small" color="info" class="ml-1">
                {{ $t('calendar.isLeapYear') }}
              </v-chip>
              <v-btn icon="mdi-chevron-right" size="x-small" variant="text" @click="nextYear" />
            </div>
          </div>
          <v-btn icon="mdi-chevron-right" variant="text" @click="nextMonth" />
        </v-card-title>

        <!-- Weekday Headers -->
        <v-card-text class="pa-2">
          <div class="calendar-grid" :style="calendarGridStyle">
            <div
              v-for="weekday in calendarConfig.weekdays"
              :key="weekday.id"
              class="calendar-header text-center text-caption font-weight-bold py-2"
            >
              {{ weekday.name }}
            </div>

            <!-- Empty cells before first day -->
            <div
              v-for="n in getFirstDayOffset()"
              :key="'empty-' + n"
              class="calendar-day empty"
            />

            <!-- Days -->
            <div
              v-for="day in currentMonthDays"
              :key="day"
              class="calendar-day"
              :class="{
                'is-today': isToday(day),
                'is-selected': selectedDay === day,
                'has-events': getEventsForDay(day).length > 0,
                'has-sessions': dayHasSessions(day),
              }"
              @click="selectDay(day)"
            >
              <div class="d-flex justify-space-between align-start">
                <div class="day-number">{{ day }}</div>
                <div class="d-flex align-center ga-1">
                  <!-- Weather Icon -->
                  <v-tooltip v-if="getWeatherForDay(day)" location="top">
                    <template #activator="{ props: weatherProps }">
                      <v-icon
                        v-bind="weatherProps"
                        size="16"
                        :color="getWeatherForDay(day)?.weather_type === 'sunny' ? 'amber' : 'blue-grey'"
                      >
                        {{ getWeatherIcon(getWeatherForDay(day)!.weather_type) }}
                      </v-icon>
                    </template>
                    <div>
                      {{ $t('calendar.weather.types.' + getWeatherForDay(day)!.weather_type) }}
                      <span v-if="getWeatherForDay(day)!.temperature !== null">
                        ({{ getWeatherForDay(day)!.temperature }}°C)
                      </span>
                    </div>
                  </v-tooltip>
                  <!-- Moon Phases -->
                  <div v-if="calendarConfig.moons.length > 0" class="moon-phase">
                    <v-icon
                      v-for="moonPhase in getMoonPhasesForDay(day)"
                      :key="moonPhase.name"
                      size="14"
                      :color="getMoonColor(moonPhase.name)"
                      :title="moonPhase.name + ': ' + moonPhase.phase"
                    >
                      {{ getMoonIconForPhase(moonPhase.phaseIndex) }}
                    </v-icon>
                  </div>
                </div>
              </div>

              <!-- Sessions (shown before events) -->
              <div v-if="getSessionsForDay(day).length > 0" class="day-sessions">
                <v-tooltip
                  v-for="session in getSessionsForDay(day).slice(0, 2)"
                  :key="'session-' + session.id"
                  location="top"
                >
                  <template #activator="{ props: tooltipProps }">
                    <div
                      v-bind="tooltipProps"
                      class="session-item"
                      :class="{
                        'session-start': session.isStart,
                        'session-end': session.isEnd,
                        'session-continuation': session.isContinuation && !session.isEnd,
                        'session-single': session.isStart && session.isEnd,
                      }"
                      @click.stop="goToSession(session)"
                    >
                      <v-icon v-if="session.isStart" size="10" class="mr-1">mdi-book-open-page-variant</v-icon>
                      <v-icon v-else size="10" class="mr-1">mdi-arrow-right</v-icon>
                      <span class="session-title">
                        <template v-if="session.isStart">
                          #{{ session.session_number }} {{ session.title }}
                        </template>
                        <template v-else>
                          {{ $t('calendar.sessionContinues', { number: session.session_number }) }}
                        </template>
                      </span>
                    </div>
                  </template>
                  <div style="max-width: 300px">
                    <div class="d-flex align-center ga-2 mb-1">
                      <v-chip size="x-small" color="blue">
                        #{{ session.session_number }}
                      </v-chip>
                      <strong>{{ session.title }}</strong>
                    </div>
                    <div v-if="session.summary" class="text-caption mb-1">
                      {{ session.summary.slice(0, 150) }}{{ session.summary.length > 150 ? '...' : '' }}
                    </div>
                    <div class="d-flex ga-2 text-caption">
                      <span v-if="session.attendance_count > 0">
                        <v-icon size="12">mdi-account-group</v-icon> {{ session.attendance_count }}
                      </span>
                      <span v-if="session.duration_minutes">
                        <v-icon size="12">mdi-clock</v-icon> {{ Math.floor(session.duration_minutes / 60) }}h
                      </span>
                      <span v-if="session.date">
                        <v-icon size="12">mdi-calendar</v-icon> {{ session.date }}
                      </span>
                    </div>
                    <div v-if="!session.isStart && !session.isEnd" class="text-caption mt-1 text-warning">
                      {{ $t('calendar.multiDaySession') }}
                    </div>
                  </div>
                </v-tooltip>
                <div
                  v-if="getSessionsForDay(day).length > 2"
                  class="session-more text-caption text-medium-emphasis"
                >
                  +{{ getSessionsForDay(day).length - 2 }} {{ $t('calendar.sessions').toLowerCase() }}
                </div>
              </div>

              <!-- Events -->
              <div v-if="getEventsForDay(day).length > 0" class="day-events">
                <v-tooltip
                  v-for="event in getEventsForDay(day).slice(0, 3)"
                  :key="event.id"
                  location="top"
                >
                  <template #activator="{ props }">
                    <div
                      v-bind="props"
                      class="event-item"
                      :style="{ borderLeftColor: event.color || getEventTypeColor(event.event_type) }"
                    >
                      <v-icon size="10" class="mr-1">{{ getEventTypeIcon(event.event_type) }}</v-icon>
                      <span class="event-title">{{ event.title }}</span>
                      <v-icon v-if="event.is_recurring" size="10" class="ml-1">mdi-sync</v-icon>
                    </div>
                  </template>
                  <div>
                    <strong>{{ event.title }}</strong>
                    <div class="text-caption">{{ $t('calendar.eventTypes.' + event.event_type) }}</div>
                    <div v-if="event.entity_name" class="text-caption">{{ event.entity_name }}</div>
                  </div>
                </v-tooltip>
                <div
                  v-if="getEventsForDay(day).length > 3"
                  class="event-more text-caption text-medium-emphasis"
                >
                  +{{ getEventsForDay(day).length - 3 }} {{ $t('calendar.events').toLowerCase() }}
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Details for selected day -->
      <v-card v-if="selectedDay">
        <v-card-title class="d-flex align-center justify-space-between">
          <div class="d-flex align-center ga-2">
            <span>{{ selectedDay }}. {{ currentMonthName }} {{ viewYear }}</span>
            <v-chip v-if="isSelectedDayToday" color="primary" size="small">
              {{ $t('calendar.today') }}
            </v-chip>
            <!-- Weather chip for selected day (clickable to edit) -->
            <v-tooltip location="top">
              <template #activator="{ props: weatherTooltipProps }">
                <v-chip
                  v-if="selectedDay && getWeatherForDay(selectedDay)"
                  v-bind="weatherTooltipProps"
                  size="small"
                  :color="getWeatherForDay(selectedDay)?.weather_type === 'sunny' ? 'amber' : 'blue-grey'"
                  variant="tonal"
                  class="cursor-pointer"
                  @click="openWeatherDialog(selectedDay)"
                >
                  <v-icon start size="16">{{ getWeatherIcon(getWeatherForDay(selectedDay)!.weather_type) }}</v-icon>
                  {{ $t('calendar.weather.types.' + getWeatherForDay(selectedDay)!.weather_type) }}
                  <span v-if="getWeatherForDay(selectedDay)!.temperature !== null" class="ml-1">
                    ({{ getWeatherForDay(selectedDay)!.temperature }}°C)
                  </span>
                </v-chip>
                <v-chip
                  v-else-if="selectedDay"
                  v-bind="weatherTooltipProps"
                  size="small"
                  variant="outlined"
                  class="cursor-pointer"
                  @click="openWeatherDialog(selectedDay)"
                >
                  <v-icon start size="16">mdi-weather-cloudy</v-icon>
                  {{ $t('calendar.weather.noWeather') }}
                </v-chip>
              </template>
              {{ $t('calendar.weather.editWeather') }}
            </v-tooltip>
          </div>
          <div class="d-flex ga-2">
            <v-btn
              v-if="!isSelectedDayToday"
              size="small"
              variant="tonal"
              color="warning"
              prepend-icon="mdi-calendar-today"
              @click="showSetTodayDialog = true"
            >
              {{ $t('calendar.setAsToday') }}
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              color="blue"
              prepend-icon="mdi-book-plus"
              @click="createSessionOnDay(selectedDay)"
            >
              {{ $t('calendar.newSession') }}
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-plus"
              @click="openNewEventDialog(selectedDay)"
            >
              {{ $t('calendar.newEvent') }}
            </v-btn>
          </div>
        </v-card-title>
        <v-card-text>
          <!-- Sessions for selected day -->
          <div v-if="selectedDaySessions.length > 0" class="mb-4">
            <div class="text-overline text-medium-emphasis mb-2">
              <v-icon size="16" class="mr-1">mdi-book-open-page-variant</v-icon>
              {{ $t('calendar.sessions') }} ({{ selectedDaySessions.length }})
            </div>
            <v-list density="compact">
              <v-list-item
                v-for="session in selectedDaySessions"
                :key="'selected-session-' + session.id"
                :class="{ 'session-continuation-item': session.isContinuation }"
                @click="goToSession(session)"
              >
                <template #prepend>
                  <v-avatar color="blue" size="40">
                    <span class="text-white font-weight-bold">#{{ session.session_number }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title>
                  {{ session.title }}
                  <v-chip v-if="session.isContinuation && !session.isStart" size="x-small" class="ml-2" color="info">
                    {{ $t('calendar.continues') }}
                  </v-chip>
                  <v-chip v-if="session.isEnd && !session.isStart" size="x-small" class="ml-1" color="success">
                    {{ $t('calendar.ends') }}
                  </v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>
                  <span v-if="session.summary">{{ session.summary.slice(0, 80) }}{{ session.summary.length > 80 ? '...' : '' }}</span>
                  <span v-else class="text-disabled font-italic">{{ $t('common.noDescription') }}</span>
                </v-list-item-subtitle>
                <template #append>
                  <div class="d-flex align-center ga-2">
                    <v-chip v-if="session.attendance_count > 0" size="x-small" variant="tonal">
                      <v-icon start size="12">mdi-account-group</v-icon>
                      {{ session.attendance_count }}
                    </v-chip>
                    <v-chip v-if="session.duration_minutes" size="x-small" variant="tonal">
                      <v-icon start size="12">mdi-clock</v-icon>
                      {{ Math.floor(session.duration_minutes / 60) }}h
                    </v-chip>
                    <v-btn icon="mdi-chevron-right" variant="text" size="small" />
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </div>

          <!-- Events for selected day -->
          <div v-if="selectedDayEvents.length > 0">
            <div class="text-overline text-medium-emphasis mb-2">
              <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
              {{ $t('calendar.events') }} ({{ selectedDayEvents.length }})
            </div>
            <v-list density="compact">
              <v-list-item
                v-for="event in selectedDayEvents"
                :key="event.id"
                @click="editEvent(event)"
              >
                <template #prepend>
                  <v-avatar :color="event.color || getEventTypeColor(event.event_type)" size="40">
                    <v-icon color="white">{{ getEventTypeIcon(event.event_type) }}</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title>{{ event.title }}</v-list-item-title>
                <v-list-item-subtitle>
                  <span>{{ $t('calendar.eventTypes.' + event.event_type) }}</span>
                  <v-chip v-if="event.is_recurring" size="x-small" class="ml-2">
                    {{ $t('calendar.isRecurring') }}
                  </v-chip>
                </v-list-item-subtitle>
                <!-- Linked entities as chips -->
                <div v-if="event.linked_entities && event.linked_entities.length > 0" class="mt-1 d-flex flex-wrap ga-1">
                  <v-chip
                    v-for="le in event.linked_entities"
                    :key="le.id"
                    size="x-small"
                    :color="getEntityColor(le.entity_type)"
                    :class="{ 'text-decoration-line-through': le.entity_deleted }"
                    @click.stop="navigateToEntity(le.entity_type, le.entity_id)"
                  >
                    <v-icon start size="x-small">{{ getEntityIcon(le.entity_type) }}</v-icon>
                    {{ le.entity_name }}
                  </v-chip>
                </div>
                <template #append>
                  <v-btn icon="mdi-delete" variant="text" color="error" @click.stop="deleteEvent(event)" />
                </template>
              </v-list-item>
            </v-list>
          </div>

          <!-- Empty state -->
          <div v-if="selectedDayEvents.length === 0 && selectedDaySessions.length === 0" class="text-center text-medium-emphasis py-4">
            {{ $t('calendar.noEvents') }}
          </div>
        </v-card-text>
      </v-card>
    </template>

    <!-- Settings Dialog -->
    <CalendarSettingsDialog
      v-model="showSettingsDialog"
      v-model:form="settingsForm"
      v-model:seasons="editingSeasons"
      :saving="saving"
      @save="saveSettings"
    />

    <!-- Event Dialog -->
    <CalendarEventDialog
      v-model="showEventDialog"
      :form="eventForm"
      :is-editing="!!editingEvent"
      :saving="savingEvent"
      :month-options="calendarConfig.months.map((m, i) => ({ title: m.name, value: i + 1 }))"
      :entity-options="entityOptions"
      @save="saveEvent"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="error">mdi-alert-circle</v-icon>
          {{ $t('calendar.deleteEvent') }}
        </v-card-title>
        <v-card-text>
          <p>{{ $t('calendar.deleteEventConfirm') }}</p>
          <v-card v-if="eventToDelete" variant="tonal" class="mt-3 pa-3">
            <div class="d-flex align-center ga-3">
              <v-avatar :color="eventToDelete.color || getEventTypeColor(eventToDelete.event_type)" size="40">
                <v-icon color="white">{{ getEventTypeIcon(eventToDelete.event_type) }}</v-icon>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ eventToDelete.title }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ eventToDelete.day }}. {{ calendarConfig.months[eventToDelete.month - 1]?.name }}
                  <span v-if="!eventToDelete.is_recurring"> {{ eventToDelete.year }}</span>
                  <v-chip v-if="eventToDelete.is_recurring" size="x-small" class="ml-1">
                    {{ $t('calendar.isRecurring') }}
                  </v-chip>
                </div>
              </div>
            </div>
          </v-card>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDeleteEvent">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Calendar Structure Change Warning Dialog -->
    <v-dialog v-model="showStructureWarning" max-width="600" persistent>
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="warning">mdi-alert</v-icon>
          {{ $t('calendar.structureChangeWarning') }}
        </v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" class="mb-4">
            {{ $t('calendar.structureChangeInfo') }}
          </v-alert>

          <!-- Affected Events -->
          <div v-if="validationResult?.affectedEvents.length" class="mb-4">
            <div class="text-subtitle-2 mb-2">
              <v-icon size="18" class="mr-1">mdi-calendar</v-icon>
              {{ $t('calendar.affectedEvents', { count: validationResult.affectedEvents.length }) }}
            </div>
            <v-list density="compact" class="bg-surface-variant rounded">
              <v-list-item v-for="evt in validationResult.affectedEvents.slice(0, 5)" :key="evt.id">
                <template #prepend>
                  <v-icon size="small" color="warning">mdi-calendar-alert</v-icon>
                </template>
                <v-list-item-title>{{ evt.title }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ evt.issue === 'month_deleted' ? $t('calendar.monthDeleted') : $t('calendar.dayOverflow') }}
                  ({{ $t('calendar.month') }} {{ evt.month }}, {{ $t('calendar.day') }} {{ evt.day }})
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="validationResult.affectedEvents.length > 5">
                <v-list-item-title class="text-medium-emphasis">
                  ... {{ $t('calendar.andMore', { count: validationResult.affectedEvents.length - 5 }) }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ $t('calendar.eventsWillBeMoved') }}
            </div>
          </div>

          <!-- Affected Sessions -->
          <div v-if="validationResult?.affectedSessions.length">
            <div class="text-subtitle-2 mb-2">
              <v-icon size="18" class="mr-1">mdi-book-open-page-variant</v-icon>
              {{ $t('calendar.affectedSessions', { count: validationResult.affectedSessions.length }) }}
            </div>
            <v-list density="compact" class="bg-surface-variant rounded">
              <v-list-item v-for="sess in validationResult.affectedSessions.slice(0, 5)" :key="sess.id">
                <template #prepend>
                  <v-icon size="small" color="warning">mdi-book-alert</v-icon>
                </template>
                <v-list-item-title>
                  {{ sess.session_number ? `#${sess.session_number}: ` : '' }}{{ sess.title }}
                </v-list-item-title>
                <v-list-item-subtitle>{{ $t('calendar.sessionDayOverflow') }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="validationResult.affectedSessions.length > 5">
                <v-list-item-title class="text-medium-emphasis">
                  ... {{ $t('calendar.andMore', { count: validationResult.affectedSessions.length - 5 }) }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ $t('calendar.sessionsWillBeReset') }}
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="cancelStructureChange">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="warning" :loading="saving" @click="confirmStructureChange">
            {{ $t('calendar.saveAnyway') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Set as Today Confirmation Dialog -->
    <v-dialog v-model="showSetTodayDialog" max-width="450">
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="warning">mdi-calendar-today</v-icon>
          {{ $t('calendar.setAsToday') }}
        </v-card-title>
        <v-card-text>
          <p class="mb-3">{{ $t('calendar.setAsTodayConfirm', { date: `${selectedDay}. ${currentMonthName} ${viewYear}` }) }}</p>

          <v-alert v-if="isSelectedDayInPast" type="warning" variant="tonal" class="mb-0">
            <strong>{{ $t('calendar.goingBackInTime') }}</strong><br/>
            {{ $t('calendar.goingBackInTimeHint') }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSetTodayDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="warning" :loading="settingToday" @click="confirmSetAsToday">
            {{ $t('calendar.confirmSetAsToday') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Weather Edit Dialog -->
    <CalendarWeatherDialog
      v-model:show="showWeatherDialog"
      :campaign-id="campaignStore.activeCampaignId || 0"
      :year="viewYear"
      :month="viewMonth"
      :day="weatherDialogDay || 1"
      :month-name="currentMonthName"
      :weather="weatherDialogDay ? getWeatherForDay(weatherDialogDay) : null"
      @saved="onWeatherSaved"
      @cleared="onWeatherCleared"
    />
  </div>
</template>

<script setup lang="ts">
import type { CalendarSeason } from '~~/types/calendar'
import { useSnackbarStore } from '~/stores/snackbar'

interface CalendarMonth {
  id?: number
  name: string
  days: number
  sort_order: number
}

interface CalendarWeekday {
  id?: number
  name: string
  sort_order: number
}

interface CalendarMoon {
  id?: number
  name: string
  cycle_days: number
  full_moon_duration: number
  new_moon_duration: number
  phase_offset: number
}

interface LinkedEntity {
  id: number
  event_id: number
  entity_id: number
  entity_type: string | null
  entity_name: string
  entity_deleted: boolean
}

interface CalendarEvent {
  id: number
  campaign_id: number
  title: string
  description: string | null
  event_type: string
  year: number | null
  month: number
  day: number
  is_recurring: number
  entity_id: number | null
  color: string | null
  entity_name?: string
  entity_type?: string
  linked_entities?: LinkedEntity[]
}

interface CalendarSession {
  id: number
  session_number: number | null
  title: string
  summary: string | null
  in_game_day_start: number | null
  in_game_day_end: number | null
  date: string | null
  duration_minutes: number | null
  attendance_count: number
  mentions_count: number
}

interface CalendarConfig {
  config: {
    current_year: number
    current_month: number
    current_day: number
    era_name: string
    leap_year_interval: number
    leap_year_month: number
    leap_year_extra_days: number
  }
  months: CalendarMonth[]
  weekdays: CalendarWeekday[]
  moons: CalendarMoon[]
}

const { t } = useI18n()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

// State
const calendarConfig = ref<CalendarConfig>({
  config: {
    current_year: 1,
    current_month: 1,
    current_day: 1,
    era_name: '',
    leap_year_interval: 0,
    leap_year_month: 1,
    leap_year_extra_days: 1,
  },
  months: [],
  weekdays: [],
  moons: [],
})
const events = ref<CalendarEvent[]>([])
const sessions = ref<CalendarSession[]>([])
const seasons = ref<CalendarSeason[]>([])

// Weather
interface CalendarWeather {
  id: number
  campaign_id: number
  year: number
  month: number
  day: number
  weather_type: string
  temperature: number | null
  notes: string | null
}
const weather = ref<Map<number, CalendarWeather>>(new Map()) // day -> weather
const generatingWeather = ref(false)
const showWeatherDialog = ref(false)
const weatherDialogDay = ref<number | null>(null)
const editingSeasons = ref<CalendarSeason[]>([])
const showSessions = ref(true) // Toggle for session visibility
const viewYear = ref(1)
const viewMonth = ref(1)
const selectedDay = ref<number | null>(null)
const showSettingsDialog = ref(false)
const showEventDialog = ref(false)
const showDeleteDialog = ref(false)
const saving = ref(false)
const savingEvent = ref(false)
const deleting = ref(false)
const advancingDay = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)
const eventToDelete = ref<CalendarEvent | null>(null)
const showStructureWarning = ref(false)
const showSetTodayDialog = ref(false)
const settingToday = ref(false)
const validationResult = ref<{
  hasIssues: boolean
  affectedEvents: Array<{ id: number; title: string; month: number; day: number; issue: string }>
  affectedSessions: Array<{ id: number; title: string; session_number: number | null; issue: string }>
} | null>(null)
const router = useRouter()

// Settings form
const settingsForm = ref({
  currentYear: 1,
  currentMonth: 1,
  currentDay: 1,
  eraName: '',
  leapYearInterval: 0,
  leapYearMonth: 1,
  leapYearExtraDays: 1,
  months: [] as CalendarMonth[],
  weekdays: [] as CalendarWeekday[],
  moons: [] as CalendarMoon[],
})

// Event form
const eventForm = ref({
  title: '',
  description: '',
  eventType: 'custom',
  day: 1,
  month: 1,
  year: 1,
  isRecurring: false,
  entityId: null as number | null, // Legacy
  entityIds: [] as number[], // New multi-entity
})

// Entity options for linking
const entityOptions = ref<Array<{ id: number; name: string; type: string }>>([])

// Computed
const isConfigured = computed(() => calendarConfig.value.months.length > 0)

const currentMonthName = computed(() => {
  const month = calendarConfig.value.months[viewMonth.value - 1]
  return month?.name || ''
})

const currentMonthDays = computed(() => {
  return getDaysInMonth(viewMonth.value, viewYear.value)
})

const currentDateFormatted = computed(() => {
  const config = calendarConfig.value.config
  const month = calendarConfig.value.months[config.current_month - 1]
  return `${config.current_day}. ${month?.name || ''} ${config.current_year}`
})

const selectedDayEvents = computed(() => {
  if (!selectedDay.value) return []
  return getEventsForDay(selectedDay.value)
})

const selectedDaySessions = computed(() => {
  if (!selectedDay.value) return []
  return getSessionsForDay(selectedDay.value)
})

// Get moon phases for current date (shown in header)
const currentMoonPhases = computed(() => {
  if (calendarConfig.value.moons.length === 0) return []
  const config = calendarConfig.value.config
  const totalDays = getTotalDays(config.current_year, config.current_month, config.current_day)

  const phases: Array<{ name: string; phase: string; phaseIndex: number }> = []
  for (const moon of calendarConfig.value.moons) {
    const dayInCycle = (totalDays + (moon.phase_offset || 0)) % moon.cycle_days
    const { phaseName, phaseIndex } = calculateMoonPhase(dayInCycle, moon)
    phases.push({ name: moon.name, phase: phaseName, phaseIndex })
  }
  return phases
})

// Dynamic grid style based on weekdays count
const calendarGridStyle = computed(() => {
  const weekdaysCount = calendarConfig.value.weekdays.length || 7
  return {
    gridTemplateColumns: `repeat(${weekdaysCount}, 1fr)`,
  }
})

// Get current season based on viewed month/day
const currentSeason = computed(() => {
  if (seasons.value.length === 0) return null

  // Sort seasons by start date (month, then day)
  const sortedSeasons = [...seasons.value].sort((a, b) => {
    if (a.start_month !== b.start_month) return a.start_month - b.start_month
    return a.start_day - b.start_day
  })

  // Find which season we're currently in (based on view month)
  // We need to find the season whose start date is <= current view date
  let activeSeason = sortedSeasons[sortedSeasons.length - 1] // Default to last season (wraps from previous year)

  for (let i = 0; i < sortedSeasons.length; i++) {
    const season = sortedSeasons[i]
    if (!season) continue
    // Check if current month/day is >= this season's start
    if (viewMonth.value > season.start_month ||
        (viewMonth.value === season.start_month && 15 >= season.start_day)) {
      activeSeason = season
    }
  }

  return activeSeason
})

// Season background image URL
const seasonBackgroundUrl = computed(() => {
  const season = currentSeason.value
  if (!season?.background_image) return null
  return season.background_image
})

// Functions
function getTotalDays(year: number, month: number, day: number): number {
  let total = 0

  // Add days for complete years (accounting for leap years)
  for (let y = 1; y < year; y++) {
    total += getDaysInYear(y)
  }

  // Add days for complete months in current year (accounting for leap years)
  for (let i = 0; i < month - 1; i++) {
    total += getDaysInMonthWithLeap(year, i)
  }

  total += day
  return total
}

// Get total days in a year (accounting for leap years)
function getDaysInYear(year: number): number {
  let totalDays = calendarConfig.value.months.reduce((sum, m) => sum + m.days, 0)
  if (isLeapYear(year)) {
    totalDays += calendarConfig.value.config.leap_year_extra_days
  }
  return totalDays
}

// Get days in a specific month (accounting for leap years)
function getDaysInMonthWithLeap(year: number, monthIndex: number): number {
  const month = calendarConfig.value.months[monthIndex]
  if (!month) return 30
  let days = month.days
  // Add leap year extra days to the designated month
  if (isLeapYear(year) && calendarConfig.value.config.leap_year_month - 1 === monthIndex) {
    days += calendarConfig.value.config.leap_year_extra_days
  }
  return days
}

function getFirstDayOffset(): number {
  if (calendarConfig.value.weekdays.length === 0) return 0
  const totalDays = getTotalDays(viewYear.value, viewMonth.value, 1) - 1
  return totalDays % calendarConfig.value.weekdays.length
}

function isToday(day: number): boolean {
  const config = calendarConfig.value.config
  return (
    viewYear.value === config.current_year &&
    viewMonth.value === config.current_month &&
    day === config.current_day
  )
}

// Check if the selected day is the current "today"
const isSelectedDayToday = computed(() => {
  if (!selectedDay.value) return false
  return isToday(selectedDay.value)
})

// Check if selected day is in the past compared to current "today"
const isSelectedDayInPast = computed(() => {
  if (!selectedDay.value) return false
  const config = calendarConfig.value.config
  const selectedAbsoluteDay = getTotalDays(viewYear.value, viewMonth.value, selectedDay.value)
  const todayAbsoluteDay = getTotalDays(config.current_year, config.current_month, config.current_day)
  return selectedAbsoluteDay < todayAbsoluteDay
})

// Set selected day as the new "today"
async function confirmSetAsToday() {
  if (!selectedDay.value) return

  settingToday.value = true
  try {
    await $fetch('/api/calendar/config', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        currentYear: viewYear.value,
        currentMonth: viewMonth.value,
        currentDay: selectedDay.value,
        // Keep other settings
        yearZeroName: 'Jahr 0',
        eraName: calendarConfig.value.config.era_name,
        leapYearInterval: calendarConfig.value.config.leap_year_interval,
        leapYearMonth: calendarConfig.value.config.leap_year_month,
        leapYearExtraDays: calendarConfig.value.config.leap_year_extra_days,
        months: calendarConfig.value.months,
        weekdays: calendarConfig.value.weekdays,
        moons: calendarConfig.value.moons,
      },
    })
    await loadConfig()
    showSetTodayDialog.value = false
    snackbarStore.success(t('calendar.todaySet'))
  } catch (error) {
    console.error('Failed to set today:', error)
    snackbarStore.error(String(error))
  } finally {
    settingToday.value = false
  }
}

function getEventsForDay(day: number): CalendarEvent[] {
  return events.value.filter((e) => {
    if (e.month !== viewMonth.value || e.day !== day) return false
    if (e.is_recurring) return true
    return e.year === viewYear.value
  })
}

// Get sessions that are active on a specific day (supports multi-day sessions)
function getSessionsForDay(day: number): Array<CalendarSession & { isStart: boolean; isEnd: boolean; isContinuation: boolean }> {
  if (!showSessions.value) return []

  const absoluteDay = getTotalDays(viewYear.value, viewMonth.value, day)

  return sessions.value
    .filter((s) => {
      if (s.in_game_day_start === null) return false
      const endDay = s.in_game_day_end ?? s.in_game_day_start
      return absoluteDay >= s.in_game_day_start && absoluteDay <= endDay
    })
    .map((s) => ({
      ...s,
      isStart: s.in_game_day_start === absoluteDay,
      isEnd: (s.in_game_day_end ?? s.in_game_day_start) === absoluteDay,
      isContinuation: s.in_game_day_start !== null && s.in_game_day_start < absoluteDay,
    }))
    .sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0))
}

// Check if day has any sessions
function dayHasSessions(day: number): boolean {
  return getSessionsForDay(day).length > 0
}

// Navigate to session page
function goToSession(session: CalendarSession) {
  router.push(`/sessions?highlight=${session.id}`)
}

// Create new session on selected day
function createSessionOnDay(day: number) {
  const absoluteDay = getTotalDays(viewYear.value, viewMonth.value, day)
  router.push(`/sessions?newSession=true&inGameDay=${absoluteDay}`)
}

function getEventTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    custom: 'mdi-calendar',
    birthday: 'mdi-cake',
    death: 'mdi-skull',
    holiday: 'mdi-party-popper',
    session: 'mdi-book-open-page-variant',
    festival: 'mdi-firework',
    war: 'mdi-sword-cross',
    founding: 'mdi-castle',
  }
  return icons[type] || 'mdi-calendar'
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    custom: 'grey',
    birthday: 'pink',
    death: 'red-darken-4',
    holiday: 'green',
    session: 'blue',
    festival: 'orange',
    war: 'red',
    founding: 'purple',
  }
  return colors[type] || 'grey'
}

// Entity type helpers for linked entities display
function getEntityColor(type: string | null): string {
  const colors: Record<string, string> = {
    NPC: 'blue',
    Location: 'green',
    Item: 'amber',
    Faction: 'purple',
    Lore: 'teal',
    Player: 'orange',
  }
  return colors[type || ''] || 'grey'
}

function getEntityIcon(type: string | null): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Location: 'mdi-map-marker',
    Item: 'mdi-treasure-chest',
    Faction: 'mdi-flag',
    Lore: 'mdi-book-open-variant',
    Player: 'mdi-account-group',
  }
  return icons[type || ''] || 'mdi-help-circle'
}

function navigateToEntity(type: string | null, entityId: number) {
  if (!type) return
  const routes: Record<string, string> = {
    NPC: '/npcs',
    Location: '/locations',
    Item: '/items',
    Faction: '/factions',
    Lore: '/lore',
    Player: '/players',
  }
  const basePath = routes[type]
  if (basePath) {
    router.push(`${basePath}/${entityId}`)
  }
}

// Check if year is leap year
function isLeapYear(year: number): boolean {
  const interval = calendarConfig.value.config.leap_year_interval
  if (!interval || interval <= 0) return false
  return year % interval === 0
}

// Calculate moon phase based on day in cycle and moon configuration
function calculateMoonPhase(dayInCycle: number, moon: CalendarMoon): { phaseName: string; phaseIndex: number } {
  const cycle = moon.cycle_days
  const newMoonDays = moon.new_moon_duration || 1
  const fullMoonDays = moon.full_moon_duration || 1

  // Remaining days for the 6 transitional phases
  const remainingDays = cycle - newMoonDays - fullMoonDays
  const transitionPhaseDays = remainingDays / 6

  // Calculate boundaries for each phase
  // Phase order: New Moon -> Waxing Crescent -> First Quarter -> Waxing Gibbous -> Full Moon -> Waning Gibbous -> Last Quarter -> Waning Crescent -> (back to New Moon)
  const boundaries = [
    newMoonDays, // End of New Moon
    newMoonDays + transitionPhaseDays, // End of Waxing Crescent
    newMoonDays + transitionPhaseDays * 2, // End of First Quarter
    newMoonDays + transitionPhaseDays * 3, // End of Waxing Gibbous
    newMoonDays + transitionPhaseDays * 3 + fullMoonDays, // End of Full Moon
    newMoonDays + transitionPhaseDays * 4 + fullMoonDays, // End of Waning Gibbous
    newMoonDays + transitionPhaseDays * 5 + fullMoonDays, // End of Last Quarter
    cycle, // End of Waning Crescent (back to New Moon)
  ]

  const phaseNames = [
    t('calendar.moonPhases.new'),
    t('calendar.moonPhases.waxingCrescent'),
    t('calendar.moonPhases.firstQuarter'),
    t('calendar.moonPhases.waxingGibbous'),
    t('calendar.moonPhases.full'),
    t('calendar.moonPhases.waningGibbous'),
    t('calendar.moonPhases.lastQuarter'),
    t('calendar.moonPhases.waningCrescent'),
  ]

  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i]
    if (boundary !== undefined && dayInCycle < boundary) {
      return { phaseName: phaseNames[i] ?? phaseNames[0] ?? '', phaseIndex: i }
    }
  }

  return { phaseName: phaseNames[0] ?? '', phaseIndex: 0 }
}

// Get moon phases for a specific day
function getMoonPhasesForDay(day: number): Array<{ name: string; phase: string; phasePercent: number; phaseIndex: number }> {
  const phases: Array<{ name: string; phase: string; phasePercent: number; phaseIndex: number }> = []
  const totalDays = getTotalDays(viewYear.value, viewMonth.value, day)

  for (const moon of calendarConfig.value.moons) {
    const dayInCycle = (totalDays + (moon.phase_offset || 0)) % moon.cycle_days
    const phasePercent = dayInCycle / moon.cycle_days
    const { phaseName, phaseIndex } = calculateMoonPhase(dayInCycle, moon)

    phases.push({ name: moon.name, phase: phaseName, phasePercent, phaseIndex })
  }

  return phases
}

// Get moon icon based on phase index (0-7)
function getMoonIconForPhase(phaseIndex: number): string {
  const icons = [
    'mdi-moon-new', // 0: New Moon
    'mdi-moon-waxing-crescent', // 1: Waxing Crescent
    'mdi-moon-first-quarter', // 2: First Quarter
    'mdi-moon-waxing-gibbous', // 3: Waxing Gibbous
    'mdi-moon-full', // 4: Full Moon
    'mdi-moon-waning-gibbous', // 5: Waning Gibbous
    'mdi-moon-last-quarter', // 6: Last Quarter
    'mdi-moon-waning-crescent', // 7: Waning Crescent
  ]
  return icons[phaseIndex] ?? 'mdi-moon-new'
}

// Moon colors palette for distinguishing multiple moons
const moonColors = [
  '#C0C0C0', // Silver (default moon)
  '#FFD700', // Gold
  '#E6A8D7', // Pink/Rose
  '#87CEEB', // Sky blue
  '#98FB98', // Pale green
  '#DDA0DD', // Plum
  '#F0E68C', // Khaki
  '#E0FFFF', // Light cyan
]

// Get color for a moon based on its index
function getMoonColor(moonName: string): string {
  const index = calendarConfig.value.moons.findIndex((m) => m.name === moonName)
  if (index < 0) return moonColors[0] ?? '#C0C0C0'
  return moonColors[index % moonColors.length] ?? '#C0C0C0'
}

// Get days in month (considering leap year)
function getDaysInMonth(month: number, year: number): number {
  const monthData = calendarConfig.value.months[month - 1]
  if (!monthData) return 30
  let days = monthData.days
  // Add leap day if this is the leap month and it's a leap year
  if (isLeapYear(year) && month === calendarConfig.value.config.leap_year_month) {
    days += calendarConfig.value.config.leap_year_extra_days
  }
  return days
}

function selectDay(day: number) {
  selectedDay.value = day
}

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = calendarConfig.value.months.length
    viewYear.value--
  } else {
    viewMonth.value--
  }
  selectedDay.value = null
  loadEvents()
  loadWeather()
}

function nextMonth() {
  if (viewMonth.value === calendarConfig.value.months.length) {
    viewMonth.value = 1
    viewYear.value++
  } else {
    viewMonth.value++
  }
  selectedDay.value = null
  loadEvents()
  loadWeather()
}

function prevYear() {
  viewYear.value--
  loadEvents()
  loadWeather()
}

function nextYear() {
  viewYear.value++
  loadEvents()
  loadWeather()
}

// Advance the current date by one day
async function advanceDay() {
  advancingDay.value = true
  try {
    const config = calendarConfig.value.config
    let newDay = config.current_day + 1
    let newMonth = config.current_month
    let newYear = config.current_year

    // Check if we need to advance to next month
    const daysInCurrentMonth = getDaysInMonth(newMonth, newYear)
    if (newDay > daysInCurrentMonth) {
      newDay = 1
      newMonth++

      // Check if we need to advance to next year
      if (newMonth > calendarConfig.value.months.length) {
        newMonth = 1
        newYear++
      }
    }

    // Save the new date via API
    await $fetch('/api/calendar/config', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        currentYear: newYear,
        currentMonth: newMonth,
        currentDay: newDay,
        yearZeroName: 'Jahr 0',
        eraName: config.era_name,
        leapYearInterval: config.leap_year_interval,
        leapYearMonth: config.leap_year_month,
        leapYearExtraDays: config.leap_year_extra_days,
        months: calendarConfig.value.months,
        weekdays: calendarConfig.value.weekdays,
        moons: calendarConfig.value.moons,
      },
    })

    // Reload config to update UI
    await loadConfig()

    // Navigate to new month/year if needed
    viewMonth.value = newMonth
    viewYear.value = newYear
    await loadEvents()
  } catch (error) {
    console.error('Failed to advance day:', error)
  } finally {
    advancingDay.value = false
  }
}

// Open settings dialog with a deep copy of current config
function openSettingsDialog() {
  // Create deep copy to avoid direct mutation
  settingsForm.value = {
    currentYear: calendarConfig.value.config.current_year,
    currentMonth: calendarConfig.value.config.current_month,
    currentDay: calendarConfig.value.config.current_day,
    eraName: calendarConfig.value.config.era_name || '',
    leapYearInterval: calendarConfig.value.config.leap_year_interval || 0,
    leapYearMonth: calendarConfig.value.config.leap_year_month || 1,
    leapYearExtraDays: calendarConfig.value.config.leap_year_extra_days || 1,
    months: calendarConfig.value.months.map((m) => ({ ...m })),
    weekdays: calendarConfig.value.weekdays.map((w) => ({ ...w })),
    moons: calendarConfig.value.moons.map((moon) => ({ ...moon })),
  }
  // Copy seasons for editing
  editingSeasons.value = seasons.value.map((s) => ({ ...s }))
  showSettingsDialog.value = true
}

async function saveSettings() {
  // First validate if there are breaking changes
  const result = await validateCalendarChanges()

  if (result && result.hasIssues) {
    // Show warning dialog
    validationResult.value = result
    showStructureWarning.value = true
    return
  }

  // No issues, save directly
  await doSaveSettings()
}

async function validateCalendarChanges() {
  try {
    const result = await $fetch<{
      hasIssues: boolean
      affectedEvents: Array<{ id: number; title: string; month: number; day: number; issue: string }>
      affectedSessions: Array<{ id: number; title: string; session_number: number | null; issue: string }>
    }>('/api/calendar/validate-changes', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        months: settingsForm.value.months,
      },
    })
    return result
  } catch (error) {
    console.error('Failed to validate calendar changes:', error)
    return null
  }
}

function cancelStructureChange() {
  showStructureWarning.value = false
  validationResult.value = null
}

async function confirmStructureChange() {
  // Fix affected data first
  try {
    await $fetch('/api/calendar/fix-affected', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        months: settingsForm.value.months,
      },
    })
  } catch (error) {
    console.error('Failed to fix affected data:', error)
  }

  showStructureWarning.value = false
  validationResult.value = null

  // Now save the settings
  await doSaveSettings()
}

async function doSaveSettings() {
  saving.value = true
  try {
    // Save calendar config
    await $fetch('/api/calendar/config', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        currentYear: settingsForm.value.currentYear,
        currentMonth: settingsForm.value.currentMonth,
        currentDay: settingsForm.value.currentDay,
        yearZeroName: 'Jahr 0',
        eraName: settingsForm.value.eraName,
        leapYearInterval: settingsForm.value.leapYearInterval,
        leapYearMonth: settingsForm.value.leapYearMonth,
        leapYearExtraDays: settingsForm.value.leapYearExtraDays,
        months: settingsForm.value.months,
        weekdays: settingsForm.value.weekdays,
        moons: settingsForm.value.moons,
      },
    })

    // Save seasons
    await saveSeasons()

    await loadConfig()
    await loadSeasons()
    await loadEvents()
    await loadSessions()
    showSettingsDialog.value = false
  } catch (error) {
    console.error('Failed to save calendar config:', error)
  } finally {
    saving.value = false
  }
}

async function saveSeasons() {
  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) return

  // Find deleted seasons (in original but not in editing)
  const editingIds = new Set(editingSeasons.value.filter((s) => s.id > 0).map((s) => s.id))
  const deletedSeasons = seasons.value.filter((s) => !editingIds.has(s.id))

  // Delete removed seasons
  for (const season of deletedSeasons) {
    await $fetch(`/api/calendar/seasons/${season.id}`, {
      method: 'DELETE',
    })
  }

  // Update/create seasons
  for (const [i, season] of editingSeasons.value.entries()) {
    if (season.id > 0) {
      // Update existing
      await $fetch(`/api/calendar/seasons/${season.id}`, {
        method: 'PATCH',
        body: {
          name: season.name,
          startMonth: season.start_month,
          startDay: season.start_day,
          backgroundImage: season.background_image,
          weatherType: season.weather_type,
          sortOrder: i,
        },
      })
    } else {
      // Create new
      await $fetch('/api/calendar/seasons', {
        method: 'POST',
        body: {
          campaignId,
          name: season.name,
          startMonth: season.start_month,
          startDay: season.start_day,
          backgroundImage: season.background_image,
          weatherType: season.weather_type,
          sortOrder: i,
        },
      })
    }
  }
}

// Event functions
function openNewEventDialog(day?: number) {
  editingEvent.value = null
  eventForm.value = {
    title: '',
    description: '',
    eventType: 'custom',
    day: day || selectedDay.value || 1,
    month: viewMonth.value,
    year: viewYear.value,
    isRecurring: false,
    entityId: null,
    entityIds: [],
  }
  showEventDialog.value = true
}

function editEvent(event: CalendarEvent) {
  editingEvent.value = event
  eventForm.value = {
    title: event.title,
    description: event.description || '',
    eventType: event.event_type,
    day: event.day,
    month: event.month,
    year: event.year || viewYear.value,
    isRecurring: !!event.is_recurring,
    entityId: event.entity_id,
    entityIds: event.linked_entities?.map((le) => le.entity_id) || [],
  }
  showEventDialog.value = true
}

async function saveEvent() {
  savingEvent.value = true
  try {
    if (editingEvent.value) {
      await $fetch(`/api/calendar/events/${editingEvent.value.id}`, {
        method: 'PATCH',
        body: {
          title: eventForm.value.title,
          description: eventForm.value.description,
          eventType: eventForm.value.eventType,
          day: eventForm.value.day,
          month: eventForm.value.month,
          year: eventForm.value.isRecurring ? null : eventForm.value.year,
          isRecurring: eventForm.value.isRecurring,
          entityIds: eventForm.value.entityIds, // New multi-entity
        },
      })
    } else {
      await $fetch('/api/calendar/events', {
        method: 'POST',
        body: {
          campaignId: campaignStore.activeCampaignId,
          title: eventForm.value.title,
          description: eventForm.value.description,
          eventType: eventForm.value.eventType,
          day: eventForm.value.day,
          month: eventForm.value.month,
          year: eventForm.value.isRecurring ? null : eventForm.value.year,
          isRecurring: eventForm.value.isRecurring,
          entityIds: eventForm.value.entityIds, // New multi-entity
        },
      })
    }
    await loadEvents()
    showEventDialog.value = false
  } catch (error) {
    console.error('Failed to save event:', error)
  } finally {
    savingEvent.value = false
  }
}

function deleteEvent(event: CalendarEvent) {
  eventToDelete.value = event
  showDeleteDialog.value = true
}

async function confirmDeleteEvent() {
  if (!eventToDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/calendar/events/${eventToDelete.value.id}`, { method: 'DELETE' })
    await loadEvents()
    showDeleteDialog.value = false
    eventToDelete.value = null
  } catch (error) {
    console.error('Failed to delete event:', error)
  } finally {
    deleting.value = false
  }
}

// Load functions
async function loadConfig() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarConfig>('/api/calendar/config', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
    calendarConfig.value = data
    viewYear.value = data.config.current_year
    viewMonth.value = data.config.current_month
    // Note: settingsForm is populated in openSettingsDialog() with deep copies
    // to avoid direct mutation when user edits but cancels
  } catch (error) {
    console.error('Failed to load calendar config:', error)
  }
}

async function loadEvents() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarEvent[]>('/api/calendar/events', {
      query: {
        campaignId: campaignStore.activeCampaignId,
        year: viewYear.value,
        month: viewMonth.value,
      },
    })
    events.value = data
  } catch (error) {
    console.error('Failed to load events:', error)
  }
}

async function loadEntities() {
  if (!campaignStore.activeCampaignId) return
  try {
    // Load all entities for linking (NPCs, Locations, Items, Factions, Lore, Players)
    const [npcs, locations, items, factions, lore, players] = await Promise.all([
      $fetch<Array<{ id: number; name: string }>>('/api/npcs', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/locations', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/items', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/factions', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/lore', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/players', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
    ])
    entityOptions.value = [
      ...npcs.map((n) => ({ ...n, type: 'NPC' })),
      ...players.map((p) => ({ ...p, type: 'Player' })),
      ...locations.map((l) => ({ ...l, type: 'Location' })),
      ...items.map((i) => ({ ...i, type: 'Item' })),
      ...factions.map((f) => ({ ...f, type: 'Faction' })),
      ...lore.map((l) => ({ ...l, type: 'Lore' })),
    ]
  } catch (error) {
    console.error('Failed to load entities:', error)
  }
}

async function loadSessions() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarSession[]>('/api/calendar/sessions', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
    sessions.value = data
  } catch (error) {
    console.error('Failed to load sessions:', error)
  }
}

async function loadSeasons() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarSeason[]>('/api/calendar/seasons', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
    seasons.value = data
  } catch (error) {
    console.error('Failed to load seasons:', error)
  }
}

async function loadWeather() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarWeather[]>('/api/calendar/weather', {
      query: {
        campaignId: campaignStore.activeCampaignId,
        year: viewYear.value,
        month: viewMonth.value,
      },
    })
    // Convert to map for efficient lookup
    weather.value = new Map(data.map((w) => [w.day, w]))
  } catch (error) {
    console.error('Failed to load weather:', error)
  }
}

// Get weather icon for weather type
function getWeatherIcon(type: string): string {
  const icons: Record<string, string> = {
    sunny: 'mdi-weather-sunny',
    partlyCloudy: 'mdi-weather-partly-cloudy',
    cloudy: 'mdi-weather-cloudy',
    rain: 'mdi-weather-rainy',
    heavyRain: 'mdi-weather-pouring',
    thunderstorm: 'mdi-weather-lightning-rainy',
    snow: 'mdi-weather-snowy',
    heavySnow: 'mdi-weather-snowy-heavy',
    fog: 'mdi-weather-fog',
    windy: 'mdi-weather-windy',
    hail: 'mdi-weather-hail',
  }
  return icons[type] || 'mdi-weather-cloudy'
}

// Get weather for a specific day
function getWeatherForDay(day: number): CalendarWeather | undefined {
  return weather.value.get(day)
}

// Open weather edit dialog for a specific day
function openWeatherDialog(day: number) {
  weatherDialogDay.value = day
  showWeatherDialog.value = true
}

// Handle weather saved from dialog
function onWeatherSaved(savedWeather: CalendarWeather) {
  weather.value.set(savedWeather.day, savedWeather)
}

// Handle weather cleared from dialog
function onWeatherCleared() {
  if (weatherDialogDay.value) {
    weather.value.delete(weatherDialogDay.value)
  }
}

// Generate weather for the current month
async function generateWeatherForMonth() {
  if (!campaignStore.activeCampaignId) return

  generatingWeather.value = true
  try {
    const result = await $fetch<{ generated: number; weather: CalendarWeather[] }>('/api/calendar/weather/generate', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        year: viewYear.value,
        month: viewMonth.value,
        overwrite: false, // Don't overwrite existing
      },
    })
    // Update weather map
    for (const w of result.weather) {
      weather.value.set(w.day, w)
    }
    if (result.generated > 0) {
      snackbarStore.success(t('calendar.weather.generated', { count: result.generated }))
    }
  } catch (error) {
    console.error('Failed to generate weather:', error)
    snackbarStore.error(String(error))
  } finally {
    generatingWeather.value = false
  }
}

onMounted(async () => {
  await loadConfig()
  await Promise.all([loadEvents(), loadSessions(), loadEntities(), loadSeasons(), loadWeather()])
})
</script>

<style scoped>
/* Season background image container */
.calendar-card {
  position: relative;
  overflow: hidden;
}

.season-background {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 300px;
  height: 300px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: bottom right;
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.5s ease, background-image 0.5s ease;
}

/* Ensure content stays above background */
.calendar-card :deep(.v-card-title),
.calendar-card :deep(.v-card-text) {
  position: relative;
  z-index: 1;
}

.calendar-grid {
  display: grid;
  /* grid-template-columns is set dynamically via :style binding */
  gap: 2px;
}

.calendar-header {
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 4px;
}

.calendar-day {
  min-height: 100px;
  padding: 6px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.calendar-day:hover {
  background: rgba(var(--v-theme-primary), 0.05);
}

.calendar-day.empty {
  background: transparent;
  border: none;
  cursor: default;
}

.calendar-day.is-today {
  background: rgba(var(--v-theme-primary), 0.15);
  border-color: rgb(var(--v-theme-primary));
}

.calendar-day.is-selected {
  background: rgba(var(--v-theme-secondary), 0.2);
  border-color: rgb(var(--v-theme-secondary));
  border-width: 2px;
}

.calendar-day.is-today.is-selected {
  background: rgba(var(--v-theme-primary), 0.25);
  border-color: rgb(var(--v-theme-primary));
  border-width: 2px;
}

.calendar-day.has-events {
  background: rgba(var(--v-theme-secondary), 0.05);
}

.calendar-day.has-sessions {
  background: rgba(33, 150, 243, 0.08);
}

.calendar-day.has-sessions.is-today {
  background: rgba(33, 150, 243, 0.15);
}

.day-number {
  font-weight: 500;
  margin-bottom: 4px;
}

/* Sessions in calendar */
.day-sessions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgba(33, 150, 243, 0.2);
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s;
  overflow: hidden;
  border-left: 3px solid rgb(33, 150, 243);
}

.session-item:hover {
  background: rgba(33, 150, 243, 0.35);
}

.session-item.session-start {
  border-left: 3px solid rgb(33, 150, 243);
  border-radius: 4px 4px 4px 4px;
}

.session-item.session-continuation {
  border-left: 3px dashed rgba(33, 150, 243, 0.6);
  background: rgba(33, 150, 243, 0.1);
  opacity: 0.85;
}

.session-item.session-end {
  border-left: 3px solid rgb(76, 175, 80);
}

.session-item.session-single {
  border-left: 3px solid rgb(33, 150, 243);
}

.session-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.session-more {
  padding: 2px 4px;
  text-align: center;
}

.session-continuation-item {
  opacity: 0.8;
  border-left: 3px dashed rgba(33, 150, 243, 0.5);
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.event-item {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  border-left: 3px solid;
  border-radius: 0 4px 4px 0;
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s;
  overflow: hidden;
}

.event-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
}

.event-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.event-more {
  padding: 2px 4px;
  text-align: center;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
