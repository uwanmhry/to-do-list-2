import { supabase } from '$lib/supabaseClient';
import { writable } from 'svelte/store';

export const tasks = writable([]);
export const loading = writable(true);

// Ambil semua data
export const loadTasks = async () => {
  loading.set(true);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
  } else {
    tasks.set(data);
  }
  loading.set(false);
};

// Tambah task
export const addTask = async (title) => {
  const { error } = await supabase
    .from('tasks')
    .insert([{ title }]);
  if (error) console.error(error);
};

// Edit task
export const editTask = async (id, newTitle) => {
  const { error } = await supabase
    .from('tasks')
    .update({ title: newTitle })
    .eq('id', id);
  if (error) console.error(error);
};

// Hapus task
export const deleteTask = async (id) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) console.error(error);
};

// Hapus semua task
export const clearAll = async () => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .neq('id', 0);
  if (error) console.error(error);
};

// Realtime listener
export const subscribeTasks = () => {
  supabase
    .channel('public:tasks')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        console.log('Realtime update:', payload);
        loadTasks(); // reload data setiap ada perubahan
      }
    )
    .subscribe();
};
