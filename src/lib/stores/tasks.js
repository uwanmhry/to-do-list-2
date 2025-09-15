import { supabase } from '$lib/supabaseClient';
import { writable, get } from 'svelte/store';

export const tasks = writable([]);
export const loading = writable(true);

// Ambil semua task (sync untuk GET API)
export const getTasks = () => get(tasks);

// Tambah task dan return task baru
export const addTask = async (title) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ title }])
    .select();
  if (error) console.error(error);
  if (data?.length) tasks.update(ts => [...ts, data[0]]);
  return data?.[0];
};

// Update task
export const updateTask = async (id, title, done) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ title, done })
    .eq('id', id)
    .select();
  if (error) console.error(error);
  if (data?.length) tasks.update(ts => ts.map(t => t.id === id ? data[0] : t));
};

// Hapus task
export const deleteTask = async (id) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) console.error(error);
  else tasks.update(ts => ts.filter(t => t.id !== id));
};

// Hapus semua task
export const clearAllTasks = async () => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .neq('id', 0);
  if (error) console.error(error);
  else tasks.set([]);
};

// Load task dari DB
export const loadTasks = async () => {
  loading.set(true);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) console.error(error);
  else tasks.set(data);
  loading.set(false);
};

// Realtime listener
export const subscribeTasks = () => {
  supabase
    .channel('public:tasks')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      () => loadTasks()
    )
    .subscribe();
};
