<script>
    import { supabase } from '$lib/supabaseClient';

    let email = '';
    let password = '';
    let username = '';
    let loading = false;
    let errorMessage = '';
    let successMessage = '';
    let authView = 'signin';
    let showPassword = false;

    function resetMessages() {
        errorMessage = '';
        successMessage = '';
    }

    function togglePasswordVisibility() {
        showPassword = !showPassword;
    }

    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    function isValidUsername(username) {
        const regex = /^[a-zA-Z0-9_]{3,20}$/;
        return regex.test(username);
    }

    async function handleSignUp() {
        try {
            resetMessages();
            loading = true;
            
            if (!username.trim()) throw new Error('Username wajib diisi.');
            if (!isValidUsername(username)) throw new Error('Username tidak valid. Gunakan 3-20 karakter huruf, angka, atau garis bawah.');
            if (!email.trim()) throw new Error('Alamat email wajib diisi.');
            if (!isValidEmail(email)) throw new Error('Format email tidak valid.');
            if (!password) throw new Error('Password wajib diisi.');
            if (password.length < 6) throw new Error('Password minimal harus 6 karakter.');
            
            const { data: existingUser, error: usernameError } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', username.trim())
                .single();

            if (existingUser) {
                throw new Error('Username sudah digunakan. Coba yang lain.');
            }

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username.trim()
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('Email rate limit exceeded')) {
                    throw new Error('Terlalu banyak permintaan. Coba lagi dalam beberapa menit.');
                }
                if (authError.message.includes('A user with this email address has already been registered')) {
                    throw new Error('Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.');
                }
                throw authError;
            }

            if (authData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([{ id: authData.user.id, username: username.trim(), email: email }]);
                
                if (profileError) {
                    console.error('Gagal membuat profil:', profileError);
                }
            }

            successMessage = 'Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi dan aktivasi akun.';
        } catch (error) {
            errorMessage = error.message || 'Terjadi kesalahan. Silakan coba lagi.';
        } finally {
            loading = false;
        }
    }

    async function handleSignIn() {
        try {
            resetMessages();
            loading = true;
            
            if (!email.trim()) throw new Error('Alamat email wajib diisi.');
            if (!password) throw new Error('Password wajib diisi.');

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Email atau password yang Anda masukkan salah. Mohon periksa kembali.');
                }
                if (error.message.includes('Email not confirmed')) {
                    throw new Error('Email belum diverifikasi. Silakan cek kotak masuk email Anda untuk link verifikasi.');
                }
                throw error;
            }
        } catch (error) {
            errorMessage = error.message || 'Terjadi kesalahan saat masuk. Silakan coba lagi.';
        } finally {
            loading = false;
        }
    }

    // Perbaikan utama ada di sini
    async function handlePasswordReset() {
        try {
            resetMessages();
            loading = true;
            
            if (!email.trim()) throw new Error('Alamat email wajib diisi.');

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback`,
            });

            if (error) {
                throw new Error('Terjadi kesalahan saat mengirim link reset. Silakan coba lagi nanti.');
            }

            successMessage = 'Link reset password telah dikirim ke email Anda (jika email terdaftar). Segera periksa kotak masuk.';
        } catch (error) {
            errorMessage = error.message || 'Terjadi kesalahan. Silakan coba lagi.';
        } finally {
            loading = false;
        }
    }

    function handleKeyPress(event, action) {
        if (event.key === 'Enter') {
            event.preventDefault();
            action();
        }
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
    <div class="absolute inset-0 opacity-20">
        <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div class="absolute top-3/4 right-1/4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-700"></div>
        <div class="absolute bottom-1/4 left-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
    </div>
    
    <div class="relative max-w-sm w-full">
        <div class="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-6 space-y-6 animate-fade-in-up">
            
            <header class="text-center space-y-3">
                <div class="inline-block p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg">
                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Taskify
                </h1>
                <p class="text-blue-200/80 text-xs font-medium">
                    {authView === 'signin' ? 'Selamat datang kembali' : authView === 'signup' ? 'Mari kita mulai!' : 'Lupa password? Tidak masalah.'}
                </p>
            </header>
            
            {#if errorMessage}
                <div class="p-3 bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl backdrop-blur-sm animate-pulse-fast">
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <span class="text-xs font-medium">{errorMessage}</span>
                    </div>
                </div>
            {/if}
            
            {#if successMessage}
                <div class="p-3 bg-green-500/20 border border-green-500/30 text-green-200 rounded-xl backdrop-blur-sm animate-pulse-fast">
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        <span class="text-xs font-medium">{successMessage}</span>
                    </div>
                </div>
            {/if}
            
            <div class="space-y-4">
                {#if authView === 'signup'}
                    <div class="space-y-1">
                        <label for="username" class="block text-xs font-semibold text-blue-200 ml-1">Username</label>
                        <div class="relative group">
                            <input
                                bind:value={username}
                                type="text"
                                id="username"
                                class="w-full px-3 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all duration-300 backdrop-blur-sm text-sm"
                                placeholder="Pilih username unik"
                                on:keypress={(e) => handleKeyPress(e, handleSignUp)}
                                disabled={loading}
                            />
                            <div class="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                        <p class="text-xs text-blue-300/70 ml-1">3-20 karakter, tanpa spasi atau karakter khusus.</p>
                    </div>
                {/if}
                
                <div class="space-y-1">
                    <label for="email" class="block text-xs font-semibold text-blue-200 ml-1">Email</label>
                    <div class="relative group">
                        <input
                            bind:value={email}
                            type="email"
                            id="email"
                            class="w-full px-3 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all duration-300 backdrop-blur-sm text-sm"
                            placeholder="nama@email.com"
                            on:keypress={(e) => {
                                if (authView === 'signin') handleKeyPress(e, handleSignIn);
                                else if (authView === 'signup') handleKeyPress(e, handleSignUp);
                                else if (authView === 'forgotten') handleKeyPress(e, handlePasswordReset);
                            }}
                            disabled={loading}
                        />
                        <div class="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </div>
                </div>
                
                {#if authView !== 'forgotten'}
                    <div class="space-y-1">
                        <label for="password" class="block text-xs font-semibold text-blue-200 ml-1">Password</label>
                        <div class="relative group">
                            <input
                                bind:value={password}
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                class="w-full px-3 py-3 pr-10 bg-white/5 border border-white/20 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all duration-300 backdrop-blur-sm text-sm"
                                placeholder="••••••••"
                                on:keypress={(e) => {
                                    if (authView === 'signin') handleKeyPress(e, handleSignIn);
                                    else if (authView === 'signup') handleKeyPress(e, handleSignUp);
                                }}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                on:click={togglePasswordVisibility}
                                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-300/70 hover:text-blue-200 transition-colors duration-200 focus:outline-none"
                            >
                                {#if showPassword}
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                                    </svg>
                                {:else}
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                {/if}
                            </button>
                            <div class="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                        <p class="text-xs text-blue-300/70 ml-1">Minimal 6 karakter.</p>
                    </div>
                {/if}
                
                <div class="space-y-3 pt-2">
                    {#if authView === 'signin'}
                        <button
                            on:click={handleSignIn}
                            class="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg text-sm"
                            disabled={loading}
                        >
                            {#if loading}
                                <div class="flex items-center justify-center space-x-2">
                                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Memuat...</span>
                                </div>
                            {:else}
                                Masuk
                            {/if}
                        </button>
                        
                        <div class="flex justify-between items-center text-xs">
                            <button 
                                on:click={() => { authView = 'forgotten'; resetMessages(); }} 
                                class="text-blue-300 hover:text-blue-200 transition-colors duration-300 hover:underline"
                            >
                                Lupa password?
                            </button>
                            <button 
                                on:click={() => { authView = 'signup'; resetMessages(); }} 
                                class="text-blue-300 hover:text-blue-200 transition-colors duration-300 hover:underline"
                            >
                                Daftar akun baru
                            </button>
                        </div>
                        
                    {:else if authView === 'signup'}
                        <button
                            on:click={handleSignUp}
                            class="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg text-sm"
                            disabled={loading}
                        >
                            {#if loading}
                                <div class="flex items-center justify-center space-x-2">
                                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Mendaftar...</span>
                                </div>
                            {:else}
                                Daftar Sekarang
                            {/if}
                        </button>
                        
                        <div class="text-center">
                            <button 
                                on:click={() => { authView = 'signin'; resetMessages(); }} 
                                class="text-blue-300 hover:text-blue-200 transition-colors duration-300 hover:underline text-xs"
                            >
                                Sudah punya akun? Masuk di sini
                            </button>
                        </div>
                        
                    {:else if authView === 'forgotten'}
                        <button
                            on:click={handlePasswordReset}
                            class="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg text-sm"
                            disabled={loading}
                        >
                            {#if loading}
                                <div class="flex items-center justify-center space-x-2">
                                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Mengirim...</span>
                                </div>
                            {:else}
                                Kirim Link Reset
                            {/if}
                        </button>
                        
                        <div class="text-center">
                            <button 
                                on:click={() => { authView = 'signin'; resetMessages(); }} 
                                class="text-blue-300 hover:text-blue-200 transition-colors duration-300 hover:underline text-xs"
                            >
                                ← Kembali ke halaman masuk
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
            
            <div class="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-60 animate-ping"></div>
            <div class="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full opacity-40 animate-pulse"></div>
        </div>
    </div>
</div>

<style>
    .animate-fade-in-up {
        animation: fadeInUp 0.5s ease-out forwards;
    }
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .animate-pulse-fast {
        animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
</style>