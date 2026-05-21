// src/components/DeadlineAlertModal.tsx

// src/components/DeadlineAlertModal.tsx
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { type Task } from '../db';

interface Props {
  tasks: (Task & { daysLeft: number })[];
  onClose: () => void;
}

export function DeadlineAlertModal({ tasks, onClose }: Props) {
  const navigate = useNavigate();
  
  // Filtra para garantir que pegamos até 30 dias
  const monthTasks = tasks.filter(t => t.daysLeft <= 30);
  
  if (monthTasks.length === 0) return null;

  // Verifica se há algo muito urgente (3 dias ou menos) para mudar o título e ícone
  const hasCritical = monthTasks.some(t => t.daysLeft <= 3);
  const title = hasCritical ? "Atenção: Prazos Críticos!" : "Seus Prazos do Mês";

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-xl ${hasCritical ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {hasCritical ? <AlertTriangle size={24} /> : <CalendarClock size={24} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 leading-tight">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Você tem {monthTasks.length} tarefa(s) com prazo próximo.</p>
          </div>
        </div>

        {/* Lista com scroll otimizado (Aumentei para 400px) */}
        <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto pr-1">
          {monthTasks.map(t => {
            const isOverdue = t.daysLeft < 0;
            const isCritical = t.daysLeft >= 0 && t.daysLeft <= 3;
            
            return (
              <button 
                key={t.id} 
                onClick={() => { onClose(); navigate(`/focus/${t.id}`); }}
                className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center group
                  ${isOverdue ? 'bg-red-50/50 border-red-100 hover:bg-red-50 hover:border-red-200' 
                  : isCritical ? 'bg-orange-50/50 border-orange-100 hover:bg-orange-50 hover:border-orange-200' 
                  : 'bg-gray-50 border-gray-100 hover:bg-blue-50 hover:border-blue-200'}`}
              >
                <span className="text-sm font-medium text-gray-700 truncate pr-3 group-hover:text-gray-900">
                  {t.title}
                </span>
                
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap
                  ${isOverdue ? 'bg-red-100 text-red-600' 
                  : isCritical ? 'bg-orange-100 text-orange-600' 
                  : 'bg-gray-200 text-gray-600'}`}
                >
                  {isOverdue ? `Atrasado ${Math.abs(t.daysLeft)}d` 
                    : t.daysLeft === 0 ? 'Vence Hoje' 
                    : `${t.daysLeft} dia(s)`}
                </span>
              </button>
            );
          })}
        </div>

        <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-md">
          Entendido
        </button>
      </div>
    </div>
  );
}