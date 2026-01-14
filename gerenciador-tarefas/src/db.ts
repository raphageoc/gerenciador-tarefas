import Dexie, { type Table } from 'dexie';

// --- Interfaces ---

export interface TaskResource {
  id: string;
  type: 'link' | 'file' | 'folder';
  title: string;
  value: string; // URL ou caminho de fallback
  handle?: FileSystemHandle; // O objeto mágico do navegador
}

export interface TaskSession {
  start: Date;
  end?: Date;
}

export interface CheckIn {
  id?: number;
  date: Date;
  stressLevel: number; // 0-10
  note: string;
  breathingMinutes?: number; // Se fez o exercício
}

export interface Task {
  id?: number;
  parentId?: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'paused' | 'done';
  createdAt: Date;
  deadline?: Date;
  timeSpentMs: number;
  sessions: TaskSession[];
  resources: TaskResource[]; 
}

// --- Banco de Dados ---

export class TaskManagerDB extends Dexie {
  tasks!: Table<Task>;
  checkins!: Table<CheckIn>; // Nova tabela

  constructor() {
    super('TaskManagerDB');
    
    // ATENÇÃO: Se der erro de versão ao rodar, mude version(1) para version(2)
    // Se for a primeira vez rodando, pode deixar version(1).
    this.version(2).stores({
      tasks: '++id, parentId, status, createdAt',
      checkins: '++id, date, stressLevel' // Indexado por data e stress
    });
  }
}

export const db = new TaskManagerDB();
