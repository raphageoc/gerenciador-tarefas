// src/components/TaskList.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { TaskItem } from './TaskItem';
import { DataManagement } from './DataManagement';
import { 
  Plus, Layers, Layout, ChevronDown, Search, X, Check, CornerDownRight 
} from 'lucide-react';

export function TaskList() {
  // Estado do Filtro
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
  // Estado do Dropdown Customizado
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Carregar Dados
  const allTasks = useLiveQuery(() => db.tasks.toArray());
  
  // --- CORREÇÃO AQUI ---
  // Substituímos .where('parentId').equals(null) por .filter() + ordenação manual
  const rootProjects = useLiveQuery(async () => {
    const tasks = await db.tasks.filter(t => !t.parentId).toArray();
    // Ordena por data de criação (mais recente primeiro)
    return tasks.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
    });
  });

  // --- FECHAR DROPDOWN AO CLICAR FORA ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- PREPARAR OPÇÕES PARA O DROPDOWN (Árvore Hierárquica) ---
  const projectOptions = useMemo(() => {
    if (!allTasks) return [];

    const buildOptions = (parentId: number | undefined, depth: number): { id: number, title: string, depth: number }[] => {
        // Encontra filhos deste nível (comparação solta '==' para undefined/null)
        const children = allTasks
            .filter(t => t.parentId == parentId)
            .sort((a, b) => a.title.localeCompare(b.title));
        
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

  // --- FILTRAR OPÇÕES DO DROPDOWN (Pelo texto digitado) ---
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return projectOptions;
    return projectOptions.filter(opt => 
        opt.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projectOptions, searchTerm]);

  // Label do botão
  const selectedLabel = useMemo(() => {
      if (selectedProjectId === 'all') return "Todos os Projetos";
      return allTasks?.find(t => t.id == selectedProjectId)?.title || "Selecione...";
  }, [selectedProjectId, allTasks]);

  // --- LISTA VISÍVEL DE TAREFAS ---
  const visibleTasks = useMemo(() => {
    // Se "Todos", mostra as raízes normais
    if (selectedProjectId === 'all') return rootProjects;
    
    // Se selecionou um projeto específico (ou subtarefa), mostra SÓ ELE
    // O componente TaskItem cuidará de expandir os filhos dele
    const target = allTasks?.find(t => t.id == selectedProjectId);
    return target ? [target] : [];
  }, [selectedProjectId, rootProjects, allTasks]);


  // --- AÇÃO: CRIAR NOVO PROJETO ---
  const createRootProject = async () => {
    const title = prompt('Nome do novo projeto:');
    if (!title) return;
    
    await db.tasks.add({
      title,
      description: '',
      status: 'todo',
      progress: 0,
      createdAt: new Date(),
      timeSpentMs: 0,
      sessions: [],
      resources: [],
      links: []
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER + FILTRO */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 z-40 relative">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Layout className="text-blue-600" />
            {selectedProjectId === 'all' ? 'Meus Projetos' : 'Modo Focado'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {selectedProjectId === 'all' 
                ? 'Gerencie seus objetivos principais.' 
                : `Visualizando apenas "${selectedLabel}" e seus itens.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
            {/* --- DROPDOWN COM PESQUISA --- */}
            <div className="relative" ref={dropdownRef}>
                <button 
                    onClick={() => {
                        setIsDropdownOpen(!isDropdownOpen);
                        if (!isDropdownOpen) setTimeout(() => document.getElementById('list-search')?.focus(), 50);
                    }}
                    className="flex items-center justify-between gap-2 bg-gray-50 hover:bg-white border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-2 min-w-[220px] text-sm text-gray-700 transition-all shadow-sm"
                >
                    <span className="truncate max-w-[180px] font-medium">{selectedLabel}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                </button>

                {isDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Busca */}
                        <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                <input 
                                    id="list-search"
                                    type="text" 
                                    placeholder="Buscar projeto..." 
                                    className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoComplete="off"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Lista */}
                        <div className="max-h-[350px] overflow-y-auto p-1">
                            <button 
                                onClick={() => {
                                    setSelectedProjectId('all');
                                    setIsDropdownOpen(false);
                                    setSearchTerm('');
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between mb-1 ${
                                    selectedProjectId === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <span>Mostrar Todos (Raiz)</span>
                                {selectedProjectId === 'all' && <Check size={14} />}
                            </button>
                            
                            <div className="border-t border-gray-100 my-1 mx-2"></div>

                            {filteredOptions.length === 0 ? (
                                <div className="p-4 text-center text-xs text-gray-400">Nenhum projeto encontrado.</div>
                            ) : (
                                filteredOptions.map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => {
                                            setSelectedProjectId(String(opt.id));
                                            setIsDropdownOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                            String(opt.id) === String(selectedProjectId) 
                                                ? 'bg-blue-50 text-blue-700 font-medium' 
                                                : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span style={{ width: opt.depth * 12 }} className="shrink-0"></span>
                                        {opt.depth > 0 && <CornerDownRight size={12} className="text-gray-300 shrink-0" />}
                                        <span className="truncate">{opt.title}</span>
                                        {String(opt.id) === String(selectedProjectId) && <Check size={14} className="ml-auto shrink-0" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Botão Novo Projeto (Só aparece se estiver vendo Todos) */}
            {selectedProjectId === 'all' && (
                <button 
                    onClick={createRootProject}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm shadow-blue-200 text-sm font-medium"
                >
                    <Plus size={18} />
                    <span className="hidden md:inline">Novo Projeto</span>
                </button>
            )}
        </div>
      </header>

      {/* LISTA DE PROJETOS */}
      <div className="space-y-3">
        {visibleTasks?.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Layers className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum projeto encontrado</h3>
            <p className="text-gray-500 text-sm mt-1">Crie um novo projeto ou limpe o filtro de busca.</p>
          </div>
        ) : (
          visibleTasks?.map(task => (
            <TaskItem key={task.id} task={task} />
          ))
        )}
      </div>

      <DataManagement />
    </div>
  );
}
