<script>
  import { supabase } from '$lib/supabaseClient';

  let email = '';
  let password = '';
  let username = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';
  let authView = 'signin';

  function resetMessages() {
    errorMessage = '';
    successMessage = '';
  }

  async function isEmailRegistered(email) {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false
        }
      });
      
      return !error;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  }

  async function handleSignUp() {
    try {
      resetMessages();
      loading = true;
      
      if (!username.trim()) throw new Error('Username harus diisi');
      if (!email.trim()) throw new Error('Email harus diisi');
      if (!password) throw new Error('Password harus diisi');
      if (password.length < 6) throw new Error('Password minimal 6 karakter');

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim()
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { 
              id: authData.user.id, 
              username: username.trim(),
              email: email
            }
          ]);

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }

      successMessage = 'Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi.';
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  async function handleSignIn() {
    try {
      resetMessages();
      loading = true;
      
      if (!email.trim()) throw new Error('Email harus diisi');
      if (!password) throw new Error('Password harus diisi');

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          const emailRegistered = await isEmailRegistered(email);
          if (emailRegistered) {
            throw new Error('Password salah');
          } else {
            throw new Error('Email tidak terdaftar');
          }
        }
        throw error;
      }
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  async function handlePasswordReset() {
    try {
      resetMessages();
      loading = true;
      
      if (!email.trim()) throw new Error('Email harus diisi');

      const emailRegistered = await isEmailRegistered(email);
      if (!emailRegistered) throw new Error('Email tidak terdaftar');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) throw error;

      successMessage = 'Link reset password telah dikirim ke email Anda!';
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  // Handle Enter key for forms
  function handleKeyPress(event, action) {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  }
</script>

<div class="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-6 space-y-6">
  <header class="text-center">
    <h1 class="text-3xl font-bold text-blue-700 mb-2">Todo List</h1>
    <p class="text-blue-500">Silakan masuk atau daftar untuk mulai</p>
  </header>
  
  {#if errorMessage}
    <div class="p-3 bg-red-100 text-red-700 rounded-lg">
      {errorMessage}
    </div>
  {/if}
  
  {#if successMessage}
    <div class="p-3 bg-green-100 text-green-700 rounded-lg">
      {successMessage}
    </div>
  {/if}
  
  <div class="space-y-4">
    {#if authView === 'signup'}
      <div>
        <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
        <input
          bind:value={username}
          type="text"
          id="username"
          class="w-full px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nama pengguna"
          on:keypress={(e) => handleKeyPress(e, handleSignUp)}
        />
      </div>
    {/if}
    
    <div>
      <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
      <input
        bind:value={email}
        type="email"
        id="email"
        class="w-full px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="email@example.com"
        on:keypress={(e) => {
          if (authView === 'signin') handleKeyPress(e, handleSignIn);
          else if (authView === 'signup') handleKeyPress(e, handleSignUp);
          else if (authView === 'forgotten') handleKeyPress(e, handlePasswordReset);
        }}
      />
    </div>
    
    {#if authView !== 'forgotten'}
      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          bind:value={password}
          type="password"
          id="password"
          class="w-full px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Password Anda"
          on:keypress={(e) => {
            if (authView === 'signin') handleKeyPress(e, handleSignIn);
            else if (authView === 'signup') handleKeyPress(e, handleSignUp);
          }}
        />
        {#if authView === 'signup'}
          <p class="text-xs text-gray-500 mt-1">Minimal 6 karakter</p>
        {/if}
      </div>
    {/if}
    
    <div class="flex flex-col space-y-2">
      {#if authView === 'signin'}
        <button
          on:click={handleSignIn}
          class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Masuk'}
        </button>
        <div class="flex justify-between text-sm">
          <button on:click={() => { authView = 'forgotten'; resetMessages(); }} class="text-blue-500 hover:text-blue-700">
            Lupa password?
          </button>
          <button on:click={() => { authView = 'signup'; resetMessages(); }} class="text-blue-500 hover:text-blue-700">
            Daftar akun baru
          </button>
        </div>
      {:else if authView === 'signup'}
        <button
          on:click={handleSignUp}
          class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Daftar'}
        </button>
        <button on:click={() => { authView = 'signin'; resetMessages(); }} class="text-blue-500 hover:text-blue-700 text-sm">
          Sudah punya akun? Masuk
        </button>
      {:else if authView === 'forgotten'}
        <button
          on:click={handlePasswordReset}
          class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Kirim reset password'}
        </button>
        <button on:click={() => { authView = 'signin'; resetMessages(); }} class="text-blue-500 hover:text-blue-700 text-sm">
          Kembali ke halaman masuk
        </button>
      {/if}
    </div>
  </div>
</div>