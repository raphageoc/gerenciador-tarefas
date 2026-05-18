// src/components/TaskList.tsx
import { useState, useMemo, useRef, useEffect, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../db';
import { 
  Plus, Search, ChevronRight, ChevronDown, 
  Layout, X, Check, CornerDownRight, Database, GripVertical 
} from 'lucide-react';
import { TaskItem } from './TaskItem';
import { DataManagementModal } from './DataManagementModal';
import { CreateProjectModal } from './CreateProjectModal';
import { ReadOnlyContext } from '../App';

export function TaskList() {
  const isReadOnly = useContext(ReadOnlyContext); // <-- LENDO O MODO LEITURA AQUI

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  const allTasks = useLiveQuery(() => db.tasks.toArray());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRecursiveProgress = (taskId: number): number => {
    if (!allTasks) return 0;
    const children = allTasks.filter(t => t.parentId === taskId);
    if (children.length === 0) {
        const t = allTasks.find(x => x.id === taskId);
        return t?.status === 'done' ? 100 : (t?.progress || 0);
    }
    const totalProgress = children.reduce((acc, child) => {
        if (child.id) return acc + getRecursiveProgress(child.id);
        return acc;
    }, 0);
    return totalProgress / children.length;
  };

  const projectOptions = useMemo(() => {
    if (!allTasks) return [];
    const buildOptions = (parentId: number | undefined, depth: number): { id: number, title: string, depth: number }[] => {
        const children = allTasks.filter(t => t.parentId === parentId).sort((a, b) => a.title.localeCompare(b.title));
        let result: { id: number, title: string, depth: number }[] = [];
        children.forEach(child => {
            if (child.id) {
                result.push({ id: child.id, title: child.title, depth });
                result = [...result, ...buildOptions(child.id, depth + 1)];
            }
        });
        return result;
    };
    return buildOptions(undefined, 0);
  }, [allTasks]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return projectOptions;
    return projectOptions.filter(opt => opt.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [projectOptions, searchTerm]);

  const selectedLabel = useMemo(() => {
      if (selectedProjectId === 'all') return "Todos os Projetos";
      return allTasks?.find(t => t.id === Number(selectedProjectId))?.title || "Selecione...";
  }, [selectedProjectId, allTasks]);

  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    let tasks: Task[] = [];
    
    if (selectedProjectId === 'all') {
        tasks = allTasks.filter(t => !t.parentId);
    } else {
        const target = allTasks.find(t => t.id === Number(selectedProjectId));
        tasks = target ? [target] : [];
    }

    return tasks.sort((a, b) => {
        const orderA = (a as any).order ?? 9999999999; 
        const orderB = (b as any).order ?? 9999999999;
        if (orderA !== orderB) return orderA - orderB;
        return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [allTasks, selectedProjectId]);

  const handleOpenProject = async (taskId: number) => {
      if (isReadOnly) {
          // Se for somente leitura, apenas seleciona sem alterar o "order" no banco
          setSelectedProjectId(String(taskId));
          return;
      }
      
      const rootTasks = allTasks?.filter(t => !t.parentId) || [];
      const currentMinOrder = rootTasks.reduce((min, t) => Math.min(min, (t as any).order ?? 0), 0);
      
      await db.tasks.update(taskId, { order: currentMinOrder - 1 } as any);
      setSelectedProjectId(String(taskId));
  };

  // --- DRAG & DROP (Com Trava de Leitura) ---
  const handleDragStart = (e: React.DragEvent, id: number) => {
      if (isReadOnly) return;
      setDraggedTaskId(id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      if (isReadOnly) return;
      e.preventDefault(); 
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
      if (isReadOnly) return;
      e.preventDefault();
      if (draggedTaskId === null || draggedTaskId === targetId) return;

      const currentList = [...filteredTasks];
      const oldIndex = currentList.findIndex(t => t.id === draggedTaskId);
      const newIndex = currentList.findIndex(t => t.id === targetId);

      if (oldIndex === -1 || newIndex === -1) return;

      const [movedItem] = currentList.splice(oldIndex, 1);
      currentList.splice(newIndex, 0, movedItem);

      const updates = currentList.map((task, index) => ({
          ...task,
          order: index 
      } as any));

      await db.tasks.bulkPut(updates);
      setDraggedTaskId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 z-40 relative">
        <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Layout className="text-blue-600" size={24} /> Meus Projetos
            </h2>
            <p className="text-gray-500 text-sm">Gerencie seu fluxo de trabalho.</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
            {!isReadOnly && (
            <button 
                onClick={() => setIsDataModalOpen(true)}
                className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                title="Backup e Dados"
            >
                <Database size={20} />
            </button>
            )}

            {/* ESCONDE O BOTÃO DE NOVO PROJETO NO READONLY */}
            {!isReadOnly && (
                <button onClick={() => setIsCreateModalOpen(true)} className="flex-1 md:flex-none bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200">
                    <Plus size={18} /> <span className="hidden sm:inline">Novo Projeto</span><span className="sm:hidden">Novo</span>
                </button>
            )}
            
            <div className="relative flex-1 md:flex-none" ref={dropdownRef}>
                <button 
                    onClick={() => { setIsProjectDropdownOpen(!isProjectDropdownOpen); if (!isProjectDropdownOpen) setTimeout(() => document.getElementById('project-search')?.focus(), 50); }} 
                    className="w-full md:w-[250px] flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm hover:border-blue-300 transition-colors"
                >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                </button>
                
                {isProjectDropdownOpen && (
                    <div className="absolute top-full right-0 md:right-0 left-0 md:left-auto mt-2 w-full md:w-[300px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                <input id="project-search" type="text" placeholder="Buscar..." className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoComplete="off" />
                                {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"><X size={14} /></button>)}
                            </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-1">
                            <button onClick={() => { setSelectedProjectId('all'); setIsProjectDropdownOpen(false); setSearchTerm(''); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between mb-1 ${selectedProjectId === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}><span>Todos os Projetos</span>{selectedProjectId === 'all' && <Check size={14} />}</button>
                            <div className="border-t border-gray-100 my-1 mx-2"></div>
                            {filteredOptions.length === 0 ? (<div className="p-4 text-center text-xs text-gray-400">Nenhum projeto encontrado.</div>) : (filteredOptions.map(opt => (
                                <button key={opt.id} onClick={() => { setSelectedProjectId(String(opt.id)); setIsProjectDropdownOpen(false); setSearchTerm(''); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${String(opt.id) === String(selectedProjectId) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <span style={{ width: opt.depth * 12 }} className="shrink-0"></span>{opt.depth > 0 && <CornerDownRight size={12} className="text-gray-300 shrink-0" />}<span className="truncate">{opt.title}</span>{String(opt.id) === String(selectedProjectId) && <Check size={14} className="ml-auto shrink-0" />}
                                </button>
                            )))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </header>

      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400">Nenhum projeto encontrado.</p>
            </div>
        ) : (
            filteredTasks.map(task => {
                const realProgress = task.id ? getRecursiveProgress(task.id) : 0;
                const isDragging = draggedTaskId === task.id;
                
                return (
                    <div 
                        key={task.id} 
                        draggable={!isReadOnly && selectedProjectId === 'all'} // <-- TRAVA O ARRASTO GERAL
                        onDragStart={(e) => !isReadOnly && task.id && handleDragStart(e, task.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => !isReadOnly && task.id && handleDrop(e, task.id)}
                        className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 ${isDragging ? 'opacity-40 scale-[0.98] ring-2 ring-blue-400 border-blue-400 cursor-grabbing' : 'hover:shadow-md'}`}
                    >
                        {selectedProjectId === 'all' && (
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                                <div className="flex items-center gap-3">
                                    {/* SÓ MOSTRA O ÍCONE DE ARRASTAR SE NÃO FOR READONLY */}
                                    {!isReadOnly && (
                                        <div className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing">
                                            <GripVertical size={20} />
                                        </div>
                                    )}
                                    
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => task.id && handleOpenProject(task.id)}>
                                            {task.title} <ChevronRight size={16} className="text-gray-400" />
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">Criado em {task.createdAt.toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-500">Progresso Global</span>
                                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{Math.round(realProgress)}%</span>
                                        </div>
                                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${realProgress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="p-2">
                             <TaskItem task={task} />
                        </div>
                    </div>
                );
            })
        )}
      </div>

      <DataManagementModal 
        isOpen={isDataModalOpen} 
        onClose={() => setIsDataModalOpen(false)} 
      />

      {/* SÓ RENDERIZA O MODAL DE CRIAÇÃO SE NÃO FOR READONLY */}
      {!isReadOnly && (
          <CreateProjectModal 
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
          />
      )}
    </div>
  );
}
