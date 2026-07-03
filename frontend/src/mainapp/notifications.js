export function configureNotifications() {
  if (!window.toastr) {
    return;
  }

  window.toastr.options = {
    closeButton: true,
    debug: false,
    newestOnTop: false,
    progressBar: true,
    positionClass: 'toast-top-right',
    preventDuplicates: true,
    onclick: null,
    showDuration: '300',
    hideDuration: '1000',
    timeOut: '5000',
    extendedTimeOut: '1000',
    showEasing: 'swing',
    hideEasing: 'linear',
    showMethod: 'fadeIn',
    hideMethod: 'fadeOut',
  };
}

function showToast(type, message) {
  if (window.toastr?.[type]) {
    window.toastr[type](message);
    return;
  }

  if (type === 'error') {
    console.error(message);
    return;
  }

  if (type === 'warning') {
    console.warn(message);
    return;
  }
}

export function notifySuccess(message) {
  showToast('success', message);
}

export function notifyWarning(message) {
  showToast('warning', message);
}

export function notifyError(message) {
  showToast('error', message);
}

export function createNotifier() {
  return {
    success: notifySuccess,
    warning: notifyWarning,
    error: notifyError,
  };
}
