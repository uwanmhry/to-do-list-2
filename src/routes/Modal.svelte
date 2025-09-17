<script>
  import { onMount, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleClickOutside(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  onMount(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div
  class="fixed inset-0 flex items-center justify-center p-4 z-50"
  on:click={handleClickOutside}
  style="background: rgba(0, 0, 0, 0.15); backdrop-filter: blur(1.5px); -webkit-backdrop-filter: blur(1.5px);"
>
  <div 
    class="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
    on:click|stopPropagation
  >
    <slot />
  </div>
</div>

<style>
  div {
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      backdrop-filter: blur(0px);
      -webkit-backdrop-filter: blur(0px);
    }
    to {
      opacity: 1;
      backdrop-filter: blur(1.5px);
      -webkit-backdrop-filter: blur(1.5px);
    }
  }
</style>