<script>
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-svelte';
  import { dndzone } from 'svelte-dnd-action';

  let tasks = [];
  let newTask = '';
  let isLoading = true;
  let isAdding = false;

  let showDeleteAllModal = false;
  let showEditModal = false;
  let taskToEdit = null;
  let editText = '';
  let editInputEl;

  // Load tasks
  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('order', { ascending: true });
      if (error) throw error;
      tasks = data ?? [];
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    await loadTasks();

    const channel = supabase
      .channel('tasks_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        switch(payload.eventType) {
          case 'INSERT':
            tasks = [...tasks, payload.new].sort((a,b) => a.order - b.order);
            break;
          case 'UPDATE':
            tasks = tasks.map(t => t.id === payload.new.id ? payload.new : t).sort((a,b) => a.order - b.order);
            break;
          case 'DELETE':
            tasks = tasks.filter(t => t.id !== payload.old.id).sort((a,b) => a.order - b.order);
            break;
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  });

  async function addTask() {
    const text = newTask.trim();
    if (!text || isAdding) return;

    isAdding = true;
    try {
      const { error } = await supabase
        .from('tasks')
        .insert([{ text, done: false, order: tasks.length }]);
      if (error) throw error;
      newTask = '';
    } catch (err) {
      console.error('Error adding task:', err);
    } finally {
      isAdding = false;
    }
  }

  async function toggleTask(task) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ done: !task.done })
        .eq('id', task.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  }

  async function deleteTask(id) {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  }

  function confirmClearAll() {
    if (!tasks.length) return;
    showDeleteAllModal = true;
  }

  async function clearAll() {
    try {
      const { error } = await supabase.from('tasks').delete();
      if (error) throw error;
      showDeleteAllModal = false;
    } catch (err) {
      console.error('Error clearing tasks:', err);
    }
  }

  function openEdit(task) {
    taskToEdit = task;
    editText = task.text;
    showEditModal = true;
    setTimeout(() => editInputEl?.focus(), 100);
  }

  async function saveEdit() {
    if (!taskToEdit || !editText.trim()) {
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
    } catch (err) {
      console.error('Error saving edit:', err);
    }
  }

  function handleEditKeydown(e) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') showEditModal = false;
  }

  // Drag & drop handler
  async function handleDnd({ detail }) {
    const { items } = detail;
    tasks = items; // Optimistic UI update
    try {
      const realTasks = items.filter(t => typeof t.id === 'number');
      await Promise.all(
        realTasks.map((t, idx) =>
          supabase.from('tasks').update({ order: idx }).eq('id', t.id)
        )
      );
    } catch (err) {
      console.error('Error updating order:', err.message);
    }
  }

  $: completedCount = tasks.filter(t => t.done).length;
  $: totalCount = tasks.length;
  $: progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
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
          <div class="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={`width: ${progress}%`}></div>
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
      >
        {#if isAdding}
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        {:else}
          <Plus size={18}/>
        {/if}
        <span class="hidden sm:inline">{isAdding ? 'Menambah...' : 'Tambah'}</span>
      </button>
    </div>

    {#if isLoading}
      <div class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    {:else if hasTasks}
      <ul
        use:dndzone={{
          items: tasks,
          flipDurationMs: 150,
          longPressDelay: 200 // HARUS tahan 200ms dulu baru bisa drag
        }}
        on:consider={handleDnd}
        on:finalize={handleDnd}
        class="space-y-3 mb-6"
      >
        {#each tasks as task (task.id)}
          <li class="task-item flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200/50">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <input type="checkbox" checked={task.done} on:change={() => toggleTask(task)} class="w-5 h-5 rounded border-2 text-blue-500 focus:ring-blue-400 focus:ring-opacity-25 cursor-pointer"/>
              <span class:line-through={task.done} class:opacity-60={task.done} class="truncate transition-all">{task.text}</span>
            </div>
            <div class="flex gap-2 ml-2">
              <button on:click={() => openEdit(task)} class="p-2 hover:bg-slate-200 rounded-full transition-all"><Pencil size={16}/></button>
              <button on:click={() => deleteTask(task.id)} class="p-2 hover:bg-red-100 rounded-full transition-all text-red-500"><Trash2 size={16}/></button>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
        <AlertCircle size={36}/> <span>Tidak ada tugas</span>
      </div>
    {/if}

    {#if hasTasks}
      <button on:click={confirmClearAll} class="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-medium">Hapus Semua</button>
    {/if}
  </div>

  {#if showDeleteAllModal}
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full space-y-4">
        <h3 class="font-bold text-lg text-slate-800">Konfirmasi</h3>
        <p>Apakah kamu yakin ingin menghapus semua tugas?</p>
        <div class="flex justify-end gap-3 mt-4">
          <button on:click={() => showDeleteAllModal = false} class="px-4 py-2 rounded-xl bg-slate-200">Batal</button>
          <button on:click={clearAll} class="px-4 py-2 rounded-xl bg-red-500 text-white">Hapus</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showEditModal}
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full space-y-4">
        <h3 class="font-bold text-lg text-slate-800">Edit Tugas</h3>
        <input bind:this={editInputEl} bind:value={editText} on:keydown={handleEditKeydown} type="text" class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"/>
        <div class="flex justify-end gap-3 mt-4">
          <button on:click={() => showEditModal = false} class="px-4 py-2 rounded-xl bg-slate-200">Batal</button>
          <button on:click={saveEdit} class="px-4 py-2 rounded-xl bg-blue-500 text-white">Simpan</button>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  .line-through { text-decoration: line-through; }
  .opacity-60 { opacity: 0.6; }
</style>
