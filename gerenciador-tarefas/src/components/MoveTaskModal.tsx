// src/components/MoveTaskModal.tsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom'; // IMPORTANTE: Importar o Portal
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task, type TaskResource } from '../db';
import { X, CornerDownRight, Check, Search } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
}

export function MoveTaskModal({ isOpen, onClose, task }: Props) {
  const [targetId, setTargetId] = useState<number | 'root'>('root');
  const [searchTerm, setSearchTerm] = useState('');
  
  const allTasks = useLiveQuery(() => db.tasks.toArray());

  const options = useMemo(() => {
    if (!allTasks || !task.id) return [];

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
        if (child.id && child.id !== task.id && !isDescendant(child.parentId)) {
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

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    return options.filter(opt => 
        opt.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleMove = async () => {
    if (!task.id) return;
    const newParentId = targetId === 'root' ? undefined : targetId;
    
    await db.tasks.update(task.id, { parentId: newParentId });
    onClose();
  };

  if (!isOpen) return null;

  // CORREÇÃO: createPortal joga o modal direto no body do navegador
  // Isso impede que ele fique preso dentro do CSS do componente pai
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => {
        // Fecha se clicar fora (opcional)
        if (e.target === e.currentTarget) onClose();
    }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-gray-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
             <CornerDownRight size={18} className="text-purple-500"/> Mover Tarefa
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1 rounded-full hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="shrink-0">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Tarefa Selecionada</p>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-purple-700 text-sm font-medium truncate shadow-sm">
                    {task.title}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Mover para dentro de:</p>
                
                {/* CAMPO DE BUSCA */}
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Buscar destino..." 
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* LISTA DE OPÇÕES */}
                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg scrollbar-thin scrollbar-thumb-gray-200">
                    {/* Botão Raiz */}
                    {(!searchTerm || "(raiz / sem pai)".includes(searchTerm.toLowerCase())) && (
                        <button 
                            onClick={() => setTargetId('root')}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 border-b border-gray-50 transition-colors ${targetId === 'root' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600'}`}
                        >
                            <span className="flex items-center gap-2">🏠 (Raiz / Sem Pai)</span>
                            {targetId === 'root' && <Check size={14} />}
                        </button>
                    )}

                    {filteredOptions.length === 0 && searchTerm && (
                        <div className="p-4 text-center text-xs text-gray-400">Nenhuma pasta encontrada.</div>
                    )}

                    {filteredOptions.map(opt => (
                        <button 
                            key={opt.id}
                            onClick={() => setTargetId(opt.id)}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${targetId === opt.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600'}`}
                        >
                            <span style={{ paddingLeft: searchTerm ? 0 : opt.depth * 12 }} className="truncate block">
                                {!searchTerm && opt.depth > 0 && <span className="text-gray-300 mr-1">└</span>} {opt.title}
                            </span>
                            {targetId === opt.id && <Check size={14} className="shrink-0" />}
                        </button>
                    ))}
                </div>
            </div>
            
            <button 
                onClick={handleMove}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors shrink-0 shadow-lg shadow-gray-200"
            >
                Confirmar Mudança
            </button>
        </div>
      </div>
    </div>,
    document.body // O segundo argumento define ONDE renderizar (no body)
  );
}