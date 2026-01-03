import { defineStore } from 'pinia'

export type SnackbarColor = 'success' | 'error' | 'warning' | 'info'

interface SnackbarOptions {
  timeout?: number
  persistent?: boolean
}

interface SnackbarState {
  show: boolean
  message: string
  color: SnackbarColor
  timeout: number
  persistent: boolean
}

export const useSnackbarStore = defineStore('snackbar', {
  state: (): SnackbarState => ({
    show: false,
    message: '',
    color: 'info',
    timeout: 4000,
    persistent: false,
  }),

  actions: {
    showMessage(message: string, color: SnackbarColor = 'info', options: SnackbarOptions = {}) {
      this.message = message
      this.color = color
      this.timeout = options.persistent ? -1 : (options.timeout ?? 4000)
      this.persistent = options.persistent ?? false
      this.show = true
    },

    success(message: string, options: SnackbarOptions = {}) {
      this.showMessage(message, 'success', { timeout: 4000, ...options })
    },

    error(message: string, options: SnackbarOptions = {}) {
      this.showMessage(message, 'error', { timeout: 5000, ...options })
    },

    warning(message: string, options: SnackbarOptions = {}) {
      this.showMessage(message, 'warning', { timeout: 5000, ...options })
    },

    info(message: string, options: SnackbarOptions = {}) {
      this.showMessage(message, 'info', { timeout: 4000, ...options })
    },

    hide() {
      this.show = false
      this.persistent = false
    },
  },
})
