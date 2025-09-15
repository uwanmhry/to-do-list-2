<script>
  import { supabase } from '$lib/supabaseClient';
  import { onMount, beforeUpdate } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-svelte';

  let tasks = [];
  let newTask = '';
  let isLoading = true;
  let isAdding = false;

  let showDeleteAllModal = false;
  let showEditModal = false;
  let taskToEdit = null;
  let editText = '';
  let editInputEl;

  // Debounce variables
  let timeoutId;
  const debounceDelay = 300;

  // Optimasi: Batasi jumlah operasi real-time
  onMount(async () => {
    try {
      await loadTasks();
      
      // Real-time listener dengan filter yang lebih spesifik
      const channel = supabase
        .channel('tasks_channel')
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'tasks' 
          },
          handleNewTask
        )
        .on(
          'postgres_changes',
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'tasks' 
          },
          handleUpdateTask
        )
        .on(
          'postgres_changes',
          { 
            event: 'DELETE', 
            schema: 'public', 
            table: 'tasks' 
          },
          handleDeleteTask
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error initializing component:', error);
    } finally {
      isLoading = false;
    }
  });

  // Handler untuk real-time updates yang lebih efisien
  function handleNewTask(payload) {
    tasks = [...tasks, payload.new];
  }

  function handleUpdateTask(payload) {
    tasks = tasks.map(task => 
      task.id === payload.new.id ? payload.new : task
    );
  }

  function handleDeleteTask(payload) {
    tasks = tasks.filter(task => task.id !== payload.old.id);
  }

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading tasks:', error.message);
        return;
      }
      
      tasks = data ?? [];
    } catch (error) {
      console.error('Unexpected error in loadTasks:', error);
    }
  }

  async function addTask() {
    const text = newTask.trim();
    if (text === '' || isAdding) return;
    
    isAdding = true;
    try {
      const { error } = await supabase.from('tasks').insert([{ text, done: false }]);
      if (error) throw error;
      newTask = '';
    } catch (error) {
      console.error('Error adding task:', error.message);
    } finally {
      isAdding = false;
    }
  }

  // Debounced input handler
  function handleInput(e) {
    newTask = e.target.value;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(addTask, debounceDelay);
  }

  async function toggleTask(task) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ done: !task.done })
        .eq('id', task.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling task:', error.message);
    }
  }

  async function deleteTask(id) {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting task:', error.message);
    }
  }

  function confirmClearAll() {
    if (tasks.length === 0) return;
    showDeleteAllModal = true;
  }

  async function clearAll() {
    try {
      const { error } = await supabase.from('tasks').delete().neq('id', 0);
      if (error) throw error;
      showDeleteAllModal = false;
    } catch (error) {
      console.error('Error clearing all tasks:', error.message);
    }
  }

  function openEdit(task) {
    taskToEdit = task;
    editText = task.text;
    showEditModal = true;
    
    // Focus on input after modal renders
    setTimeout(() => {
      if (editInputEl) {
        editInputEl.focus();
        editInputEl.select();
      }
    }, 100);
  }

  async function saveEdit() {
    if (!taskToEdit || editText.trim() === '') {
      showEditModal = false;
      return;
    }
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ text: editText.trim() })
        .eq('id', taskToEdit.id);
        
      if (error) throw error;
      showEditModal = false;
    } catch (error) {
      console.error('Error saving edit:', error.message);
    }
  }

  function handleEditKeydown(e) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') showEditModal = false;
  }

  // Computed properties
  $: completedCount = tasks.filter(t => t.done).length;
  $: totalCount = tasks.length;
  $: progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  $: hasTasks = totalCount > 0;
</script>

