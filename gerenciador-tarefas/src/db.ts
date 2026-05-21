// src/db.ts
import Dexie, { type Table } from 'dexie';

export interface Session {
  start: Date;
  end: Date;
  stressLevel?: number; 
  stressNote?: string;
  didBreathing?: boolean;
}

export interface TaskResource {
  id: string;
  type: 'link' | 'folder' | 'file';
  title: string;
  value: string;
  createdAt: Date;
}

export interface Task {
  id?: number;
  parentId?: number; 
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done' | 'paused';
  progress?: number; 
  createdAt: Date;
  deadline?: Date; 
  completedAt?: Date;
  timeSpentMs: number;
  sessions: Session[]; 
  resources: TaskResource[]; 
  links: { title: string; url: string }[];
  order?: number;
}

export interface Checkin {
  id?: number;
  date: string; 
  mood: 'happy' | 'neutral' | 'sad' | 'stressed';
  stressLevel: number;
  note: string;
  breathingMinutes: number;
}

export class FlowDatabase extends Dexie {
  tasks!: Table<Task>;
  checkins!: Table<Checkin>; 

  constructor() {
    super('FlowDatabase');
    
    // Incrementamos para a versão 2 para aplicar as mudanças de estrutura
    this.version(2).stores({
      tasks: '++id, parentId, status, createdAt, order',
      checkins: '++id, date' 
    });
  }
}

export const db = new FlowDatabase();