import { defineStore } from 'pinia'

export type SnackbarColor = 'success' | 'error' | 'warning' | 'info'

interface SnackbarState {
  show: boolean
  message: string
  color: SnackbarColor
  timeout: number
}

export const useSnackbarStore = defineStore('snackbar', {
  state: (): SnackbarState => ({
    show: false,
    message: '',
    color: 'info',
    timeout: 4000,
  }),

  actions: {
    showMessage(message: string, color: SnackbarColor = 'info', timeout = 4000) {
      this.message = message
      this.color = color
      this.timeout = timeout
      this.show = true
    },

    success(message: string, timeout = 4000) {
      this.showMessage(message, 'success', timeout)
    },

    error(message: string, timeout = 5000) {
      this.showMessage(message, 'error', timeout)
    },

    warning(message: string, timeout = 5000) {
      this.showMessage(message, 'warning', timeout)
    },

    info(message: string, timeout = 4000) {
      this.showMessage(message, 'info', timeout)
    },

    hide() {
      this.show = false
    },
  },
})
