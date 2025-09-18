<script>
    import { onMount, createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let customClass = '';

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
    class="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 transition-opacity duration-300 backdrop-blur-xl"
    on:click={handleClickOutside}
>
    <div 
        class="bg-slate-900/40 border border-white/20 rounded-2xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto transform-gpu transition-transform duration-300 animate-fade-in {customClass}"
        on:click|stopPropagation
    >
        <slot />
    </div>
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.3s ease-out forwards;
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>