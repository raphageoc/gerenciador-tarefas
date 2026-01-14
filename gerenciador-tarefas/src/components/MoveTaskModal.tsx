// src/components/MoveTaskModal.tsx
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../db'; // Usa type Task
import { X, CornerDownRight, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: Task; // CORREÇÃO: Adicionado 'task' na interface
}

export function MoveTaskModal({ isOpen, onClose, task }: Props) {
  const [targetId, setTargetId] = useState<number | 'root'>('root');
  const allTasks = useLiveQuery(() => db.tasks.toArray());

  // Gera a lista hierárquica para o select (sem a própria tarefa e seus filhos)
  const options = useMemo(() => {
    if (!allTasks || !task.id) return [];

    // Função para verificar se uma tarefa é descendente da tarefa atual (evitar ciclo)
    const isDescendant = (checkId: number | undefined): boolean => {
       if (!checkId) return false;
       if (checkId === task.id) return true;
       const parent = allTasks.find(t => t.id === checkId);
       if (parent && parent.parentId) return isDescendant(parent.parentId);
       return false;
    };

    const buildOptions = (parentId: number | undefined, depth: number): { id: number, title: string, depth: number }[] => {
      const children = allTasks
        .filter(t => t.parentId === parentId)
        .sort((a, b) => a.title.localeCompare(b.title));
      
      let result: { id: number, title: string, depth: number }[] = [];
      
      children.forEach(child => {
        // Não mostrar a própria tarefa nem seus descendentes
        if (child.id && child.id !== task.id && !isDescendant(child.parentId)) {
             // Verificação extra: não permitir mover para dentro de si mesmo (já coberto, mas por segurança)
             if (!isDescendant(child.id)) {
                 result.push({ id: child.id, title: child.title, depth });
                 result = [...result, ...buildOptions(child.id, depth + 1)];
             }
        }
      });
      return result;
    };

    return buildOptions(undefined, 0);
  }, [allTasks, task]);

  const handleMove = async () => {
    if (!task.id) return;
    const newParentId = targetId === 'root' ? undefined : targetId;
    
    await db.tasks.update(task.id, { parentId: newParentId });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
             <CornerDownRight size={18} className="text-purple-500"/> Mover Tarefa
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
            <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Tarefa Selecionada</p>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-purple-700 text-sm font-medium">
                    {task.title}
                </div>
            </div>

            <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Mover para dentro de:</p>
                <div className="max-h-[200px] overflow-y-auto border border-gray-200 rounded-lg">
                    <button 
                        onClick={() => setTargetId('root')}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 ${targetId === 'root' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600'}`}
                    >
                        <span>(Raiz / Sem Pai)</span>
                        {targetId === 'root' && <Check size={14} />}
                    </button>
                    {options.map(opt => (
                        <button 
                            key={opt.id}
                            onClick={() => setTargetId(opt.id)}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 ${targetId === opt.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600'}`}
                        >
                            <span style={{ paddingLeft: opt.depth * 12 }} className="truncate">
                                {opt.depth > 0 && '└ '} {opt.title}
                            </span>
                            {targetId === opt.id && <Check size={14} className="shrink-0" />}
                        </button>
                    ))}
                </div>
            </div>
            
            <button 
                onClick={handleMove}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
            >
                Confirmar Mudança
            </button>
        </div>
      </div>
    </div>
  );
}