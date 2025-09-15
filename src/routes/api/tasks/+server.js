import { getTasks, addTask, updateTask, deleteTask, clearAllTasks } from '$lib/stores/tasks';
import { json } from '@sveltejs/kit';

export const GET = () => json(getTasks());

export const POST = async ({ request }) => {
  const { title } = await request.json();
  const newTask = await addTask(title);
  return json(newTask);
};

export const PUT = async ({ request }) => {
  const { id, title, done } = await request.json();
  await updateTask(id, title, done);
  return json({ success: true });
};

export const DELETE = async ({ request }) => {
  const { id } = await request.json();
  if (id === "all") await clearAllTasks();
  else await deleteTask(id);
  return json({ success: true });
};
