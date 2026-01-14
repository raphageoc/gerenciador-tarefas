// src/components/ProjectCalendar.tsx
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface Props {
  data: { date: string; hours: number }[]; 
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function ProjectCalendar({ data, currentDate, onPrevMonth, onNextMonth }: Props) {
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dataMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(d => map[d.date] = d.hours);
    return map;
  }, [data]);

  // Evita divisão por zero
  const maxHours = Math.max(...data.map(d => d.hours), 1);

  // Gera o grid de 42 dias
  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [firstDayOfMonth, daysInMonth]);

  const getStyles = (hours: number) => {
    if (hours === 0) return { 
        containerClass: 'bg-white border-gray-100 hover:border-gray-200',
        textClass: 'text-gray-300',
        fontSize: '0.8rem'
    };
    
    const ratio = hours / maxHours;
    let containerClass = '';
    let textClass = '';
    
    if (ratio < 0.25) {
        containerClass = 'bg-blue-50 border-blue-100';
        textClass = 'text-blue-600';
    } else if (ratio < 0.50) {
        containerClass = 'bg-blue-100 border-blue-200';
        textClass = 'text-blue-700';
    } else if (ratio < 0.75) {
        containerClass = 'bg-blue-200 border-blue-300';
        textClass = 'text-blue-800';
    } else {
        containerClass = 'bg-blue-600 border-blue-600 shadow-sm';
        textClass = 'text-white';
    }

    const fontSize = `${0.85 + (ratio * 0.6)}rem`; 

    return { containerClass, textClass, fontSize };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 select-none h-full flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
            <CalendarDays size={18} className="text-blue-600" />
            Atividade Mensal
        </h3>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
            <button onClick={onPrevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded transition text-gray-500"><ChevronLeft size={16} /></button>
            <span className="text-xs font-semibold text-gray-600 uppercase w-24 text-center">
                {currentDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={onNextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded transition text-gray-500"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Dias da Semana - CORRIGIDO O KEY AQUI */}
      <div className="grid grid-cols-7 mb-1 flex-shrink-0">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-gray-400">
                {day}
            </div>
        ))}
      </div>

      {/* Grid Calendário */}
      <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-1 min-h-0">
        {calendarCells.map((day, index) => {
            if (day === null) return <div key={`empty-${index}`} />;
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hours = dataMap[dateStr] || 0;
            const { containerClass, textClass, fontSize } = getStyles(hours);

            const hoursDisplay = hours > 0 
                ? (Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`)
                : null;

            return (
                <div 
                    key={day}
                    className={`
                        relative border rounded-lg flex flex-col items-center justify-center transition-all
                        ${containerClass}
                    `}
                    title={hours > 0 ? `${day}/${month+1}: ${hours.toFixed(2)} horas trabalhadas` : ''}
                >
                    <span className={`absolute top-0.5 right-1.5 text-[9px] font-medium ${hours > 0 ? textClass : 'text-gray-400'} opacity-70`}>
                        {day}
                    </span>

                    {hours > 0 && (
                        <span 
                            className={`font-bold leading-none tracking-tight ${textClass}`}
                            style={{ fontSize }}
                        >
                            {hoursDisplay}
                        </span>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
}
