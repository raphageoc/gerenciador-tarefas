// src/components/CreateProjectModal.tsx
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db} from '../db';
import { X, Copy, Plus, FolderPlus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [copyFromId, setCopyFromId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  // Limpa os campos sempre que o modal abre
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCopyFromId('');
    }
  }, [isOpen]);

  // Busca apenas os projetos raiz (sem pai) para servir de modelo
  const rootProjects = useLiveQuery(() => 
    db.tasks.filter(t => !t.parentId).toArray()
  );

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || isCreating) return;
    
    setIsCreating(true);

    try {
      await db.transaction('rw', db.tasks, async () => {
        // Busca as tarefas para garantir que o novo projeto fique no final da lista
        const allTasks = await db.tasks.toArray();
        const rootTasks = allTasks.filter(t => !t.parentId);
        const maxOrder = rootTasks.reduce((max, t) => Math.max(max, t.order ?? 0), 0);

        // 1. Cria o projeto raiz com TODOS os campos da Versão 2
        const newProjectId = await db.tasks.add({
          title: title.trim(),
          description: '',
          status: 'todo',
          progress: 0,
          createdAt: new Date(),
          timeSpentMs: 0,
          sessions: [],
          resources: [],
          links: [],
          order: maxOrder + 1
        });

        // 2. Se houver um modelo selecionado, copia a estrutura recursivamente
        if (copyFromId) {
           await cloneChildren(Number(copyFromId), Number(newProjectId));
        }
      });

      onClose();
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      alert("Erro ao criar ou copiar estrutura.");
    } finally {
      setIsCreating(false);
    }
  };

  // Função Recursiva para clonar tarefas com a nova tipagem
  const cloneChildren = async (originalParentId: number, newParentId: number) => {
    // Busca os filhos diretos da tarefa original
    const children = await db.tasks.where('parentId').equals(originalParentId).toArray();

    for (const child of children) {
       if (!child.id) continue;

       // Cria a cópia do filho (Resetando status e tempos, mas mantendo a ordem original)
       const newChildId = await db.tasks.add({
           parentId: newParentId,
           title: child.title,
           description: child.description, // Mantém descrição (pode ser instruções)
           status: 'todo',
           progress: 0,
           createdAt: new Date(),
           timeSpentMs: 0,
           sessions: [],
           resources: [], // Começa limpo sem arquivos anexados
           links: [],
           order: child.order ?? 0
       });

       // Chama recursivamente para os netos, bisnetos, etc.
       await cloneChildren(child.id, Number(newChildId));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
              <FolderPlus size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Novo Projeto</h3>
          </div>
          <button 
            onClick={onClose} 
            disabled={isCreating} 
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleCreate} className="space-y-5">
            
            {/* Input Nome */}
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  Nome do Projeto
                </label>
                <input 
                    type="text" 
                    autoFocus
                    placeholder="Ex: Reforma da Casa, Site Novo..." 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-800 disabled:opacity-50"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isCreating}
                />
            </div>

            {/* Select Clonar */}
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Copy size={14} className="text-blue-500" /> Copiar Estrutura (Template)
                </label>
                <div className="relative">
                    <select 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-700 appearance-none disabled:opacity-50 cursor-pointer"
                        value={copyFromId}
                        onChange={(e) => setCopyFromId(e.target.value)}
                        disabled={isCreating}
                    >
                        <option value="">(Em branco - Começar do zero)</option>
                        {rootProjects?.map(proj => (
                            <option key={proj.id} value={proj.id}>{proj.title}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">
                    Opcional. Se selecionar um projeto, todas as suas tarefas e subtarefas serão copiadas para este novo.
                </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 w-full pt-2">
                <button 
                    type="button"
                    onClick={onClose}
                    disabled={isCreating}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-sm transition-colors disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button 
                    type="submit"
                    disabled={!title.trim() || isCreating}
                    className="flex-1 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                    {isCreating ? 'A criar...' : <><Plus size={16} /> Criar Projeto</>}
                </button>
            </div>

        </form>
      </div>
    </div>
  );
}
