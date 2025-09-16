<script>
  import Toast from '$lib/components/Toast.svelte';
  import { addToast } from '$lib/stores/toast';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { Plus, Pencil, Trash2 } from 'lucide-svelte';
  import { fly, fade, scale } from 'svelte/transition';

  let tasks = [];
  let newTask = '';
  let isLoading = true;
  let isAdding = false;

  // 🔥 modal konfirmasi (bisa untuk 1 task atau semua)
  let showDeleteModal = false;
  let deleteTarget = null; // null = semua, {id, text} = task tertentu

  // 🔥 modal edit task
  let showEditModal = false;
  let taskToEdit = null;
  let editText = '';
  let editInputEl;

  function generateId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < length; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const timePart = Date.now().toString().slice(-2);
    return randomPart + timePart;
  }

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      tasks = data ?? [];
    } catch (err) {
      console.error('Error loading tasks:', err);
      addToast('Gagal memuat tugas.', 'error');
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadTasks();

    // 🎹 global key handler (ESC & ENTER)
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  async function addTask() {
    const text = newTask.trim();
    if (!text || isAdding) return;

    isAdding = true;
    try {
      const newTaskObj = { id: generateId(5), text, done: false };
      const { error } = await supabase.from('tasks').insert([newTaskObj]);
      if (error) throw error;
      tasks = [...tasks, newTaskObj];
      addToast('Task berhasil ditambahkan!', 'success');
      newTask = '';
    } catch (err) {
      console.error('Error adding task:', err);
      addToast('Gagal menambahkan task.', 'error');
    } finally {
      isAdding = false;
    }
  }

  async function toggleTask(task) {
    const oldDone = task.done;
    task.done = !task.done;
    tasks = [...tasks];
    try {
      const { error } = await supabase.from('tasks').update({ done: task.done }).eq('id', task.id);
      if (error) {
        task.done = oldDone;
        tasks = [...tasks];
        throw error;
      }
    } catch (err) {
      console.error('Error toggling task:', err);
      addToast('Gagal mengubah status task.', 'error');
    }
  }

  function confirmDelete(task = null) {
    deleteTarget = task;
    showDeleteModal = true;
  }

  async function doDelete() {
    try {
      if (deleteTarget) {
        const { error } = await supabase.from('tasks').delete().eq('id', deleteTarget.id);
        if (error) throw error;
        tasks = tasks.filter(t => t.id !== deleteTarget.id);
        addToast('Task berhasil dihapus!', 'info');
      } else {
        const ids = tasks.map(t => t.id);
        const { error } = await supabase.from('tasks').delete().in('id', ids);
        if (error) throw error;
        tasks = [];
        addToast('Semua task berhasil dihapus!', 'info');
      }
      showDeleteModal = false;
    } catch (err) {
      console.error('Error deleting task(s):', err);
      addToast('Gagal menghapus task.', 'error');
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
      const { data, error } = await supabase
        .from('tasks')
        .update({ text: editText.trim() })
        .eq('id', taskToEdit.id)
        .select();

      if (error) throw error;

      tasks = tasks.map(t => t.id === taskToEdit.id ? { ...t, text: data[0].text } : t);

      addToast('Task berhasil diperbarui!', 'success');
      showEditModal = false;
    } catch (err) {
      console.error('Error saving edit:', err);
      addToast('Gagal memperbarui task.', 'error');
    }
  }

  function handleEditKeydown(e) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') showEditModal = false;
  }

  function handleKeyDown(e) {
    if ((showDeleteModal || showEditModal) && e.key === 'Escape') {
      showDeleteModal = false;
      showEditModal = false;
    }
    if (showDeleteModal && e.key === 'Enter') {
      doDelete();
    }
  }

  function backdropClick(e) {
    if (e.target.classList.contains('modal-backdrop')) {
      showDeleteModal = false;
      showEditModal = false;
    }
  }

  $: completedCount = tasks.filter(t => t.done).length;
  $: totalCount = tasks.length;
  $: progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  $: hasTasks = totalCount > 0;
</script>

<Toast />

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
            class="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
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
      <ul class="space-y-3 mb-6">
        {#each tasks as task (task.id)}
          <li
            class="task-item flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200/50"
            in:fly={{ y: 20, duration: 300 }}
            out:fly={{ y: -20, duration: 300 }}
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <input type="checkbox" checked={task.done} on:change={() => toggleTask(task)} class="w-5 h-5 rounded border-2 text-blue-500 focus:ring-blue-400 focus:ring-opacity-25 cursor-pointer"/>
              <span class:line-through={task.done} class:opacity-60={task.done} class="truncate transition-all">{task.text}</span>
            </div>
            <div class="flex gap-2 ml-2">
              <button on:click={() => openEdit(task)} class="p-2 hover:bg-slate-200 rounded-full transition-all"><Pencil size={16}/></button>
              <button on:click={() => confirmDelete(task)} class="p-2 hover:bg-red-100 rounded-full transition-all text-red-500"><Trash2 size={16}/></button>
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
      <button on:click={() => confirmDelete()} class="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-medium">Hapus Semua</button>
    {/if}
  </div>

  {#if showDeleteModal}
    <div
      class="modal-backdrop fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      on:click={backdropClick}
      on:keydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') backdropClick(e); }}
      tabindex="0"
      role="dialog"
      aria-modal="true"
      transition:fade>
      <div transition:scale={{ duration: 200 }} class="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full space-y-4">
        <h3 class="font-bold text-lg text-slate-800">Konfirmasi</h3>
        <p>
          {#if deleteTarget}
            Apakah kamu yakin ingin menghapus task <b>"{deleteTarget.text}"</b>?
          {:else}
            Apakah kamu yakin ingin menghapus semua task?
          {/if}
        </p>
        <div class="flex justify-end gap-3 mt-4">
          <button on:click={() => showDeleteModal = false} class="px-4 py-2 rounded-xl bg-slate-200">Batal</button>
          <button on:click={doDelete} class="px-4 py-2 rounded-xl bg-red-500 text-white">Hapus</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showEditModal}
    <div
      class="modal-backdrop fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      on:click={backdropClick}
      on:keydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') backdropClick(e); }}
      tabindex="0"
      role="dialog"
      aria-modal="true"
      transition:fade>
      <div transition:scale={{ duration: 200 }} class="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full space-y-4">
        <h3 class="font-bold text-lg text-slate-800">Edit Task</h3>
        <input
          bind:this={editInputEl}
          bind:value={editText}
          on:keydown={handleEditKeydown}
          class="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring"
        />
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
