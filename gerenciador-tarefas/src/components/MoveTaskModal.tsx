// src/components/MoveTaskModal.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../db';
import { X, Search, FolderInput, CheckCircle2, Layout } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  taskToMove: Task;
}

export function MoveTaskModal({ isOpen, onClose, taskToMove }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // CORREÇÃO AQUI:
  // Removemos .orderBy('title') do banco e fazemos o sort() via JavaScript
  const allTasks = useLiveQuery(async () => {
    const tasks = await db.tasks.toArray();
    
    return tasks
      .filter(t => t.id !== taskToMove.id) // Remove a própria tarefa
      .sort((a, b) => a.title.localeCompare(b.title)); // Ordena alfabeticamente na memória
  }, [taskToMove.id]);

  const filteredTasks = allTasks?.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMove = async (newParentId: number | null) => {
    if (!taskToMove.id) return;

    const oldParentId = taskToMove.parentId;

    // 1. Atualiza o pai da tarefa atual
    await db.tasks.update(taskToMove.id, { 
        parentId: newParentId || undefined 
    });

    // 2. Recalcula progresso do Pai ANTIGO
    if (oldParentId) {
       await updateParentProgress(oldParentId);
    }

    // 3. Recalcula progresso do Pai NOVO
    if (newParentId) {
       await updateParentProgress(newParentId);
    }

    onClose();
  };

  // Função auxiliar de recálculo
  async function updateParentProgress(parentId: number) {
    const siblings = await db.tasks.where('parentId').equals(parentId).toArray();
    
    if (siblings.length === 0) return;

    const total = siblings.reduce((acc, t) => acc + (t.progress ?? (t.status === 'done' ? 100 : 0)), 0);
    const avg = Math.round(total / siblings.length);
    const newStatus = avg === 100 ? 'done' : 'todo';
    
    const parent = await db.tasks.get(parentId);
    if (parent && (parent.progress !== avg || parent.status !== newStatus)) {
      await db.tasks.update(parentId, { progress: avg, status: newStatus });
      if (parent.parentId) await updateParentProgress(parent.parentId);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <FolderInput size={18} className="text-blue-600" />
              Mover Tarefa
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Escolha onde colocar <span className="font-bold">"{taskToMove.title}"</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
            <Search size={16} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar destino..." 
              className="bg-transparent w-full text-sm outline-none text-gray-700 placeholder-gray-400"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Opção: Tornar Projeto Raiz */}
          <button 
            onClick={() => handleMove(null)}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 hover:border-blue-100 border border-dashed border-gray-300 transition-all text-left group"
          >
            <div className="p-2 bg-gray-100 text-gray-500 rounded group-hover:bg-blue-200 group-hover:text-blue-700">
                <Layout size={18} />
            </div>
            <div>
                <span className="font-medium text-gray-700 group-hover:text-blue-800">Transformar em Projeto Raiz</span>
                <p className="text-xs text-gray-400">Mover para a tela principal</p>
            </div>
          </button>

          <div className="my-2 border-t border-gray-100 mx-2" />

          {/* Lista de Projetos Existentes */}
          {filteredTasks?.map(target => (
            <button 
              key={target.id}
              onClick={() => handleMove(target.id!)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all text-left"
            >
              <div className="p-2 bg-white border border-gray-200 text-gray-400 rounded">
                  <CheckCircle2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-700 block truncate">{target.title}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-mono bg-gray-100 px-1 rounded inline-block">
                     ID: {target.id} {target.parentId ? '(Subtarefa)' : '(Projeto)'}
                  </span>
              </div>
            </button>
          ))}

          {filteredTasks?.length === 0 && (
             <div className="text-center py-8 text-gray-400 text-sm">Nenhum destino encontrado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
