<script>
  import { toasts } from '$lib/stores/toast';
  import { fly, fade } from 'svelte/transition';
</script>

<div class="fixed top-4 right-4 flex flex-col gap-2 z-50">
  {#each $toasts as toast (toast.id)}
    <div
      class={`px-4 py-2 rounded-lg shadow-md text-white max-w-xs break-words
                 ${toast.type === 'success' ? 'bg-green-500' : ''}
                 ${toast.type === 'error' ? 'bg-red-500' : ''}
                 ${toast.type === 'info' ? 'bg-blue-500' : ''}`}
      in:fly={{ x: 200, duration: 300, opacity: 0 }}
      out:fly={{ x: 200, duration: 300, opacity: 0 }}
    >
      {toast.message}
    </div>
  {/each}
</div>
