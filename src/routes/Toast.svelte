<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { Check, X } from 'lucide-svelte';

  export let message = '';
  export let type = 'success'; // 'success' or 'error'

  const dispatch = createEventDispatcher();

  onMount(() => {
    const timer = setTimeout(() => {
      dispatch('close');
    }, 2500);

    return () => clearTimeout(timer);
  });
</script>

<div class="fixed top-4 right-4 z-50 animate-toast-in">
  <div class="rounded-md px-3 py-2 text-sm font-medium shadow-sm
              {type === 'success'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'}">
    <div class="flex items-center space-x-2">
      {#if type === 'success'}
        <Check class="h-4 w-4" />
      {:else}
        <X class="h-4 w-4" />
      {/if}
      <span>{message}</span>
    </div>
  </div>
</div>

<style>
  .animate-toast-in {
    animation: toastSlideIn 0.2s ease-out;
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
