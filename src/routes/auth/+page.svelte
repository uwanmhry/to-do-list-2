<script>
  import { supabase } from '$lib/supabaseClient';
  import { addToast } from '$lib/stores/toast';
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { navigate } from '$app/navigation';
  
  let isLogin = true;
  let email = '';
  let password = '';
  let confirmPassword = '';
  let isLoading = false;
  let errorMessage = '';
  let showEmailConfirmation = false;

  // Cek jika user sudah login, redirect ke home
  onMount(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/', { replace: true });
      }
    });
  });

  // Fungsi untuk membuka aplikasi email
  function openEmailClient() {
    window.open(`mailto:${email}`, '_blank');
  }

  async function handleAuth() {
    isLoading = true;
    errorMessage = '';
    showEmailConfirmation = false;
    
    try {
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password
        });
        
        if (error) {
          console.error('Login error:', error);
          
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email atau password salah');
          } else if (error.message.includes('Email not confirmed')) {
            // Kirim ulang email konfirmasi secara otomatis
            await resendConfirmation();
            throw new Error('Email belum dikonfirmasi. Kami telah mengirim ulang email konfirmasi ke inbox Anda.');
          } else {
            throw error;
          }
        }
        
        // Jika berhasil login, redirect ke home
        if (data?.user) {
          addToast('Login berhasil!', 'success');
          navigate('/', { replace: true });
        }
        
      } else {
        // Register
        if (password !== confirmPassword) {
          throw new Error('Password tidak cocok');
        }

        if (password.length < 6) {
          throw new Error('Password minimal 6 karakter');
        }
        
        // Tambahkan options untuk redirect
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`
          }
        });
        
        if (error) {
          console.error('Signup error:', error);
          
          if (error.message.includes('already registered')) {
            // Jika email sudah terdaftar tapi belum terverifikasi
            if (error.message.includes('not confirmed')) {
              await resendConfirmation();
              throw new Error('Email sudah terdaftar tetapi belum dikonfirmasi. Kami telah mengirim ulang email konfirmasi.');
            } else {
              throw new Error('Email sudah terdaftar. Silakan login atau gunakan email lain.');
            }
          } else {
            throw error;
          }
        }
        
        // Tampilkan pesan konfirmasi email
        if (data?.user && !data?.session) {
          showEmailConfirmation = true;
          addToast('Email konfirmasi telah dikirim! Silakan cek inbox Anda.', 'success');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      errorMessage = error.message;
    } finally {
      isLoading = false;
    }
  }
  
  function switchMode() {
    isLogin = !isLogin;
    errorMessage = '';
    showEmailConfirmation = false;
    password = '';
    confirmPassword = '';
  }
  
  function handleKeydown(e) {
    if (e.key === 'Enter') {
      handleAuth();
    }
  }

  // Fungsi kirim ulang email konfirmasi
  async function resendConfirmation() {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}`
        }
      });
      
      if (error) {
        console.error('Resend confirmation error:', error);
        throw new Error('Gagal mengirim ulang email konfirmasi: ' + error.message);
      }
      
      addToast('Email konfirmasi telah dikirim ulang! Silakan cek inbox Anda.', 'success');
      return true;
    } catch (error) {
      console.error('Resend error:', error);
      errorMessage = error.message;
      addToast(error.message, 'error');
      return false;
    }
  }

  function goToHome() {
    navigate('/');
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 border border-slate-100 relative">
    <button 
      on:click={goToHome} 
      class="absolute top-4 left-4 p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600"
      title="Kembali ke Home"
      aria-label="Kembali ke Home"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <h1 class="text-2xl font-bold text-center mb-6 text-slate-800">
      {isLogin ? 'Login' : 'Daftar Akun'}
    </h1>
    
    {#if errorMessage}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" transition:fade>
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
        </div>
      </div>
    {/if}
    
    {#if showEmailConfirmation}
      <!-- Pesan konfirmasi email -->
      <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4" transition:fade>
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <p class="text-sm font-medium text-blue-800">
              Konfirmasi Email Diperlukan
            </p>
            <p class="mt-1 text-sm text-blue-700">
              Kami telah mengirim email konfirmasi ke 
              <button on:click={openEmailClient} class="font-bold text-blue-800 hover:text-blue-900 underline">
                {email}
              </button>. 
              Silakan cek inbox (atau folder spam) dan klik link verifikasi.
            </p>
            <div class="mt-4 flex flex-col gap-2">
              <button 
                on:click={resendConfirmation}
                class="text-sm font-medium bg-blue-100 hover:bg-blue-200 text-blue-800 py-2 px-4 rounded-lg transition-colors"
              >
                ↻ Kirim Ulang Email Konfirmasi
              </button>
              <button 
                on:click={switchMode}
                class="text-sm font-medium text-blue-800 hover:text-blue-900 underline"
              >
                ← Kembali ke Login
              </button>
            </div>
            <p class="mt-3 text-xs text-blue-600">
              💡 Tips: Jika tidak menemukan email, cek folder spam atau promo.
            </p>
          </div>
        </div>
      </div>
    {/if}
    
    {#if !showEmailConfirmation}
      <form on:submit|preventDefault={handleAuth} class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="email@contoh.com"
            required
            on:keydown={handleKeydown}
          />
        </div>
        
        <div>
          <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            id="password"
            bind:value={password}
            class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Minimal 6 karakter"
            required
            on:keydown={handleKeydown}
          />
        </div>
        
        {#if !isLogin}
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password</label>
            <input
              type="password"
              id="confirmPassword"
              bind:value={confirmPassword}
              class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ulangi password"
              required
              on:keydown={handleKeydown}
            />
          </div>
        {/if}
        
        <button
          type="submit"
          class="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={isLoading}
        >
          {#if isLoading}
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {isLogin ? 'Login...' : 'Mendaftar...'}
          {:else}
            {isLogin ? 'Login' : 'Daftar'}
          {/if}
        </button>
      </form>
      
      <div class="mt-4 text-center">
        <button on:click={switchMode} class="text-blue-500 hover:text-blue-700 text-sm font-medium">
          {isLogin ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Login di sini'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  button:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
</style>