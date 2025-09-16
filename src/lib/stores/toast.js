import { writable } from 'svelte/store';

function createToastStore() {
  const { subscribe, update } = writable([]);
  
  return {
    subscribe,
    add: (message, type = 'info') => {
      const id = Math.random().toString(36).substr(2, 9);
      update(toasts => [...toasts, { id, message, type }]);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        update(toasts => toasts.filter(toast => toast.id !== id));
      }, 5000);
    },
    remove: (id) => {
      update(toasts => toasts.filter(toast => toast.id !== id));
    }
  };
}

export const toasts = createToastStore();

// Helper function untuk digunakan di komponen
export const addToast = (message, type = 'info') => {
  toasts.add(message, type);
};