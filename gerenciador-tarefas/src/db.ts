// src/db.ts
import Dexie, { type Table } from 'dexie';

export interface TaskSession {
  start: Date;
  end: Date;
  stressLevel?: number;
  stressNote?: string;
  didBreathing?: boolean;
}

export interface TaskResource {
  id: string;
  type: 'file' | 'link' | 'folder';
  title: string;
  value: string;
  handle?: any;
  content?: string;
  createdAt: Date;
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
  links: string[]; 
  progress?: number; 
}

export interface CheckIn {
  id?: number;
  date: string; // YYYY-MM-DD
  stressLevel: number;
  mood: string;
  notes: string;
  timestamp: Date;
  // CAMPO ADICIONADO PARA CORRIGIR O ERRO:
  breathingMinutes?: number; 
}

export class FlowManagerDB extends Dexie {
  tasks!: Table<Task>;
  checkins!: Table<CheckIn>;

  constructor() {
    super('FlowManagerDB');
    this.version(1).stores({
      tasks: '++id, parentId, status, createdAt',
      checkins: '++id, date'
    });
  }
}

export const db = new FlowManagerDB();