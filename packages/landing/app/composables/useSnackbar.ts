interface SnackbarState {
  show: boolean
  message: string
  color: string
  timeout: number
}

const state = reactive<SnackbarState>({
  show: false,
  message: '',
  color: 'error',
  timeout: 5000,
})

export function useSnackbar() {
  function showError(message: string, timeout = 5000) {
    state.message = message
    state.color = 'error'
    state.timeout = timeout
    state.show = true
  }

  function showSuccess(message: string, timeout = 3000) {
    state.message = message
    state.color = 'success'
    state.timeout = timeout
    state.show = true
  }

  function showInfo(message: string, timeout = 3000) {
    state.message = message
    state.color = 'info'
    state.timeout = timeout
    state.show = true
  }

  function hide() {
    state.show = false
  }

  return {
    state,
    showError,
    showSuccess,
    showInfo,
    hide,
  }
}
