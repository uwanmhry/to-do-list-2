import { writable } from 'svelte/store';

export const toasts = writable([]);

export function addToast(message, type = 'info', duration = 3000) {
  const id = Date.now();
  toasts.update(all => [...all, { id, message, type }]);
  
  setTimeout(() => {
    toasts.update(all => all.filter(t => t.id !== id));
  }, duration);
}
