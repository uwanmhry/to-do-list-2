<script>
  import { onMount, tick } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import Modal from './Modal.svelte';
  import Toast from './Toast.svelte';
  import SettingsModal from './SettingsModal.svelte';

  export let session;

  // State variables
  let todos = [];
  let newTodo = '';
  let loading = false;
  let errorMessage = '';
  let userProfile = null;
  let showModal = false;
  let modalType = '';
  let currentTodo = null;
  let editText = '';
  let toastMessage = '';
  let toastType = 'success';
  let showToast = false;
  let editInput;
  let realtimeSubscription = null;
  let showSettingsModal = false;
  let authSubscription = null;
  let pressedKeys = new Set();

  // Toast functions
  function showToastMessage(message, type = 'success') {
    toastMessage = message;
    toastType = type;
    showToast = true;
    setTimeout(() => showToast = false, 2500);
  }

  // Tambahkan event listener untuk session updates
  function setupSessionListener() {
    const handleSessionUpdated = async (event) => {
      if (event.detail && event.detail.session) {
        session = event.detail.session;
        await fetchUserProfile();
        showToastMessage('Session diperbarui');
      }
    };

    window.addEventListener('sessionUpdated', handleSessionUpdated);
    
    return () => {
      window.removeEventListener('sessionUpdated', handleSessionUpdated);
    };
  }

  async function forceSyncEmail() {
    if (!session?.user) return;
    
    try {
      // Force sync email dari auth ke profiles
      const { error } = await supabase
        .from('profiles')
        .update({ 
          email: session.user.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);
      
      if (error) {
        console.error('Force sync error:', error);
      } else {
        console.log('Email force synced');
        await fetchUserProfile();
      }
    } catch (error) {
      console.error('Error in forceSyncEmail:', error);
    }
  }

  async function fetchUserProfile() {
    if (!session?.user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        userProfile = { username: session.user.email.split('@')[0], email: session.user.email };
        
        // Auto-create profile jika tidak ada
        const { error: createError } = await supabase
          .from('profiles')
          .insert([
            { 
              id: session.user.id, 
              username: session.user.email.split('@')[0],
              email: session.user.email
            }
          ]);
        
        if (createError) {
          console.error('Error creating profile:', createError);
        }
      } else {
        userProfile = data;
        
        // Check jika email tidak sync
        if (data.email !== session.user.email) {
          console.log('Email tidak sync, forcing sync...');
          await forceSyncEmail();
        }
      }
    } catch (error) {
      console.error('Exception in fetchUserProfile:', error);
      userProfile = { username: session.user.email.split('@')[0], email: session.user.email };
    }
  }

  // Fetch todos from Supabase
  async function fetchTodos() {
    if (!session?.user) return;
    
    try {
      loading = true;
      errorMessage = '';
      
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      todos = data || [];
    } catch (error) {
      console.error('Error fetching todos:', error);
      errorMessage = 'Gagal memuat daftar tugas';
      showToastMessage('Gagal memuat tugas', 'error');
    } finally {
      loading = false;
    }
  }

  // Setup realtime subscription
  function setupRealtime() {
    if (!session?.user) return;
    
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
    }
    
    realtimeSubscription = supabase
      .channel('todos-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'todos',
          filter: `user_id=eq.${session.user.id}`
        }, 
        (payload) => {
          console.log('Realtime change received:', payload);
          fetchTodos();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
    
    return realtimeSubscription;
  }

  // Cleanup realtime subscription
  function cleanupRealtime() {
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
      realtimeSubscription = null;
    }
  }

  // Setup auth listener
  function setupAuthListener() {
    if (authSubscription) return;
    
    authSubscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);
      
      try {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          session = newSession;
          
          if (event === 'USER_UPDATED') {
            showToastMessage('Profil berhasil diperbarui');
          }
          
          await fetchUserProfile();
          await fetchTodos();
        }
        
        if (event === 'SIGNED_OUT') {
          session = null;
          todos = [];
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      }
    });
  }

  // Sign out function
  async function handleSignOut() {
    try {
      loading = true;
      cleanupRealtime();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showToastMessage('Berhasil logout');
    } catch (error) {
      errorMessage = error.message;
      showToastMessage('Gagal logout', 'error');
    } finally {
      loading = false;
    }
  }

  // Add a new todo
  async function addTodo() {
    if (newTodo.trim() === '' || !session?.user) return;
    
    try {
      errorMessage = '';
      const { data, error } = await supabase
        .from('todos')
        .insert([{ 
          task: newTodo.trim(), 
          completed: false,
          user_id: session.user.id 
        }])
        .select();
      
      if (error) throw error;
      
      todos = [data[0], ...todos];
      newTodo = '';
      showToastMessage('Tugas ditambah');
    } catch (error) {
      console.error('Error adding todo:', error);
      errorMessage = 'Gagal menambahkan tugas';
      showToastMessage('Gagal menambah', 'error');
    }
  }

  // Toggle todo completion status
  async function toggleTodo(todo) {
    try {
      errorMessage = '';
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', todo.id)
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      todos = todos.map(t => 
        t.id === todo.id ? { ...t, completed: !t.completed } : t
      );
      
      const message = todo.completed ? 'Tugas belum selesai' : 'Tugas selesai';
      showToastMessage(message);
    } catch (error) {
      console.error('Error updating todo:', error);
      errorMessage = 'Gagal mengubah status tugas';
      showToastMessage('Gagal mengubah', 'error');
    }
  }

  // Toggle all todos
  async function toggleAllTodos() {
    try {
      errorMessage = '';
      const allCompleted = todos.every(todo => todo.completed);
      const newStatus = !allCompleted;
      
      const { error } = await supabase
        .from('todos')
        .update({ completed: newStatus })
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      todos = todos.map(todo => ({ ...todo, completed: newStatus }));
      
      const message = newStatus ? 'Semua tugas selesai' : 'Semua tugas belum selesai';
      showToastMessage(message);
    } catch (error) {
      console.error('Error toggling all todos:', error);
      errorMessage = 'Gagal mengubah status semua tugas';
      showToastMessage('Gagal mengubah semua', 'error');
    }
  }

  // Edit todo
  async function editTodo() {
    if (editText.trim() === '') return;
    
    try {
      errorMessage = '';
      const { error } = await supabase
        .from('todos')
        .update({ task: editText.trim() })
        .eq('id', currentTodo.id)
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      todos = todos.map(t => 
        t.id === currentTodo.id ? { ...t, task: editText.trim() } : t
      );
      
      closeModal();
      showToastMessage('Tugas diedit');
    } catch (error) {
      console.error('Error editing todo:', error);
      errorMessage = 'Gagal mengedit tugas';
      showToastMessage('Gagal mengedit', 'error');
    }
  }

  // Delete a todo
  async function deleteTodo() {
    try {
      errorMessage = '';
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', currentTodo.id)
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      todos = todos.filter(t => t.id !== currentTodo.id);
      closeModal();
      showToastMessage('Tugas dihapus');
    } catch (error) {
      console.error('Error deleting todo:', error);
      errorMessage = 'Gagal menghapus tugas';
      showToastMessage('Gagal menghapus', 'error');
    }
  }

  // Delete all todos
  async function deleteAllTodos() {
    try {
      errorMessage = '';
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      todos = [];
      closeModal();
      showToastMessage('Semua tugas dihapus');
    } catch (error) {
      console.error('Error deleting all todos:', error);
      errorMessage = 'Gagal menghapus semua tugas';
      showToastMessage('Gagal menghapus semua', 'error');
    }
  }

  // Modal functions
  async function openEditModal(todo) {
    currentTodo = todo;
    editText = todo.task;
    modalType = 'edit';
    showModal = true;
    
    await tick();
    if (editInput) editInput.focus();
  }

  function openDeleteModal(todo) {
    currentTodo = todo;
    modalType = 'delete';
    showModal = true;
  }

  function openDeleteAllModal() {
    modalType = 'deleteAll';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    modalType = '';
    currentTodo = null;
    editText = '';
  }

  function openSettingsModal() {
    showSettingsModal = true;
  }

  function closeSettingsModal() {
    showSettingsModal = false;
  }

  // Keyboard shortcuts
  function handleKeyDown(event) {
    pressedKeys.add(event.key.toLowerCase());
    
    // Ctrl+Enter to add new todo
    if (pressedKeys.has('control') && event.key === 'Enter' && newTodo.trim()) {
      event.preventDefault();
      addTodo();
    }
    
    // Enter to confirm modal actions
    if (event.key === 'Enter' && showModal) {
      event.preventDefault();
      if (modalType === 'edit') {
        editTodo();
      } else if (modalType === 'delete') {
        deleteTodo();
      } else if (modalType === 'deleteAll') {
        deleteAllTodos();
      }
    }
    
    // Escape to close modal
    if (event.key === 'Escape' && showModal) {
      closeModal();
    }
  }

  function handleKeyUp(event) {
    pressedKeys.delete(event.key.toLowerCase());
  }

  // Handle Enter key untuk form tambah todo
  function handleAddTodoKeyPress(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTodo();
    }
  }

  // Load data on component mount
  onMount(() => {
    fetchUserProfile();
    fetchTodos();
    setupAuthListener();
    const cleanupSessionListener = setupSessionListener();
    
    // Setup realtime subscription setelah delay kecil
    setTimeout(() => {
      setupRealtime();
    }, 1000);
    
    // Juga force sync saat component mount
    setTimeout(() => {
      forceSyncEmail();
    }, 2000);
    
    // Setup keyboard listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      cleanupRealtime();
      if (authSubscription) {
        authSubscription.data.subscription.unsubscribe();
      }
      cleanupSessionListener();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-4 px-2 sm:py-8 sm:px-4">
  <div class="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-4 sm:p-6 space-y-4 sm:space-y-6">
    <header class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-blue-700">Todo List</h1>
        <p class="text-blue-500 text-xs sm:text-sm">
          Halo, {userProfile ? userProfile.username : session.user.email}
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <button on:click={openSettingsModal} class="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors" title="Pengaturan Akun" disabled={loading}>
          <svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button on:click={handleSignOut} class="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Keluar" disabled={loading}>
          <svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
    
    {#if errorMessage}
      <div class="p-2 sm:p-3 bg-red-100 text-red-700 rounded-lg text-sm">
        {errorMessage}
      </div>
    {/if}
    
    <div class="flex space-x-2">
      <input 
        bind:value={newTodo} 
        type="text" 
        placeholder="Tambahkan tugas baru..." 
        class="flex-1 px-3 py-2 sm:px-4 sm:py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base" 
        on:keypress={handleAddTodoKeyPress}
        disabled={loading} 
      />
      <button on:click={addTodo} class="px-3 py-2 sm:px-4 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm sm:text-base flex items-center justify-center min-w-[80px]" disabled={loading || !newTodo.trim()}>
        {#if loading}
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else}
          Tambah
        {/if}
      </button>
    </div>

    {#if todos.length > 0}
      <div class="flex space-x-2 justify-between">
        <button on:click={toggleAllTodos} class="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 text-xs sm:text-sm" disabled={loading}>
          {todos.every(t => t.completed) ? 'Batal Centang Semua' : 'Centang Semua'}
        </button>
        <button on:click={openDeleteAllModal} class="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 text-xs sm:text-sm" disabled={loading}>
          Hapus Semua
        </button>
      </div>
    {/if}

    <div class="space-y-2 sm:space-y-3">
      {#if loading && todos.length === 0}
        <div class="text-center py-4">
          <p class="text-blue-500">Memuat tugas...</p>
        </div>
      {:else if todos.length === 0}
        <div class="text-center py-4 bg-blue-50 rounded-lg">
          <p class="text-blue-700 text-sm sm:text-base">Tidak ada tugas. Yuk tambahkan yang baru!</p>
        </div>
      {:else}
        {#each todos as todo (todo.id)}
          <div class="flex items-center justify-between p-2 sm:p-3 bg-blue-50 rounded-lg transition-all hover:bg-blue-100 animate-fade-in">
            <div class="flex items-center space-x-2 sm:space-x-3 flex-1">
              <input type="checkbox" checked={todo.completed} on:change={() => toggleTodo(todo)} class="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 rounded focus:ring-blue-500" disabled={loading} />
              <span class:line-through={todo.completed} class:text-gray-500={todo.completed} class="flex-1 text-sm sm:text-base {todo.completed ? 'text-gray-500 line-through' : 'text-gray-800'}" on:dblclick={() => openEditModal(todo)}>
                {todo.task}
              </span>
            </div>
            <div class="flex space-x-1 sm:space-x-2">
              <button on:click={() => openEditModal(todo)} class="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors" title="Edit tugas" disabled={loading}>
                <svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button on:click={() => openDeleteModal(todo)} class="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors" title="Hapus tugas" disabled={loading}>
                <svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
    
    {#if todos.length > 0}
      <footer class="text-center text-xs sm:text-sm text-blue-400 pt-3 sm:pt-4 border-t border-blue-100">
        <p>{todos.length} tugas | {todos.filter(t => t.completed).length} selesai</p>
        <p class="mt-1 text-xs text-gray-400">Tip: Double klik tugas untuk edit</p>
        <p class="text-xs text-gray-400">Ctrl+Enter untuk tambah tugas baru | Enter untuk konfirmasi</p>
      </footer>
    {/if}
  </div>
</div>

{#if showModal}
  <Modal on:close={closeModal}>
    {#if modalType === 'edit'}
      <div class="p-4">
        <h2 class="text-lg font-bold text-blue-700 mb-4">Edit Tugas</h2>
        <input bind:value={editText} bind:this={editInput} type="text" class="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" on:keypress={(e) => e.key === 'Enter' && editTodo()} />
        <div class="flex space-x-2 justify-end">
          <button on:click={closeModal} class="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">Batal</button>
          <button on:click={editTodo} class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" disabled={!editText.trim()}>Simpan</button>
        </div>
      </div>
    {:else if modalType === 'delete'}
      <div class="p-4">
        <h2 class="text-lg font-bold text-red-700 mb-4">Hapus Tugas</h2>
        <p class="mb-4">Apakah Anda yakin ingin menghapus tugas "{currentTodo.task}"?</p>
        <div class="flex space-x-2 justify-end">
          <button on:click={closeModal} class="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">Batal</button>
          <button on:click={deleteTodo} class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Hapus</button>
        </div>
      </div>
    {:else if modalType === 'deleteAll'}
      <div class="p-4">
        <h2 class="text-lg font-bold text-red-700 mb-4">Hapus Semua Tugas</h2>
        <p class="mb-4">Apakah Anda yakin ingin menghapus semua tugas? Tindakan ini tidak dapat dibatalkan.</p>
        <div class="flex space-x-2 justify-end">
          <button on:click={closeModal} class="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">Batal</button>
          <button on:click={deleteAllTodos} class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Hapus Semua</button>
        </div>
      </div>
    {/if}
  </Modal>
{/if}

{#if showSettingsModal}
  <SettingsModal on:close={closeSettingsModal} {session} {userProfile} />
{/if}

{#if showToast}
  <Toast message={toastMessage} type={toastType} on:close={() => showToast = false} />
{/if}

<style>
  input[type="checkbox"]:checked { background-color: rgb(59 130 246); }
  .animate-fade-in { animation: fadeIn 0.3s ease-out; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>