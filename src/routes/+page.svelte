<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import Auth from './Auth.svelte';
  import TodoApp from './TodoApp.svelte';

  let session = null;
  let loading = true;

  // Check for active session on mount
  onMount(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      session = currentSession;
      loading = false;
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
      loading = false;
    });

    return () => subscription.unsubscribe();
  });
</script>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-8 px-4">
  {#if loading}
    <div class="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-6 text-center">
      <p class="text-blue-500">Loading...</p>
    </div>
  {:else if !session}
    <Auth />
  {:else}
    <TodoApp {session} />
  {/if}
</main>