<main class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4 md:p-6">
  <div class="w-full max-w-md rounded-2xl shadow-lg p-6 bg-white border border-slate-100">
    <h1 class="text-3xl font-bold text-center mb-6 text-slate-800 flex items-center justify-center gap-2">
      <span class="text-blue-500">📝</span> To-Do List
    </h1>

    {#if hasTasks}
      <div class="mb-6">
        <div class="flex justify-between text-sm mb-2">
          <span class="font-medium text-slate-700">Progress</span>
          <span class="text-slate-500">{completedCount}/{totalCount} ({progress}%)</span>
        </div>
        <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
          <div
            class="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={`width: ${progress}%`}
          ></div>
        </div>
      </div>
    {/if}

    <div class="flex gap-2 mb-6">
      <input
        type="text"
        bind:value={newTask}
        placeholder="Tambah tugas baru..."
        class="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
        on:keydown={(e) => e.key === 'Enter' && addTask()}
        disabled={isLoading}
      />
      <button
        on:click={addTask}
        class="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all flex items-center gap-1.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading || !newTask.trim() || isAdding}
        aria-label="Tambah tugas"
      >
        {#if isAdding}
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        {:else}
          <Plus size={18} /> 
        {/if}
        <span class="hidden sm:inline">{isAdding ? 'Menambah...' : 'Tambah'}</span>
      </button>
    </div>

    {#if isLoading}
      <div class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    {:else if hasTasks}
      {#key tasks.length}
        <ul class="space-y-3 mb-6">
          {#each tasks as task (task.id)}
            <li
              class="task-item flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all duration-200 border border-slate-200/50"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={task.done}
                  on:change={() => toggleTask(task)}
                  class="w-5 h-5 rounded border-2 text-blue-500 focus:ring-blue-400 focus:ring-opacity-25 cursor-pointer"
                  aria-label={task.done ? 'Tandai belum selesai' : 'Tandai selesai'}
                />
                <span
                  class:line-through={task.done}
                  class:opacity-60={task.done}
                  class="truncate transition-all"
                >
                  {task.text}
                </span>
              </div>

              <div class="flex gap-2 ml-2 flex-shrink-0">
                <button
                  on:click={() => openEdit(task)}
                  class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  aria-label="Edit tugas"
                >
                  <Pencil size={16} />
                </button>
                <button
                  on:click={() => deleteTask(task.id)}
                  class="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  aria-label="Hapus tugas"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          {/each}
        </ul>

        <button
          on:click={confirmClearAll}
          class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-medium flex items-center justify-center gap-2"
          disabled={isLoading}
        >
          <Trash2 size={16} />
          Hapus Semua
        </button>
      {/key}
    {:else}
      <div class="text-center py-10 text-slate-500">
        <div class="text-4xl mb-3">🎉</div>
        <p>Belum ada tugas</p>
        <p class="text-sm mt-1">Tambahkan tugas pertama Anda di atas</p>
      </div>
    {/if}

    <!-- Modal Hapus Semua -->
    {#if showDeleteAllModal}
      <div
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        on:click={() => (showDeleteAllModal = false)}
      >
        <div
          class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          on:click|stopPropagation
        >
          <div class="flex items-start gap-3 mb-4">
            <div class="p-2 bg-red-100 rounded-full mt-0.5">
              <AlertCircle size={20} class="text-red-600" />
            </div>
            <div>
              <h2 id="delete-modal-title" class="text-lg font-semibold text-slate-800">
                Hapus Semua Tugas
              </h2>
              <p class="text-slate-600 mt-1 text-sm">
                Semua tugas akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>
          
          <div class="flex justify-end gap-3 mt-6">
            <button
              on:click={() => (showDeleteAllModal = false)}
              class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-medium"
            >
              Batal
            </button>
            <button
              on:click={clearAll}
              class="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all font-medium"
            >
              Ya, Hapus Semua
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Modal Edit -->
    {#if showEditModal}
      <div
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        on:click={() => (showEditModal = false)}
      >
        <div
          class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
          on:click|stopPropagation
        >
          <h2 id="edit-modal-title" class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Pencil size={20} class="text-blue-500" />
            Edit Tugas
          </h2>
          
          <input
            type="text"
            bind:this={editInputEl}
            bind:value={editText}
            class="w-full border border-slate-200 rounded-xl p-3 mb-5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            placeholder="Masukkan teks tugas..."
            on:keydown={handleEditKeydown}
          />
          
          <div class="flex justify-end gap-3">
            <button
              on:click={() => (showEditModal = false)}
              class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-medium"
            >
              Batal
            </button>
            <button
              on:click={saveEdit}
              class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all font-medium"
              disabled={!editText.trim()}
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .line-through {
    text-decoration: line-through;
  }
</style>