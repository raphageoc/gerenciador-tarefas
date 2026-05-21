// src/components/DayDetailModal.tsx
import { useMemo, useState } from 'react';
import { X, Calendar, Activity, Clock, Save } from 'lucide-react';
import { db, type Task, type TaskResource } from '../db';

interface Props {
  date: Date | null;
  isOpen: boolean;
  onClose: () => void;
  allTasks: Task[] | undefined;
}

// Helper para formatar data para o input nativo HTML (datetime-local)
const formatDateTimeLocal = (date: Date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function DayDetailModal({ date, isOpen, onClose, allTasks }: Props) {
  // 1. TODOS OS HOOKS DEVEM FICAR NO TOPO (Antes de qualquer return)
  const [editingSession, setEditingSession] = useState<{
    taskId: number;
    sessionIndex: number;
    title: string;
    startStr: string;
    endStr: string;
  } | null>(null);

  // --- CORES CONSISTENTES POR PROJETO ---
  const getTaskColor = (title: string) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 
      'bg-violet-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 
      'bg-orange-500', 'bg-cyan-500'
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // 2. USE MEMO TAMBÉM VAI ANTES DO RETURN
  const { daySessions, stats } = useMemo(() => {
    // Se não tiver data ou tasks, retorna vazio sem quebrar
    if (!date || !allTasks) return { daySessions: [], stats: { totalHours: '0.0' } };

    const sessionsList: { 
        taskId: number;
        sessionIndex: number;
        taskTitle: string; 
        start: Date; 
        end: Date; 
        durationMs: number; 
        color: string;
    }[] = [];

    const getLocalYMD = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };
    
    const targetStr = getLocalYMD(date);

    allTasks.forEach(task => {
        if (task.sessions) {
            task.sessions.forEach((session, index) => {
                const sStart = new Date(session.start);
                if (getLocalYMD(sStart) === targetStr) {
                    const sEnd = session.end ? new Date(session.end) : new Date();
                    sessionsList.push({
                        taskId: task.id!, 
                        sessionIndex: index, 
                        taskTitle: task.title,
                        start: sStart,
                        end: sEnd,
                        durationMs: sEnd.getTime() - sStart.getTime(),
                        color: getTaskColor(task.title)
                    });
                }
            });
        }
    });

    const totalMs = sessionsList.reduce((acc, s) => acc + s.durationMs, 0);
    const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(1);

    return { daySessions: sessionsList, stats: { totalHours } };
  }, [date, allTasks]);

  // 3. AGORA SIM, O RETURN ANTECIPADO (Depois de todos os hooks)
  if (!isOpen || !date || !allTasks) return null;

  const dateLabel = date.toLocaleDateString('pt-BR', { 
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' 
  });

  // --- FUNÇÕES DE EDIÇÃO E SALVAMENTO ---
  const handleEditClick = (block: typeof daySessions[0]) => {
      setEditingSession({
          taskId: block.taskId,
          sessionIndex: block.sessionIndex,
          title: block.taskTitle,
          startStr: formatDateTimeLocal(block.start),
          endStr: formatDateTimeLocal(block.end)
      });
  };

  const handleSaveSession = async () => {
      if (!editingSession) return;
      
      const newStart = new Date(editingSession.startStr);
      const newEnd = new Date(editingSession.endStr);

      if (newEnd <= newStart) {
          alert("O horário de fim não pode ser menor ou igual ao horário de início.");
          return;
      }

      const task = await db.tasks.get(editingSession.taskId);
      if (!task || !task.sessions) return;

      task.sessions[editingSession.sessionIndex].start = newStart;
      task.sessions[editingSession.sessionIndex].end = newEnd;

      const newTotalMs = task.sessions.reduce((acc, s) => {
          const sEnd = s.end ? new Date(s.end) : new Date();
          const sStart = new Date(s.start);
          const diff = sEnd.getTime() - sStart.getTime();
          return acc + Math.max(0, diff);
      }, 0);

      await db.tasks.update(task.id!, { 
          sessions: task.sessions, 
          timeSpentMs: newTotalMs 
      });

      setEditingSession(null); 
  };

  // --- COMPONENTE DE LINHA DO TEMPO (ROW) ---
  const TimelineRow = ({ startHour, endHour, label }: { startHour: number, endHour: number, label: string }) => {
    const totalMinutes = (endHour - startHour) * 60;

    const blocks = daySessions.map(session => {
        const rowStart = new Date(date); rowStart.setHours(startHour, 0, 0, 0);
        const rowEnd = new Date(date); rowEnd.setHours(endHour, 0, 0, 0);

        if (endHour === 24) {
             rowEnd.setDate(rowEnd.getDate() + 1);
             rowEnd.setHours(0, 0, 0, 0);
        }

        const visualStart = session.start > rowStart ? session.start : rowStart;
        const visualEnd = session.end < rowEnd ? session.end : rowEnd;

        if (visualStart >= visualEnd) return null;

        const startDiffMinutes = (visualStart.getTime() - rowStart.getTime()) / 60000;
        const durationMinutes = (visualEnd.getTime() - visualStart.getTime()) / 60000;

        const leftPercent = (startDiffMinutes / totalMinutes) * 100;
        const widthPercent = (durationMinutes / totalMinutes) * 100;

        return {
            ...session,
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            displayStart: visualStart,
            displayEnd: visualEnd
        };
    }).filter(block => block !== null);

    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    return (
        <div className="mb-8">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                {label} <span className="h-px flex-1 bg-gray-200"></span>
            </h4>
            
            <div className="relative h-20 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {hours.map((h, i) => {
                     if (i === hours.length - 1) return null; 
                     return (
                        <div 
                            key={h} 
                            className="absolute top-0 bottom-0 border-l border-gray-200/60 text-[10px] text-gray-400 pl-1 pt-1 pointer-events-none"
                            style={{ left: `${(i / (hours.length - 1)) * 100}%` }}
                        >
                            {h}h
                        </div>
                     );
                })}

                {blocks.map((block, idx) => (
                    <div 
                        key={idx}
                        onClick={() => handleEditClick(block!)}
                        className={`absolute top-6 h-10 rounded-md shadow-sm border border-white/20 hover:brightness-110 hover:scale-[1.01] hover:z-10 transition-all cursor-pointer flex items-center justify-center overflow-hidden group ${block?.color}`}
                        style={{ 
                            left: block?.left, 
                            width: block?.width,
                            minWidth: '4px' 
                        }}
                        title={`Clique para editar\n${block?.taskTitle}\n${block?.displayStart.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${block?.displayEnd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                    >
                        <span className="text-[10px] font-bold text-white whitespace-nowrap px-1 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity truncate pointer-events-none">
                            {parseFloat(block!.width) > 5 ? block?.taskTitle : ''}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl shrink-0">
          <div>
             <h3 className="text-xl font-bold text-gray-800 capitalize flex items-center gap-2">
                <Calendar className="text-blue-600" /> {dateLabel}
             </h3>
             <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Clock size={14}/> Tempo Produtivo: {stats.totalHours}h</span>
                <span className="flex items-center gap-1"><Activity size={14}/> {daySessions.length} sessões</span>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-8 relative">
            
            {daySessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Clock size={48} className="mb-4 opacity-20"/>
                    <p>Nenhuma atividade registrada neste dia.</p>
                </div>
            ) : (
                <>
                    <p className="text-xs text-blue-500 mb-6 flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        Dica: Clique em qualquer bloco na linha do tempo para editar os horários exatos daquela sessão.
                    </p>

                    <TimelineRow startHour={0} endHour={12} label="Madrugada / Manhã (00:00 - 12:00)" />
                    <TimelineRow startHour={12} endHour={24} label="Tarde / Noite (12:00 - 23:59)" />
                    
                    {/* Legenda simples */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <h5 className="text-xs font-bold text-gray-500 mb-3">Tarefas Realizadas</h5>
                        <div className="flex flex-wrap gap-3">
                            {Array.from(new Set(daySessions.map(s => s.taskTitle))).map(title => {
                                const session = daySessions.find(s => s.taskTitle === title);
                                return (
                                    <div key={title} className="flex items-center gap-2 text-xs bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <div className={`w-3 h-3 rounded-full ${session?.color}`}></div>
                                        <span className="text-gray-700">{title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* MODAL DE EDIÇÃO DE SESSÃO SOBREPOSTO */}
            {editingSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100 scale-in-center">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">Editar Horários</h3>
                            <button onClick={() => setEditingSession(null)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
                        </div>
                        <p className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded mb-6 truncate border border-blue-100" title={editingSession.title}>
                            {editingSession.title}
                        </p>
                        
                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Início da Tarefa</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                                    value={editingSession.startStr}
                                    onChange={e => setEditingSession({...editingSession, startStr: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Fim da Tarefa</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                                    value={editingSession.endStr}
                                    onChange={e => setEditingSession({...editingSession, endStr: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setEditingSession(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSaveSession} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold transition-colors shadow-sm flex items-center justify-center gap-2">
                                <Save size={16} /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}