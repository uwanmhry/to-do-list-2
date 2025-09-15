<script>
  import { onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { supabase } from '$lib/supabaseClient';

  let tasks = [];
  let newTask = "";
  let showEditModal = false;
  let showDeleteAllModal = false;
  let taskToEdit = null;
  let editText = "";

  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').order('created_at');
    tasks = data;
  }

  onMount(() => {
    loadTasks();

    supabase
      .from('tasks')
      .on('*', payload => loadTasks())
      .subscribe();
  });

  async function addTask() {
    if (!newTask.trim()) return;
    await supabase.from('tasks').insert([{ text: newTask }]);
    newTask = "";
  }

  async function toggleTask(task) {
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id);
  }

  async function deleteTask(task) {
    await supabase.from('tasks').delete().eq('id', task.id);
  }

  function openEdit(task) {
    taskToEdit = task;
    editText = task.text;
    showEditModal = true;
  }

  async function saveEdit() {
    if (!taskToEdit || !editText.trim()) return;
    await supabase.from('tasks').update({ text: editText }).eq('id', taskToEdit.id);
    showEditModal = false;
  }

  function confirmClearAll() {
    showDeleteAllModal = true;
  }

  async function clearAll() {
    await supabase.from('tasks').delete();
    showDeleteAllModal = false;
  }

  $: completed = tasks.filter(t => t.done).length;
  $: progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
</script>

<main class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
  <div class="w-full max-w-md rounded-2xl shadow-lg p-6 bg-white">
    <h1 class="text-2xl font-bold text-center mb-4">📝 To-Do List</h1>

    <!-- Progress bar -->
    <div class="mb-4">
      <div class="flex justify-between text-sm mb-1">
        <span class="font-medium text-gray-700">Progress</span>
        <span class="text-gray-500">{progress}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3">
        <div class="bg-blue-500 h-3 rounded-full transition-all duration-300" style="width: {progress}%"></div>
      </div>
    </div>

    <!-- Input -->
    <div class="flex gap-2 mb-4">
      <input type="text" bind:value={newTask} placeholder="Tambah tugas baru..." class="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" on:keydown={(e)=>e.key==="Enter"&&addTask()}/>
      <button type="button" on:click={addTask} class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">Add</button>
    </div>

    <!-- Task list -->
    {#if tasks.length > 0}
      <ul class="space-y-3 mb-4">
        {#each tasks as task (task.id)}
          <li in:fly={{y:20,duration:250}} out:fade={{duration:200}} class="flex items-center justify-between p-3 rounded-lg shadow-sm bg-gray-50">
            <div class="flex items-center gap-3">
              <input type="checkbox" checked={task.done} on:change={()=>toggleTask(task)} class="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-400"/>
              <span class:line-through={task.done} class:opacity-60={task.done}>{task.text}</span>
            </div>
            <div class="flex gap-2">
              <button type="button" on:click={()=>openEdit(task)} class="text-yellow-500 hover:text-yellow-700 transition">✏️</button>
              <button type="button" on:click={()=>deleteTask(task)} class="text-red-500 hover:text-red-700 transition">✕</button>
            </div>
          </li>
        {/each}
      </ul>
      <button type="button" on:click={confirmClearAll} class="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">Hapus Semua</button>
    {:else}
      <p class="text-center text-gray-500">Belum ada tugas 🎉</p>
    {/if}

    <!-- Modal Edit -->
    {#if showEditModal}
      <div class="fixed inset-0 bg-black/25 flex items-center justify-center z-50" on:click={()=>showEditModal=false}>
        <div class="bg-white rounded-xl shadow-lg p-6 w-96" on:click|stopPropagation>
          <h2 class="text-lg font-bold mb-4">Edit Tugas</h2>
          <input type="text" bind:value={editText} class="w-full border rounded-lg p-2 mb-4" on:keydown={(e)=>e.key==="Enter"&&saveEdit()}/>
          <div class="flex justify-end gap-3">
            <button type="button" on:click={()=>showEditModal=false} class="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition">Batal</button>
            <button type="button" on:click={saveEdit} class="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition">Simpan</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Modal Delete All -->
    {#if showDeleteAllModal}
      <div class="fixed inset-0 bg-black/25 flex items-center justify-center z-50" on:click={()=>showDeleteAllModal=false}>
        <div class="bg-white rounded-xl shadow-lg p-6 w-80" on:click|stopPropagation>
          <h2 class="text-lg font-bold mb-3">Hapus Semua Tugas?</h2>
          <p class="text-gray-600 mb-5 text-sm">Semua tugas akan dihapus permanen. Yakin lanjut?</p>
          <div class="flex justify-end gap-3">
            <button type="button" on:click={()=>showDeleteAllModal=false} class="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition">Batal</button>
            <button type="button" on:click={clearAll} class="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition">Ya, Hapus</button>
          </div>
        </div>
      </div>
    {/if}

  </div>
</main>

<style>
  .line-through { text-decoration: line-through; color:#9ca3af; }
</style>
