<script>
  import Toast from '$lib/components/Toast.svelte';
  import Auth from '$lib/components/Auth.svelte';
  import { addToast } from '$lib/stores/toast';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { Plus, Pencil, Trash2, LogOut, AlertCircle, CheckCircle, Circle, Loader } from 'lucide-svelte';
  import { fly, fade, scale } from 'svelte/transition';

  let tasks = [];
  let newTask = '';
  let isLoading = true;
  let isAdding = false;
  let user = null;

  // 🔥 modal konfirmasi (bisa untuk 1 task atau semua)
  let showDeleteModal = false;
  let deleteTarget = null;

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
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
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
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      user = session?.user || null;
      if (user) {
        // Periksa apakah email sudah terverifikasi
        if (!user.email_confirmed_at && user.confirmed_at) {
          // Jika baru saja dikonfirmasi melalui redirect
          user.email_confirmed_at = user.confirmed_at;
        }
        
        if (!user.email_confirmed_at) {
          addToast('Silakan verifikasi email Anda untuk mengakses fitur lengkap.', 'warning');
        }
        loadTasks();
      } else {
        isLoading = false;
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session) {
        user = session.user;
        
        // Force token refresh untuk memastikan status email terupdate
        try {
          const { data: { user: refreshedUser } } = await supabase.auth.getUser();
          if (refreshedUser) {
            user = refreshedUser;
          }
        } catch (error) {
          console.error('Error refreshing user:', error);
        }
        
        if (!user.email_confirmed_at) {
          addToast('Silakan verifikasi email Anda untuk mengakses fitur lengkap.', 'warning');
        } else {
          addToast('Login berhasil!', 'success');
        }
        loadTasks();
      } 
      else if (event === 'USER_UPDATED') {
        // Tangani ketika user mengkonfirmasi email
        if (session?.user) {
          user = session.user;
          if (user.email_confirmed_at) {
            addToast('Email berhasil diverifikasi!', 'success');
            loadTasks();
          }
        }
      } 
      else if (event === 'SIGNED_OUT') {
        user = null;
        tasks = [];
        addToast('Anda telah logout', 'info');
      }
      else if (event === 'TOKEN_REFRESHED') {
        // Refresh user data ketika token diperbarui
        if (session?.user) {
          user = session.user;
        }
      }
    });

    // 🎹 global key handler (ESC & ENTER)
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      subscription?.unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  async function addTask() {
    const text = newTask.trim();
    if (!text || isAdding || !user) return;

    isAdding = true;
    try {
      const newTaskObj = { 
        id: generateId(5), 
        text, 
        done: false,
        user_id: user.id 
      };
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
    if (!user) return;
    
    const oldDone = task.done;
    task.done = !task.done;
    tasks = [...tasks];
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ done: task.done })
        .eq('id', task.id)
        .eq('user_id', user.id);
      if (error) {
        task.done = oldDone;
        tasks = [...tasks];
        throw error;
      }
      
      if (task.done) {
        addToast('Task diselesaikan! 🎉', 'success');
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
    if (!user) return;
    
    try {
      if (deleteTarget) {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', deleteTarget.id)
          .eq('user_id', user.id);
        if (error) throw error;
        tasks = tasks.filter(t => t.id !== deleteTarget.id);
        addToast('Task berhasil dihapus!', 'info');
      } else {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('user_id', user.id);
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
    if (!taskToEdit || !editText.trim() || !user) {
      showEditModal = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ text: editText.trim() })
        .eq('id', taskToEdit.id)
        .eq('user_id', user.id)
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

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Error logging out:', err);
      addToast('Gagal logout.', 'error');
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
  $: pendingTasks = tasks.filter(t => !t.done).length;
</script>

<Toast />

{#if !user}
  <!-- Tampilkan komponen Auth terpisah -->
  <Auth />
{:else}
  <!-- Tampilkan halaman utama dengan tasks -->
  <main class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 md:px-6">
    <div class="max-w-2xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-100">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h1 class="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <span class="text-blue-500">📝</span> To-Do List
            </h1>
            <p class="text-slate-600 mt-1">Halo, {user.email}</p>
          </div>
          <button 
            on:click={handleLogout} 
            class="p-2 hover:bg-slate-100 rounded-full transition-all flex items-center gap-2 text-slate-600"
            title="Logout"
          >
            <LogOut size={18} />
            <span class="hidden sm:inline text-sm">Logout</span>
          </button>
        </div>

        {#if user && !user.email_confirmed_at}
          <!-- 🔥 Banner peringatan email belum terverifikasi -->
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div class="flex">
              <div class="flex-shrink-0">
                <AlertCircle size={20} class="text-yellow-400" />
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-yellow-800">
                  Verifikasi Email Diperlukan
                </h3>
                <div class="mt-2 text-sm text-yellow-700">
                  <p>
                    Akun Anda belum terverifikasi. Silakan cek email Anda dan klik link verifikasi yang telah kami kirim ke <strong>{user.email}</strong>.
                  </p>
                  <button 
                    on:click={() => {
                      supabase.auth.resend({
                        type: 'signup',
                        email: user.email
                      }).then(({ error }) => {
                        if (error) {
                          addToast('Gagal mengirim ulang email verifikasi.', 'error');
                        } else {
                          addToast('Email verifikasi telah dikirim ulang!', 'success');
                        }
                      });
                    }}
                    class="font-medium underline mt-2 text-yellow-800 hover:text-yellow-900"
                  >
                    Kirim ulang email verifikasi
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Progress Section -->
        {#if hasTasks}
          <div class="mb-6">
            <div class="flex justify-between items-center mb-3">
              <span class="font-medium text-slate-700">Progress Tugas</span>
              <span class="text-slate-500 text-sm">{completedCount}/{totalCount} ({progress}%)</span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                class="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={`width: ${progress}%`}
              ></div>
            </div>
            <div class="flex justify-between text-xs text-slate-500 mt-2">
              <span>{pendingTasks} tugas pending</span>
              <span>{completedCount} tugas selesai</span>
            </div>
          </div>
        {/if}

        <!-- Add Task Form -->
        <div class="flex gap-2 mb-6">
          <input
            type="text"
            bind:value={newTask}
            placeholder="Apa yang ingin kamu lakukan hari ini?"
            class="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            on:keydown={(e) => e.key === 'Enter' && addTask()}
            disabled={isLoading}
          />
          <button
            on:click={addTask}
            class="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all flex items-center gap-1.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] justify-center"
            disabled={isLoading || !newTask.trim() || isAdding}
          >
            {#if isAdding}
              <Loader size={18} class="animate-spin" />
              <span class="hidden sm:inline">Menambah...</span>
            {:else}
              <Plus size={18} />
              <span class="hidden sm:inline">Tambah</span>
            {/if}
          </button>
        </div>
      </div>

      <!-- Tasks List -->
      <div class="bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
        {#if isLoading}
          <div class="flex justify-center py-12">
            <Loader size={32} class="animate-spin text-blue-500" />
          </div>
        {:else if hasTasks}
          <div class="mb-4">
            <h2 class="text-xl font-semibold text-slate-800">Daftar Tugas</h2>
            <p class="text-slate-600 text-sm mt-1">Kelola tugas harian Anda</p>
          </div>
          
          <ul class="space-y-3 mb-6">
            {#each tasks as task (task.id)}
              <li
                class="task-item flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200/50 group"
                in:fly={{ y: 20, duration: 300 }}
                out:fly={{ y: -20, duration: 300 }}
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    on:click={() => toggleTask(task)}
                    class={`p-1 rounded-full transition-all ${
                      task.done 
                        ? 'text-green-500 bg-green-100 hover:bg-green-200' 
                        : 'text-slate-400 hover:text-blue-500 hover:bg-slate-200'
                    }`}
                    title={task.done ? 'Tandai belum selesai' : 'Tandai selesai'}
                  >
                    {#if task.done}
                      <CheckCircle size={22} class="fill-current" />
                    {:else}
                      <Circle size={22} />
                    {/if}
                  </button>
                  <span 
                    class:line-through={task.done} 
                    class:opacity-60={task.done} 
                    class="truncate transition-all text-slate-800"
                  >
                    {task.text}
                  </span>
                </div>
                <div class="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    on:click={() => openEdit(task)} 
                    class="p-2 hover:bg-blue-100 rounded-full transition-all text-blue-500"
                    title="Edit task"
                  >
                    <Pencil size={16}/>
                  </button>
                  <button 
                    on:click={() => confirmDelete(task)} 
                    class="p-2 hover:bg-red-100 rounded-full transition-all text-red-500"
                    title="Hapus task"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              </li>
            {/each}
          </ul>

          <div class="flex gap-3 pt-4 border-t border-slate-200">
            <button 
              on:click={() => confirmDelete()} 
              class="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Hapus Semua Task
            </button>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <div class="bg-blue-100 p-4 rounded-full">
              <CheckCircle size={36} class="text-blue-400" />
            </div>
            <p class="text-lg font-medium text-slate-600">Tidak ada tugas</p>
            <p class="text-sm text-slate-500 text-center">Tambahkan tugas pertama Anda untuk memulai</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    {#if showDeleteModal}
      <div
        class="modal-backdrop fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        on:click={backdropClick}
        on:keydown={handleKeyDown}
        tabindex="0"
        role="dialog"
        aria-modal="true"
        transition:fade
      >
        <div 
          transition:scale={{ duration: 200 }} 
          class="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full space-y-4"
        >
          <div class="bg-red-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} class="text-red-500" />
          </div>
          <h3 class="font-bold text-lg text-center text-slate-800">Konfirmasi Hapus</h3>
          <p class="text-slate-600 text-center">
            {#if deleteTarget}
              Apakah kamu yakin ingin menghapus task <b>"{deleteTarget.text}"</b>?
            {:else}
              Apakah kamu yakin ingin menghapus semua task? Tindakan ini tidak dapat dibatalkan.
            {/if}
          </p>
          <div class="flex justify-center gap-3 mt-6">
            <button 
              on:click={() => showDeleteModal = false} 
              class="px-6 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all"
            >
              Batal
            </button>
            <button 
              on:click={doDelete} 
              class="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Edit Task Modal -->
    {#if showEditModal}
      <div
        class="modal-backdrop fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        on:click={backdropClick}
        on:keydown={handleKeyDown}
        tabindex="0"
        role="dialog"
        aria-modal="true"
        transition:fade
      >
        <div 
          transition:scale={{ duration: 200 }} 
          class="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full space-y-4"
        >
          <div class="bg-blue-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mx-auto mb-4">
            <Pencil size={24} class="text-blue-500" />
          </div>
          <h3 class="font-bold text-lg text-center text-slate-800">Edit Task</h3>
          <input
            bind:this={editInputEl}
            bind:value={editText}
            on:keydown={handleEditKeydown}
            class="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="Edit task..."
          />
          <div class="flex justify-center gap-3 mt-6">
            <button 
              on:click={() => showEditModal = false} 
              class="px-6 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all"
            >
              Batal
            </button>
            <button 
              on:click={saveEdit} 
              class="px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    {/if}
  </main>
{/if}

<style>
  .line-through { 
    text-decoration: line-through; 
    text-decoration-thickness: 2px;
  }
  .opacity-60 { 
    opacity: 0.6; 
  }
  
  /* Smooth transitions for all interactive elements */
  button, input, .task-item {
    transition: all 0.2s ease-in-out;
  }
  
  /* Custom scrollbar for task list */
  .task-list {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }
  
  .task-list::-webkit-scrollbar {
    width: 6px;
  }
  
  .task-list::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  
  .task-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  
  .task-list::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>