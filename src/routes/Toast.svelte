<script>
  import { onMount, createEventDispatcher } from 'svelte';
  
  export let message = '';
  export let type = 'success';
  
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
        <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
      {:else}
        <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
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