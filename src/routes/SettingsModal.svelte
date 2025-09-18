<script>
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  const dispatch = createEventDispatcher();

  export let session;
  export let userProfile;

  let currentEmail = '';
  let newEmail = '';
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';
  let activeTab = 'email';

  $: if (session) {
    currentEmail = session.user.email;
  }

  function closeModal() {
    dispatch('close');
  }

  async function updateEmail() {
    if (!newEmail.trim() || newEmail === currentEmail) {
      errorMessage = 'Masukkan email baru yang berbeda';
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      errorMessage = 'Format email tidak valid';
      return;
    }

    try {
      loading = true;
      errorMessage = '';
      successMessage = '';

      // 1. Update email di Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail.trim()
      });

      if (authError) throw authError;

      // 2. Force update email di table profiles (backup jika trigger tidak bekerja)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          email: newEmail.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);

      if (profileError) {
        console.error('Error updating profile email:', profileError);
        // Tetap lanjutkan karena auth sudah berhasil
      }

      // 3. Refresh session untuk memastikan data terbaru
      const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && newSession) {
        // Dispatch event untuk memberitahu parent component tentang session update
        window.dispatchEvent(new CustomEvent('sessionUpdated', {
          detail: { session: newSession }
        }));
      }

      successMessage = `Email verifikasi telah dikirim ke ${currentEmail}. Silakan cek email lama Anda untuk konfirmasi. Setelah verifikasi, email akan otomatis diperbarui di sistem.`;
      newEmail = '';

    } catch (error) {
      console.error('Error updating email:', error);
      if (error.message.includes('already registered')) {
        errorMessage = 'Email sudah terdaftar';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Terlalu banyak percobaan. Coba lagi nanti.';
      } else {
        errorMessage = error.message;
      }
    } finally {
      loading = false;
    }
  }

  async function updatePassword() {
    if (!newPassword || !currentPassword) {
      errorMessage = 'Harap isi semua field password';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      errorMessage = 'Password baru dan konfirmasi password tidak cocok';
      return;
    }

    if (newPassword.length < 6) {
      errorMessage = 'Password minimal 6 karakter';
      return;
    }

    try {
      loading = true;
      errorMessage = '';
      successMessage = '';

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword
      });

      if (signInError) {
        if (signInError.message === 'Invalid login credentials') {
          throw new Error('Password saat ini salah');
        }
        throw signInError;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      successMessage = 'Password berhasil diubah!';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';

    } catch (error) {
      console.error('Error updating password:', error);
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  // Handle Enter key untuk form
  function handleKeyPress(event, action) {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  }
</script>

<div
  class="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50"
  on:click|self={closeModal}
  style="backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);"
>
  <div 
    class="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
    on:click|stopPropagation
  >
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-800">Pengaturan Akun</h2>
        <button on:click={closeModal} class="text-gray-400 hover:text-gray-600 transition-colors">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex border-b border-gray-200 mb-6">
        <button class:font-semibold={activeTab === 'email'} class:text-blue-600={activeTab === 'email'} class:text-gray-600={activeTab !== 'email'} class="px-4 py-2 border-b-2 border-transparent hover:border-blue-600 transition-colors" on:click={() => activeTab = 'email'}>
          Ganti Email
        </button>
        <button class:font-semibold={activeTab === 'password'} class:text-blue-600={activeTab === 'password'} class:text-gray-600={activeTab !== 'password'} class="px-4 py-2 border-b-2 border-transparent hover:border-blue-600 transition-colors" on:click={() => activeTab = 'password'}>
          Ganti Password
        </button>
      </div>

      {#if errorMessage}
        <div class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {errorMessage}
        </div>
      {/if}

      {#if successMessage}
        <div class="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
          {successMessage}
        </div>
      {/if}

      {#if activeTab === 'email'}
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Saat Ini</label>
            <input type="email" bind:value={currentEmail} disabled class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Baru</label>
            <input 
              type="email" 
              bind:value={newEmail} 
              placeholder="Masukkan email baru" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              on:keypress={(e) => handleKeyPress(e, updateEmail)}
            />
          </div>

          <button on:click={updateEmail} disabled={loading || !newEmail.trim() || newEmail === currentEmail} class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Mengirim...' : 'Kirim Verifikasi Email'}
          </button>

          <div class="p-3 bg-blue-50 rounded-lg">
            <p class="text-xs text-blue-700 font-medium">📧 Proses Verifikasi Email:</p>
            <ul class="text-xs text-blue-600 mt-1 space-y-1">
              <li>• Verifikasi dikirim ke email <span class="font-semibold">LAMA</span> ({currentEmail})</li>
              <li>• Cek INBOX dan SPAM folder email lama</li>
              <li>• Klik link verifikasi di email lama</li>
              <li>• Setelah verifikasi, email akan berubah ke yang baru</li>
              <li>• Login kembali dengan email baru</li>
            </ul>
          </div>
        </div>
      {/if}

      {#if activeTab === 'password'}
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
            <input 
              type="password" 
              bind:value={currentPassword} 
              placeholder="Masukkan password saat ini" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              on:keypress={(e) => handleKeyPress(e, updatePassword)}
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
            <input 
              type="password" 
              bind:value={newPassword} 
              placeholder="Masukkan password baru (min. 6 karakter)" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              on:keypress={(e) => handleKeyPress(e, updatePassword)}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
            <input 
              type="password" 
              bind:value={confirmPassword} 
              placeholder="Konfirmasi password baru" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              on:keypress={(e) => handleKeyPress(e, updatePassword)}
            />
          </div>

          <button on:click={updatePassword} disabled={loading || !currentPassword || !newPassword || !confirmPassword} class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Mengubah...' : 'Ubah Password'}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>