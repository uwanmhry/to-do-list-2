<script>
    import { createEventDispatcher } from 'svelte';
    import { supabase } from '$lib/supabaseClient';
    import { X, Loader2 } from 'lucide-svelte';

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

            const { error: authError } = await supabase.auth.updateUser({
                email: newEmail.trim()
            });

            if (authError) throw authError;

            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    email: newEmail.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', session.user.id);

            if (profileError) {
                console.error('Error updating profile email:', profileError);
            }

            const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession();
            if (!sessionError && newSession) {
                window.dispatchEvent(new CustomEvent('sessionUpdated', {
                    detail: { session: newSession }
                }));
            }

            successMessage = `Verifikasi email telah dikirim ke ${currentEmail}. Silakan cek email lama Anda untuk konfirmasi. Setelah verifikasi, email akan otomatis diperbarui di sistem.`;
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

    function handleKeyPress(event, action) {
        if (event.key === 'Enter') {
            event.preventDefault();
            action();
        }
    }
</script>

<div
    class="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 transition-opacity duration-300"
    on:click|self={closeModal}
    style="backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);"
>
    <div 
        class="bg-slate-900/40 border border-white/20 rounded-2xl shadow-xl max-w-sm w-full backdrop-blur-md max-h-[90vh] overflow-y-auto transform-gpu transition-transform duration-300 scale-95 opacity-0 animate-fade-in"
        on:click|stopPropagation
    >
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">Pengaturan Akun</h2>
                <button on:click={closeModal} class="p-2 text-white/50 hover:text-white/80 transition-colors rounded-full hover:bg-white/10">
                    <X class="h-6 w-6" />
                </button>
            </div>

            <div class="flex border-b border-white/10 mb-6">
                <button 
                    class:bg-gradient-to-r={activeTab === 'email'} 
                    class:from-blue-500={activeTab === 'email'} 
                    class:to-cyan-500={activeTab === 'email'}
                    class:text-white={activeTab === 'email'}
                    class:text-blue-300={activeTab !== 'email'}
                    class="flex-1 py-2 px-4 rounded-t-lg transition-all duration-300 font-semibold" 
                    on:click={() => activeTab = 'email'}>
                    Ganti Email
                </button>
                <button 
                    class:bg-gradient-to-r={activeTab === 'password'} 
                    class:from-blue-500={activeTab === 'password'} 
                    class:to-cyan-500={activeTab === 'password'}
                    class:text-white={activeTab === 'password'}
                    class:text-blue-300={activeTab !== 'password'}
                    class="flex-1 py-2 px-4 rounded-t-lg transition-all duration-300 font-semibold" 
                    on:click={() => activeTab = 'password'}>
                    Ganti Password
                </button>
            </div>

            {#if errorMessage}
                <div class="mb-4 p-3 bg-red-500/20 text-red-200 border border-red-500/30 rounded-lg text-sm font-medium animate-pulse">
                    {errorMessage}
                </div>
            {/if}

            {#if successMessage}
                <div class="mb-4 p-3 bg-green-500/20 text-green-200 border border-green-500/30 rounded-lg text-sm font-medium animate-pulse">
                    {successMessage}
                </div>
            {/if}

            {#if activeTab === 'email'}
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-blue-200/80 mb-1">Email Saat Ini</label>
                        <input type="email" bind:value={currentEmail} disabled class="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-blue-300/60 cursor-not-allowed" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-blue-200 mb-1">Email Baru</label>
                        <input 
                            type="email" 
                            bind:value={newEmail} 
                            placeholder="Masukkan email baru" 
                            class="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300"
                            on:keypress={(e) => handleKeyPress(e, updateEmail)}
                        />
                    </div>

                    <button on:click={updateEmail} disabled={loading || !newEmail.trim() || newEmail === currentEmail} class="w-full py-3 px-4 rounded-lg font-semibold shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 
                        bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600">
                        {#if loading}
                            <Loader2 class="animate-spin h-5 w-5" />
                            <span>Mengirim...</span>
                        {:else}
                            <span>Kirim Verifikasi Email</span>
                        {/if}
                    </button>

                    <div class="p-4 bg-white/5 border border-white/10 rounded-lg text-sm">
                        <p class="text-xs text-blue-200 font-medium mb-1">📧 Proses Verifikasi Email:</p>
                        <ul class="text-xs text-blue-300/80 space-y-1">
                            <li>• Verifikasi dikirim ke email <span class="font-semibold text-white">LAMA</span> ({currentEmail})</li>
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
                        <label class="block text-sm font-medium text-blue-200/80 mb-1">Password Saat Ini</label>
                        <input 
                            type="password" 
                            bind:value={currentPassword} 
                            placeholder="Masukkan password saat ini" 
                            class="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300"
                            on:keypress={(e) => handleKeyPress(e, updatePassword)}
                        />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-blue-200/80 mb-1">Password Baru</label>
                        <input 
                            type="password" 
                            bind:value={newPassword} 
                            placeholder="Masukkan password baru (min. 6 karakter)" 
                            class="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300"
                            on:keypress={(e) => handleKeyPress(e, updatePassword)}
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-blue-200/80 mb-1">Konfirmasi Password Baru</label>
                        <input 
                            type="password" 
                            bind:value={confirmPassword} 
                            placeholder="Konfirmasi password baru" 
                            class="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300"
                            on:keypress={(e) => handleKeyPress(e, updatePassword)}
                        />
                    </div>

                    <button on:click={updatePassword} disabled={loading || !currentPassword || !newPassword || !confirmPassword} class="w-full py-3 px-4 rounded-lg font-semibold shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2
                        bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600">
                        {#if loading}
                            <Loader2 class="animate-spin h-5 w-5" />
                            <span>Mengubah...</span>
                        {:else}
                            <span>Ubah Password</span>
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>