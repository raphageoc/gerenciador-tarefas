// src/components/StressCalendar.tsx
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Brain } from 'lucide-react';

interface StressData {
  date: string;
  level: number;
  count: number;
}

interface Props {
  data: StressData[];
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayClick?: (date: Date) => void; // Adicionado
}

export function StressCalendar({ data, currentDate, onPrevMonth, onNextMonth, onDayClick }: Props) {
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];

    // Preencher dias vazios antes do dia 1
    const firstDayIndex = date.getDay();
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Preencher dias do mês
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    
    // Completar o grid para ter sempre 42 células
    while (days.length < 42) {
        days.push(null);
    }
    
    return days;
  }, [currentDate]);

  // CORREÇÃO DE FUSO: Igualamos a lógica do Dashboard para encontrar os dados
  const getStressInfo = (date: Date) => {
    const offsetMs = date.getTimezoneOffset() * 60000;
    const dateStr = new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
    return data.find(d => d.date === dateStr);
  };

  const getStyle = (level: number) => {
    if (level === 0) return 'bg-white border-gray-100 hover:border-gray-200 text-gray-400';
    if (level <= 2) return 'bg-blue-50 border-blue-100 text-blue-600';     
    if (level <= 4) return 'bg-green-50 border-green-100 text-green-600';   
    if (level <= 6) return 'bg-yellow-50 border-yellow-100 text-yellow-600'; 
    if (level <= 8) return 'bg-orange-50 border-orange-100 text-orange-600'; 
    return 'bg-red-50 border-red-100 text-red-600';                         
  };

  const monthName = currentDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
            <Brain size={18} className="text-purple-600" />
            Mapa de Stress
        </h3>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
            <button onClick={onPrevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded transition text-gray-500">
                <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-gray-600 uppercase w-24 text-center">{monthName}</span>
            <button onClick={onNextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded transition text-gray-500">
                <ChevronRight size={16} />
            </button>
        </div>
      </div>

      {/* Cabeçalho dos Dias */}
      <div className="grid grid-cols-7 mb-1 flex-shrink-0">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
             <div key={d} className="text-center text-[10px] font-bold text-gray-400">{d}</div>
        ))}
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-1 min-h-0">
        {daysInMonth.map((date, i) => {
            if (!date) return <div key={i}></div>;

            const info = getStressInfo(date);
            const hasData = info && info.count > 0;
            const level = info?.level || 0;
            const styles = getStyle(level);

            return (
                <div 
                    key={i}
                    onClick={() => onDayClick && onDayClick(date)} // Ação de clique
                    className={`
                        relative border rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 hover:z-10
                        ${styles}
                    `}
                    title={hasData ? `Média: ${level.toFixed(1)} | Sessões: ${info.count}` : ''}
                >
                    <span className={`absolute top-0.5 right-1.5 text-[9px] font-medium opacity-70 ${hasData ? 'text-inherit' : 'text-gray-400'}`}>
                        {date.getDate()}
                    </span>

                    {hasData && (
                        <span className="font-bold leading-none tracking-tight" style={{ fontSize: '0.85rem' }}>
                            {level.toFixed(1)}
                        </span>
                    )}
                </div>
            );
        })}
      </div>
      
      {/* Legenda */}
      <div className="flex justify-between items-center text-[9px] text-gray-400 mt-2 pt-2 border-t border-gray-50 flex-shrink-0">
         <span>Baixo</span>
         <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-200"></div>
            <div className="w-2 h-2 rounded-full bg-green-200"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-200"></div>
            <div className="w-2 h-2 rounded-full bg-orange-200"></div>
            <div className="w-2 h-2 rounded-full bg-red-200"></div>
         </div>
         <span>Alto</span>
      </div>

    </div>
  );
}