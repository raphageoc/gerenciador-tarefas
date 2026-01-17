// src/components/CreateProjectModal.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { X, Copy, Plus, Layout } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [copyFromId, setCopyFromId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  // Busca apenas os projetos raiz (sem pai) para servir de modelo
  const rootProjects = useLiveQuery(() => 
    db.tasks.filter(t => !t.parentId).toArray()
  );

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);

    try {
      await db.transaction('rw', db.tasks, async () => {
        // 1. Cria o projeto raiz
        const newProjectId = await db.tasks.add({
          title: title.trim(),
          description: '',
          status: 'todo',
          progress: 0,
          createdAt: new Date(),
          timeSpentMs: 0,
          sessions: [],
          resources: [],
          links: []
        });

        // 2. Se houver um modelo selecionado, copia a estrutura recursivamente
        if (copyFromId) {
           await cloneChildren(Number(copyFromId), Number(newProjectId));
        }
      });

      setTitle('');
      setCopyFromId('');
      onClose();
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      alert("Erro ao copiar estrutura.");
    } finally {
      setIsCreating(false);
    }
  };

  // Função Recursiva para clonar tarefas
  const cloneChildren = async (originalParentId: number, newParentId: number) => {
    // Busca os filhos diretos da tarefa original
    const children = await db.tasks.where('parentId').equals(originalParentId).toArray();

    for (const child of children) {
       if (!child.id) continue;

       // Cria a cópia do filho (Resetando status e tempos)
       const newChildId = await db.tasks.add({
           parentId: newParentId,
           title: child.title,
           description: child.description, // Mantém descrição (pode ser instruções)
           status: 'todo',
           progress: 0,
           createdAt: new Date(),
           timeSpentMs: 0,
           sessions: [],
           // Opcional: Copiar recursos se desejar (aqui estamos copiando array vazio para começar limpo)
           resources: [], 
           links: []
       });

       // Chama recursivamente para os netos, bisnetos, etc.
       await cloneChildren(child.id, Number(newChildId));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
             <Layout size={20} className="text-blue-600"/> Novo Projeto
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
            
            {/* Input Nome */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nome do Projeto</label>
                <input 
                    type="text" 
                    autoFocus
                    placeholder="Ex: Reforma da Casa, Site Novo..." 
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all font-medium text-gray-800"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
            </div>

            {/* Select Clonar */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Copy size={12} /> Copiar Estrutura de (Template)
                </label>
                <div className="relative">
                    <select 
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm text-gray-700 appearance-none"
                        value={copyFromId}
                        onChange={(e) => setCopyFromId(e.target.value)}
                    >
                        <option value="">(Em branco - Começar do zero)</option>
                        {rootProjects?.map(proj => (
                            <option key={proj.id} value={proj.id}>{proj.title}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400">
                    Se selecionar um projeto, todas as tarefas e subtarefas serão copiadas para o novo projeto.
                </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2">
                <button 
                    onClick={handleCreate}
                    disabled={!title.trim() || isCreating}
                    className="w-full py-3 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                    {isCreating ? 'Criando...' : <><Plus size={18} /> Criar Projeto</>}
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}
