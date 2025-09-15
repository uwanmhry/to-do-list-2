import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve("tasks.db"));

// Buat table kalau belum ada
db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`).run();

export function getTasks() {
  return db.prepare("SELECT * FROM tasks").all();
}

export function addTask(text) {
  const result = db.prepare("INSERT INTO tasks (text, done) VALUES (?, 0)").run(text);
  return { id: result.lastInsertRowid, text, done: 0 };
}

export function updateTask(id, text, done) {
  db.prepare("UPDATE tasks SET text = ?, done = ? WHERE id = ?").run(text, done ? 1 : 0, id);
}

export function deleteTask(id) {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

export function clearAllTasks() {
  db.prepare("DELETE FROM tasks").run();
}
