// src/components/Dashboard.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../db';
import { 
  Clock, Activity, Calendar, Hourglass, AlertTriangle, 
  CornerDownRight, Layers, ChevronDown, Search, X, Check, CalendarDays, MessageSquare, Quote, Brain, Network 
} from 'lucide-react';
import { ProjectCalendar } from './ProjectCalendar';
import { StressCalendar } from './StressCalendar';

export function Dashboard() {
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Filtro de Projetos
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtro de Tempo (Ranking)
  const [rankingMode, setRankingMode] = useState<'week' | 'month' | 'all'>('week');
  const [rankingDate, setRankingDate] = useState(new Date()); 

  // 1. Carregar Dados
  const allTasks = useLiveQuery(() => db.tasks.toArray());

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- OPÇÕES DO DROPDOWN ---
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

  // --- FILTRAGEM DE TAREFAS (ÁRVORE) ---
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    if (selectedProjectId === 'all') return allTasks;

    const targetId = Number(selectedProjectId);
    const rootTask = allTasks.find(t => t.id === targetId);
    if (!rootTask) return [];

    const family: Task[] = [rootTask];
    const queue = [rootTask.id]; 
    const visited = new Set([rootTask.id]); 

    while (queue.length > 0) {
        const parentId = queue.shift();
        const children = allTasks.filter(t => t.parentId === parentId);
        children.forEach(child => {
            if (child.id && !visited.has(child.id)) {
                family.push(child);
                queue.push(child.id);
                visited.add(child.id);
            }
        });
    }
    return family;
  }, [allTasks, selectedProjectId]);

  // --- ESTATÍSTICAS MENSAIS ---
  const monthlyStats = useMemo(() => {
      let totalStress = 0;
      let totalCount = 0;
      
      filteredTasks.forEach(task => {
          if (task.sessions) {
              task.sessions.forEach(session => {
                  if (session.stressLevel !== undefined && session.stressLevel !== null) {
                      const date = new Date(session.start);
                      if (date.getMonth() === calendarDate.getMonth() && 
                          date.getFullYear() === calendarDate.getFullYear()) {
                          totalStress += session.stressLevel;
                          totalCount++;
                      }
                  }
              });
          }
      });

      return {
          avgStress: totalCount > 0 ? (totalStress / totalCount).toFixed(1) : '0',
          sessionCount: totalCount
      };
  }, [filteredTasks, calendarDate]);


  // --- CÁLCULO DE DADOS PARA CALENDÁRIO DE STRESS ---
  const stressCalendarData = useMemo(() => {
    const dailyMap: Record<string, { sum: number; count: number }> = {};
    filteredTasks.forEach(task => {
        if (task.sessions) {
            task.sessions.forEach(session => {
                if (session.stressLevel !== undefined && session.stressLevel !== null) {
                    const start = new Date(session.start);
                    if (start.getMonth() === calendarDate.getMonth() && start.getFullYear() === calendarDate.getFullYear()) {
                        const dateStr = start.toISOString().split('T')[0];
                        if (!dailyMap[dateStr]) dailyMap[dateStr] = { sum: 0, count: 0 };
                        dailyMap[dateStr].sum += session.stressLevel;
                        dailyMap[dateStr].count += 1;
                    }
                }
            });
        }
    });
    return Object.entries(dailyMap).map(([date, data]) => ({
        date,
        level: data.sum / data.count,
        count: data.count
    }));
  }, [filteredTasks, calendarDate]);

  // --- DIÁRIO DE SENTIMENTOS ---
  const journalEntries = useMemo(() => {
      const entries: { 
          id: string; 
          taskTitle: string; 
          date: Date; 
          stressLevel: number; 
          note: string 
      }[] = [];

      filteredTasks.forEach(task => {
          if (task.sessions) {
              task.sessions.forEach((session, index) => {
                  if (session.stressNote && session.stressNote.trim() !== '' && session.stressLevel !== undefined) {
                      const sessionDate = new Date(session.start);
                      if (sessionDate.getMonth() === calendarDate.getMonth() && 
                          sessionDate.getFullYear() === calendarDate.getFullYear()) {
                          entries.push({
                              id: `${task.id}-${index}`,
                              taskTitle: task.title,
                              date: sessionDate,
                              stressLevel: session.stressLevel,
                              note: session.stressNote
                          });
                      }
                  }
              });
          }
      });

      return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredTasks, calendarDate]);

  const getStressBadge = (level: number) => {
      if (level <= 2) return 'bg-blue-100 text-blue-700';
      if (level <= 4) return 'bg-green-100 text-green-700';
      if (level <= 6) return 'bg-yellow-100 text-yellow-700';
      if (level <= 8) return 'bg-orange-100 text-orange-700';
      return 'bg-red-100 text-red-700';
  };

  // --- RANKING AGREGADO (RECURSIVO) ---
  const rankedTasks = useMemo(() => {
    if (!allTasks) return { items: [], rangeLabel: '' };

    const referenceDate = new Date(rankingDate); 
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    // 1. Define o intervalo de tempo
    if (rankingMode === 'week') {
        const day = referenceDate.getDay();
        startDate = new Date(referenceDate); startDate.setDate(referenceDate.getDate() - day); startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59, 999);
    } else if (rankingMode === 'month') {
        startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59);
    }

    // 2. Função Auxiliar: Calcula tempo de uma ÚNICA tarefa neste intervalo
    const getTaskOwnTime = (task: Task) => {
        let duration = 0;
        if (rankingMode === 'all') {
            duration = task.timeSpentMs || 0;
        } else if (task.sessions) {
            task.sessions.forEach(session => {
                const sStart = new Date(session.start);
                const sEnd = session.end ? new Date(session.end) : new Date();
                if (startDate && endDate) {
                    if (sStart >= startDate && sStart <= endDate) duration += (sEnd.getTime() - sStart.getTime());
                }
            });
        }
        return duration;
    };

    // 3. Função Recursiva: Calcula tempo da tarefa + todos os filhos
    // Usamos um Map para cache simples se necessário, mas aqui faremos direto pois filteredTasks já é limitado
    const getRecursiveTime = (taskId: number): number => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return 0;

        let total = getTaskOwnTime(task);
        
        // Acha filhos diretos
        const children = allTasks.filter(t => t.parentId === taskId);
        children.forEach(child => {
            if (child.id) total += getRecursiveTime(child.id);
        });

        return total;
    };

    // 4. Mapeia as tarefas filtradas e calcula o "Peso Total" (Agregado)
    const data = filteredTasks.map(task => {
        if (!task.id) return { id: 0, title: '', totalDuration: 0, selfDuration: 0 };
        
        const totalDuration = getRecursiveTime(task.id);
        const selfDuration = getTaskOwnTime(task);

        return { 
            id: task.id, 
            title: task.title, 
            totalDuration, // Tempo Agregado (Pai + Filhos)
            selfDuration   // Tempo Próprio
        };
    }).filter(t => t.totalDuration > 0).sort((a, b) => b.totalDuration - a.totalDuration);
    
    const maxDuration = data.length > 0 ? data[0].totalDuration : 1;
    
    return {
        items: data.map(t => ({ 
            ...t, 
            hours: (t.totalDuration / (1000 * 60 * 60)).toFixed(1), 
            selfHours: (t.selfDuration / (1000 * 60 * 60)).toFixed(1),
            percent: (t.totalDuration / maxDuration) * 100,
            selfPercent: (t.selfDuration / t.totalDuration) * 100 
        })),
        rangeLabel: startDate && endDate ? `${startDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} a ${endDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}` : 'Todo o Período'
    };
  }, [filteredTasks, allTasks, rankingMode, rankingDate]); // Dependências

  // Total Geral (Soma simples de todas as tarefas da lista, pois aqui queremos o "consumo de recursos" plano)
  // Se somarmos recursivamente o total, duplicaríamos o tempo (Pai + Filho). Para o totalizador geral, somamos apenas o selfTime de cada item da lista.
  const totalFocusMs = filteredTasks.reduce((acc, t) => acc + Number(t.timeSpentMs || 0), 0);
  const totalHours = (totalFocusMs / (1000 * 60 * 60)).toFixed(1);

  const hoursCalendarData = useMemo(() => {
     const dataMap: Record<string, number> = {};
     filteredTasks.forEach(task => {
        if (task.sessions) {
            task.sessions.forEach(session => {
                const start = new Date(session.start);
                if (start.getMonth() === calendarDate.getMonth() && start.getFullYear() === calendarDate.getFullYear()) {
                    const dateStr = start.toISOString().split('T')[0];
                    const end = session.end ? new Date(session.end) : new Date();
                    const durationMs = end.getTime() - start.getTime();
                    dataMap[dateStr] = (dataMap[dateStr] || 0) + (durationMs / (1000 * 60 * 60));
                }
            });
        }
     });
     return Object.entries(dataMap).map(([date, hours]) => ({ date, hours }));
  }, [filteredTasks, calendarDate]);

  const deadlines = useMemo(() => {
    return filteredTasks.filter(t => t.status !== 'done' && !!t.deadline).map(t => {
        const now = new Date(); const deadline = new Date(t.deadline!);
        const diffTime = deadline.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...t, daysLeft };
      }).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [filteredTasks]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 z-40 relative">
        <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Activity className="text-blue-600" size={24} /> {selectedProjectId === 'all' ? 'Visão Geral' : selectedLabel}</h2>
            <div className="flex items-center gap-2 mt-1">{selectedProjectId !== 'all' ? (<span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-bold border border-blue-100 flex items-center gap-1"><Layers size={12} /> Consolidando {filteredTasks.length} itens</span>) : (<p className="text-gray-500 text-sm">Mostrando dados de todos os projetos.</p>)}</div>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200 relative" ref={dropdownRef}>
            <span className="text-xs font-bold text-gray-400 uppercase px-2">Projeto:</span>
            <button onClick={() => { setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen) setTimeout(() => document.getElementById('project-search')?.focus(), 50); }} className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded px-3 py-1.5 min-w-[200px] md:min-w-[250px] text-sm text-gray-700 shadow-sm hover:border-blue-300 transition-colors"><span className="truncate max-w-[180px]">{selectedLabel}</span><ChevronDown size={14} className="text-gray-400" /></button>
            {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-[300px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" /><input id="project-search" type="text" placeholder="Buscar projeto..." className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoComplete="off" />{searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"><X size={14} /></button>)}</div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                        <button onClick={() => { setSelectedProjectId('all'); setIsDropdownOpen(false); setSearchTerm(''); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between mb-1 ${selectedProjectId === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}><span>Todos os Projetos</span>{selectedProjectId === 'all' && <Check size={14} />}</button>
                        <div className="border-t border-gray-100 my-1 mx-2"></div>
                        {filteredOptions.length === 0 ? (<div className="p-4 text-center text-xs text-gray-400">Nenhum projeto encontrado.</div>) : (filteredOptions.map(opt => (
                            <button key={opt.id} onClick={() => { setSelectedProjectId(String(opt.id)); setIsDropdownOpen(false); setSearchTerm(''); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${String(opt.id) === String(selectedProjectId) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                                <span style={{ width: opt.depth * 12 }} className="shrink-0"></span>{opt.depth > 0 && <CornerDownRight size={12} className="text-gray-300 shrink-0" />}<span className="truncate">{opt.title}</span>{String(opt.id) === String(selectedProjectId) && <Check size={14} className="ml-auto shrink-0" />}
                            </button>
                        )))}
                    </div>
                </div>
            )}
        </div>
      </header>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Foco Total */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Clock size={24} /></div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Foco Total (Tudo)</p>
                    <h3 className="text-3xl font-bold text-gray-800">{totalHours}h</h3>
                </div>
            </div>
        </div>
        
        {/* Stress Médio */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 opacity-90">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-xl"><Brain size={24} /></div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                        Stress Médio ({calendarDate.toLocaleString('pt-BR', { month: 'short' })})
                    </p>
                    <h3 className="text-3xl font-bold text-gray-800">{monthlyStats.avgStress}/10</h3>
                </div>
            </div>
        </div>

        {/* Registros */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 opacity-90">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-xl"><Calendar size={24} /></div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                        Registros ({calendarDate.toLocaleString('pt-BR', { month: 'short' })})
                    </p>
                    <h3 className="text-3xl font-bold text-gray-800">{monthlyStats.sessionCount}</h3>
                </div>
            </div>
        </div>
      </div>

      {/* CALENDÁRIOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-[450px]">
            <ProjectCalendar data={hoursCalendarData} currentDate={calendarDate} onPrevMonth={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} onNextMonth={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} />
        </div>
        <div className="h-[450px]">
            <StressCalendar data={stressCalendarData} currentDate={calendarDate} onPrevMonth={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} onNextMonth={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} />
        </div>
      </div>

      {/* RANKING + PRAZOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* RANKING DE MAIOR CONSUMO (ATUALIZADO PARA MOSTRAR PAI + FILHOS) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[400px] flex flex-col">
            <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Network size={20} className="text-purple-500" /> 
                        Maior Consumo (Agregado)
                    </h3>
                    <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200 gap-2">
                        <select value={rankingMode} onChange={(e) => setRankingMode(e.target.value as any)} className="bg-transparent text-xs font-bold text-gray-600 outline-none p-1 cursor-pointer">
                            <option value="week">Semana</option>
                            <option value="month">Mês</option>
                            <option value="all">Total</option>
                        </select>
                        {rankingMode !== 'all' && (
                            <div className="relative flex items-center">
                                <input type="date" value={rankingDate.toISOString().split('T')[0]} onChange={(e) => setRankingDate(new Date(e.target.value))} className="bg-white border border-gray-200 rounded text-xs px-2 py-1 outline-none text-gray-600 w-[110px]" />
                            </div>
                        )}
                    </div>
                </div>
                {rankingMode !== 'all' && (<div className="text-xs text-gray-400 text-right flex items-center justify-end gap-1"><CalendarDays size={12} />Visualizando: <span className="font-medium text-gray-600">{rankedTasks.rangeLabel}</span></div>)}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {rankedTasks.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                        <Clock className="mb-2 opacity-20" size={48} />
                        <p className="text-sm">Nenhuma atividade.</p>
                    </div>
                ) : (
                    rankedTasks.items.map((task, index) => (
                        <div key={task.id} className="group">
                            <div className="flex justify-between items-end mb-1">
                                <div className="flex items-center gap-2 max-w-[70%]">
                                    <span className={`font-mono text-xs w-5 text-center rounded ${index < 3 ? 'bg-purple-100 text-purple-700 font-bold' : 'text-gray-400'}`}>#{index + 1}</span>
                                    <span className="font-medium text-gray-700 text-sm truncate" title={task.title}>{task.title}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* Exibe o tempo PRÓPRIO em pequeno e cinza */}
                                    {Number(task.selfHours) > 0 && task.hours !== task.selfHours && (
                                        <span className="text-[10px] text-gray-400 mr-1" title="Tempo executado na própria tarefa (sem filhos)">
                                            (Próprio: {task.selfHours}h)
                                        </span>
                                    )}
                                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded" title="Total Acumulado (Próprio + Filhos)">
                                        {task.hours}h
                                    </span>
                                </div>
                            </div>
                            
                            {/* BARRA DE PROGRESSO DUPLA */}
                            <div className="w-full h-2.5 bg-gray-50 rounded-full overflow-hidden flex items-center relative">
                                {/* Barra Total (Fundo mais claro) */}
                                <div 
                                    className="h-full bg-purple-200 absolute left-0 top-0 z-0" 
                                    style={{ width: `${task.percent}%` }} 
                                    title={`Tempo Agregado: ${task.hours}h`}
                                />
                                {/* Barra Própria (Frente mais escura) */}
                                <div 
                                    className="h-full bg-purple-600 relative z-10 rounded-full" 
                                    style={{ width: `${(task.selfDuration / task.totalDuration) * task.percent}%` }} 
                                    title={`Tempo Próprio: ${task.selfHours}h`}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* PRAZOS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[400px] overflow-y-auto">
            <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2 sticky top-0 bg-white pb-2 border-b border-gray-100 z-10"><Hourglass size={20} className="text-orange-500" /> Prazos e Progresso</h3>
            {!deadlines || deadlines.length === 0 ? (<div className="text-center py-10 text-gray-400"><p className="text-sm">Sem prazos.</p></div>) : (
                <div className="space-y-4">{deadlines.map(task => { const isOverdue = task.daysLeft < 0; const isUrgent = task.daysLeft <= 3 && !isOverdue; const realProgress = task.progress || 0; return (<div key={task.id} className="group"><div className="flex justify-between items-end mb-1"><div className="flex flex-col min-w-0"><span className={`font-medium text-gray-700 text-sm flex items-center gap-2 ${!!task.parentId ? 'pl-2 border-l-2 border-gray-200' : ''}`}>{isOverdue && <AlertTriangle size={14} className="text-red-500 shrink-0" />}<span className="truncate" title={task.title}>{task.title}</span></span></div><div className="flex items-center gap-2 text-right"><span className="text-[10px] font-mono text-gray-400">{realProgress}%</span><span className={`text-xs font-bold whitespace-nowrap min-w-[35px] text-right ${isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-600'}`}>{isOverdue ? `-${Math.abs(task.daysLeft)}d` : `${task.daysLeft}d`}</span></div></div><div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : isUrgent ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${realProgress}%` }} /></div></div>); })}</div>
            )}
        </div>
      </div>
      
      {/* DIÁRIO DE SENTIMENTOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[500px]">
        <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600"><MessageSquare size={18} /></div>
                <div>
                    <h3 className="font-bold text-gray-800">Diário de Sentimentos</h3>
                    <p className="text-xs text-gray-400">Filtrado por: <span className="font-semibold text-gray-600 capitalize">{calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span></p>
                </div>
            </div>
            <div className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">
                {journalEntries.length} registros
            </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 bg-gray-50/30">
            {journalEntries.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                    <Quote size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum registro neste mês.</p>
                    <p className="text-xs mt-1">Mude o mês no calendário acima ou escreva algo ao iniciar uma tarefa.</p>
                </div>
            ) : (
                journalEntries.map((entry) => (
                    <div key={entry.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <CalendarDays size={10} />
                                    {entry.date.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <h4 className="font-bold text-gray-800 text-sm mt-1">{entry.taskTitle}</h4>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${getStressBadge(entry.stressLevel)}`}>
                                Stress: {entry.stressLevel}
                            </span>
                        </div>
                        <p className="text-gray-600 text-sm italic border-l-4 border-indigo-100 pl-3 py-1 leading-relaxed bg-gray-50 rounded-r-lg">
                            "{entry.note}"
                        </p>
                    </div>
                ))
            )}
        </div>
      </div>

    </div>
  );
}
