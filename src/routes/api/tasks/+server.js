import { getTasks, addTask, updateTask, deleteTask, clearAllTasks } from '$lib/db/tasks';
import { json } from '@sveltejs/kit';

export const GET = () => json(getTasks());

export const POST = async ({ request }) => {
  const { text } = await request.json();
  return json(addTask(text));
};

export const PUT = async ({ request }) => {
  const { id, text, done } = await request.json();
  updateTask(id, text, done);
  return json({ success: true });
};

export const DELETE = async ({ request }) => {
  const { id } = await request.json();
  if (id === "all") clearAllTasks();
  else deleteTask(id);
  return json({ success: true });
};
