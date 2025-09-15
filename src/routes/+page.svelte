<script>
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let tasks = [];
  let newTask = '';

  let showDeleteAllModal = false;
  let showEditModal = false;
  let taskToEdit = null;
  let editText = '';
  let editInputEl;

  // Load tasks pertama kali + setup realtime
  onMount(async () => {
    await loadTasks();

    // Realtime listener
    supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('Realtime event:', payload);
          if (payload.eventType === 'INSERT') {
            tasks = [...tasks, payload.new];
          }
          if (payload.eventType === 'UPDATE') {
            tasks = tasks.map((t) =>
              t.id === payload.new.id ? payload.new : t
            );
          }
          if (payload.eventType === 'DELETE') {
            tasks = tasks.filter((t) => t.id !== payload.old.id);
          }
        }
      )
      .subscribe();
  });

  // Ambil semua data
  async function loadTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error) tasks = data ?? [];
    else console.error(error.message);
  }

  // Tambah task
  async function addTask() {
    const text = newTask.trim();
    if (!text) return;

    // Optimistic update
    const tempId = Date.now();
    const tempTask = { id: tempId, text, done: false };
    tasks = [...tasks, tempTask];
    newTask = '';

    const { error } = await supabase
      .from('tasks')
      .insert([{ text, done: false }]);
    if (error) console.error(error.message);
  }

  // Toggle done
  async function toggleTask(id, done) {
    tasks = tasks.map((t) =>
      t.id === id ? { ...t, done: !done } : t
    );
    const { error } = await supabase
      .from('tasks')
      .update({ done: !done })
      .eq('id', id);
    if (error) console.error(error.message);
  }

  // Hapus task
  async function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error(error.message);
  }

  // Hapus semua
  function confirmClearAll() {
    showDeleteAllModal = true;
  }
  async function clearAll() {
    tasks = [];
    const { error } = await supabase.from('tasks').delete().neq('id', 0);
    if (error) console.error(error.message);
    showDeleteAllModal = false;
  }

  // Edit
  function openEdit(task) {
    taskToEdit = task;
    editText = task.text;
    showEditModal = true;
    setTimeout(() => {
      editInputEl?.focus();
      editInputEl?.select();
    }, 0);
  }
  async function saveEdit() {
    if (taskToEdit && editText.trim() !== '') {
      tasks = tasks.map((t) =>
        t.id === taskToEdit.id ? { ...t, text: editText.trim() } : t
      );
      const { error } = await supabase
        .from('tasks')
        .update({ text: editText.trim() })
        .eq('id', taskToEdit.id);
      if (error) console.error(error.message);
      showEditModal = false;
    }
  }
  function handleEditKeydown(e) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') showEditModal = false;
  }

  // Progress
  $: completed = tasks.filter((t) => t.done).length;
  $: progress =
    tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
</script>

<main class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
  <div class="w-full max-w-md rounded-2xl shadow-lg p-6 bg-white">
    <h1 class="text-2xl font-bold text-center mb-4">📝 To-Do List</h1>

    <!-- Progress -->
    <div class="mb-4">
      <div class="flex justify-between text-sm mb-1">
        <span class="font-medium text-gray-700">Progress</span>
        <span class="text-gray-500">{progress}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3">
        <div
          class="bg-blue-500 h-3 rounded-full transition-all duration-300"
          style="width: {progress}%"
        ></div>
      </div>
    </div>

    <!-- Input -->
    <div class="flex gap-2 mb-4">
      <input
        type="text"
        bind:value={newTask}
        placeholder="Tambah tugas baru..."
        class="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        on:keydown={(e) => e.key === 'Enter' && addTask()}
      />
      <button
        type="button"
        on:click={addTask}
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
      >
        Add
      </button>
    </div>

    <!-- List -->
    {#if tasks.length > 0}
      <ul class="space-y-3 mb-4">
        {#each tasks as task (task.id)}
          <li
            in:fly={{ y: 20, duration: 200 }}
            out:fade={{ duration: 150 }}
            class="flex items-center justify-between p-3 rounded-lg shadow-sm bg-gray-50"
          >
            <div class="flex items-center gap-3">
              <input
                id={"checkbox-" + task.id}
                type="checkbox"
                checked={task.done}
                on:change={() => toggleTask(task.id, task.done)}
                class="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-400"
              />
              <label
                for={"checkbox-" + task.id}
                class="cursor-pointer transition"
                class:line-through={task.done}
                class:opacity-60={task.done}
              >
                {task.text}
              </label>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                on:click={() => openEdit(task)}
                class="text-yellow-500 hover:text-yellow-700 transition"
              >
                ✏️
              </button>
              <button
                type="button"
                on:click={() => deleteTask(task.id)}
                class="text-red-500 hover:text-red-700 transition"
              >
                ✕
              </button>
            </div>
          </li>
        {/each}
      </ul>

      <button
        type="button"
        on:click={confirmClearAll}
        class="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
      >
        Hapus Semua
      </button>
    {:else}
      <p class="text-center text-gray-500">Belum ada tugas 🎉</p>
    {/if}

    <!-- Modal Hapus Semua -->
    {#if showDeleteAllModal}
      <div
        class="fixed inset-0 bg-black/25 flex items-center justify-center z-50"
        in:fade
        out:fade
        on:click={() => (showDeleteAllModal = false)}
      >
        <div
          class="bg-white rounded-xl shadow-lg p-6 w-80"
          on:click|stopPropagation
        >
          <h2 class="text-lg font-bold mb-3 text-gray-800">
            Hapus Semua Tugas?
          </h2>
          <p class="text-gray-600 mb-5 text-sm">
            Semua tugas akan dihapus permanen. Yakin lanjut?
          </p>
          <div class="flex justify-end gap-3">
            <button
              on:click={() => (showDeleteAllModal = false)}
              class="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
            >
              Batal
            </button>
            <button
              on:click={clearAll}
              class="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Modal Edit -->
    {#if showEditModal}
      <div
        class="fixed inset-0 bg-black/25 flex items-center justify-center z-50"
        in:fade
        out:fade
        on:click={() => (showEditModal = false)}
      >
        <div
          class="bg-white rounded-xl shadow-lg p-6 w-96"
          on:click|stopPropagation
        >
          <h2 class="text-lg font-bold mb-4 text-gray-800">Edit Tugas</h2>
          <input
            type="text"
            bind:this={editInputEl}
            bind:value={editText}
            class="w-full border rounded-lg p-2 mb-4"
            placeholder="Ubah nama tugas..."
            on:keydown={handleEditKeydown}
          />
          <div class="flex justify-end gap-3">
            <button
              on:click={() => (showEditModal = false)}
              class="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
            >
              Batal
            </button>
            <button
              on:click={saveEdit}
              class="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition"
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
    color: #9ca3af;
  }
</style>
