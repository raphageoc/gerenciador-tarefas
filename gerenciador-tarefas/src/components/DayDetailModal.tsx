// src/components/DayDetailModal.tsx
import { useMemo } from 'react';
import { X, Calendar, Activity, Clock } from 'lucide-react';
import { type Task } from '../db';

interface Props {
  date: Date | null;
  isOpen: boolean;
  onClose: () => void;
  allTasks: Task[] | undefined;
}

export function DayDetailModal({ date, isOpen, onClose, allTasks }: Props) {
  if (!isOpen || !date || !allTasks) return null;

  const dateLabel = date.toLocaleDateString('pt-BR', { 
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' 
  });

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

  // --- PROCESSAMENTO DE DADOS ---
  const { daySessions, stats } = useMemo(() => {
    const sessionsList: { 
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
            task.sessions.forEach(session => {
                const sStart = new Date(session.start);
                // Verifica se a sessão pertence ao dia (ajustando fuso)
                if (getLocalYMD(sStart) === targetStr) {
                    const sEnd = session.end ? new Date(session.end) : new Date();
                    sessionsList.push({
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

    // Estatísticas
    const totalMs = sessionsList.reduce((acc, s) => acc + s.durationMs, 0);
    const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(1);

    return { daySessions: sessionsList, stats: { totalHours } };
  }, [date, allTasks]);

  // --- COMPONENTE DE LINHA DO TEMPO (ROW) ---
  const TimelineRow = ({ startHour, endHour, label }: { startHour: number, endHour: number, label: string }) => {
    const totalMinutes = (endHour - startHour) * 60;

    // Filtra e processa sessões que caem neste intervalo
    const blocks = daySessions.map(session => {
        // Datas de referência para este turno (Ex: Dia X as 00:00 até Dia X as 12:00)
        // Precisamos criar datas completas para comparar corretamente
        const rowStart = new Date(date); rowStart.setHours(startHour, 0, 0, 0);
        const rowEnd = new Date(date); rowEnd.setHours(endHour, 0, 0, 0);

        // Se o turno for até meia noite (24h), o JS entende 24h como 00h do dia seguinte, o que é correto para comparação
        if (endHour === 24) {
             rowEnd.setDate(rowEnd.getDate() + 1);
             rowEnd.setHours(0, 0, 0, 0);
        }

        // Interseção de horários:
        // O início visual é o maior valor entre (Início da Sessão) e (Início do Turno)
        const visualStart = session.start > rowStart ? session.start : rowStart;
        // O fim visual é o menor valor entre (Fim da Sessão) e (Fim do Turno)
        const visualEnd = session.end < rowEnd ? session.end : rowEnd;

        // Se o início visual for depois do fim visual, a tarefa não existe neste turno
        if (visualStart >= visualEnd) return null;

        // Cálculos de posição CSS
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

    // Grid de Horas (Marcações)
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    return (
        <div className="mb-8">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                {label} <span className="h-px flex-1 bg-gray-200"></span>
            </h4>
            
            <div className="relative h-20 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {/* Linhas de Grade (Horas) */}
                {hours.map((h, i) => {
                     // Não desenha a última linha para não quebrar layout
                     if (i === hours.length - 1) return null; 
                     return (
                        <div 
                            key={h} 
                            className="absolute top-0 bottom-0 border-l border-gray-200/60 text-[10px] text-gray-400 pl-1 pt-1"
                            style={{ left: `${(i / (hours.length - 1)) * 100}%` }}
                        >
                            {h}h
                        </div>
                     );
                })}

                {/* Blocos de Tarefas */}
                {blocks.map((block, idx) => (
                    <div 
                        key={idx}
                        className={`absolute top-6 h-10 rounded-md shadow-sm border border-white/20 hover:brightness-110 hover:scale-[1.01] hover:z-10 transition-all cursor-help flex items-center justify-center overflow-hidden group ${block?.color}`}
                        style={{ 
                            left: block?.left, 
                            width: block?.width,
                            minWidth: '4px' // Garante visibilidade mínima
                        }}
                        title={`${block?.taskTitle}\n${block?.displayStart.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${block?.displayEnd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                    >
                        {/* Texto só aparece se o bloco for largo o suficiente */}
                        <span className="text-[10px] font-bold text-white whitespace-nowrap px-1 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity truncate">
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
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
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
        <div className="flex-1 overflow-y-auto p-8">
            
            {daySessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Clock size={48} className="mb-4 opacity-20"/>
                    <p>Nenhuma atividade registrada neste dia.</p>
                </div>
            ) : (
                <>
                    {/* Linha 1: Manhã (00:00 - 12:00) */}
                    <TimelineRow startHour={0} endHour={12} label="Madrugada / Manhã (00:00 - 12:00)" />

                    {/* Linha 2: Tarde/Noite (12:00 - 24:00) */}
                    <TimelineRow startHour={12} endHour={24} label="Tarde / Noite (12:00 - 23:59)" />
                    
                    {/* Legenda simples */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <h5 className="text-xs font-bold text-gray-500 mb-3">Tarefas Realizadas</h5>
                        <div className="flex flex-wrap gap-3">
                            {/* Remove duplicatas para legenda */}
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

        </div>
      </div>
    </div>
  );
}