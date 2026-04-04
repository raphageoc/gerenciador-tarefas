// src/components/TaskItem.tsx
// src/components/TaskItem.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CheckSquare, Square, Plus, 
  Trash2, Calendar, ArrowRight, Edit2, 
  ChevronRight, ChevronDown 
} from 'lucide-react';
import { db, type Task } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MoveTaskModal } from './MoveTaskModal';
import { useNavigate } from 'react-router-dom';

interface Props {
  task: Task;
  depth?: number;
  onNavigate?: (taskId: number) => void; // NOVO: Prop opcional para customizar a navegação
}

// Formatador adicionado apenas para a exibição compacta de data e hora
const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
};

export function TaskItem({ task, depth = 0, onNavigate }: Props) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const allTasks = useLiveQuery(() => db.tasks.toArray());

  const subtasks = useLiveQuery(
    () => task.id ? db.tasks.where('parentId').equals(task.id).toArray() : [],
    [task.id]
  );
  
  const sortedSubtasks = subtasks?.sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return 0;
  });

  const hasSubtasks = sortedSubtasks && sortedSubtasks.length > 0;

  useEffect(() => {
    if (hasSubtasks && !isExpanded && sortedSubtasks.length === 1) {
       // setIsExpanded(true); 
    }
  }, [sortedSubtasks?.length]);

  const calculatedProgress = useMemo(() => {
    if (!allTasks || !task.id) return task.status === 'done' ? 100 : 0;
    const getRecursive = (taskId: number): number => {
        const children = allTasks.filter(t => t.parentId === taskId);
        if (children.length === 0) {
            const t = allTasks.find(x => x.id === taskId);
            return t?.status === 'done' ? 100 : 0;
        }
        const total = children.reduce((acc, child) => {
            if (child.id) return acc + getRecursive(child.id);
            return acc;
        }, 0);
        return total / children.length;
    };
    return getRecursive(task.id);
  }, [allTasks, task]);

  const updateParentStatusRecursively = async (parentId: number) => {
      const siblings = await db.tasks.where('parentId').equals(parentId).toArray();
      const parent = await db.tasks.get(parentId);
      if (!parent) return;
      const allDone = siblings.every(t => t.status === 'done');
      if (allDone) {
          if (parent.status !== 'done') {
              // Apenas adicionado: completedAt
              await db.tasks.update(parentId, { status: 'done', progress: 100, completedAt: new Date() });
              if (parent.parentId) await updateParentStatusRecursively(parent.parentId);
          }
      } else {
          if (parent.status === 'done') {
              // Apenas adicionado: remover completedAt
              await db.tasks.update(parentId, { status: 'todo', progress: 0, completedAt: undefined as any });
              if (parent.parentId) await updateParentStatusRecursively(parent.parentId);
          }
      }
  };

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const newProgress = newStatus === 'done' ? 100 : 0;
    
    // Apenas adicionado: Definir a data se concluído
    const newCompletedAt = newStatus === 'done' ? new Date() : undefined as any;
    
    await db.tasks.update(task.id, { status: newStatus, progress: newProgress, completedAt: newCompletedAt });
    if (task.parentId) await updateParentStatusRecursively(task.parentId);
  };

  const handleSave = async () => {
    if (task.id && editTitle.trim()) {
      await db.tasks.update(task.id, { title: editTitle });
      setIsEditing(false);
    }
  };

  const handleNavigate = () => {
      if (!task.id) return;
      
      if (onNavigate) {
          onNavigate(task.id);
      } else {
          navigate(`/focus/${task.id}`);
      }
  };

  const handleAddSubtask = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!task.id) return;
    const title = prompt("Nome da nova subtarefa:");
    if (!title || !title.trim()) return;
    await db.tasks.add({ 
      parentId: task.id, title: title.trim(), description: '', status: 'todo', progress: 0, 
      createdAt: new Date(), timeSpentMs: 0, sessions: [], resources: [], links: [] 
    });
    setIsExpanded(true);
    if (task.status === 'done') {
        // Apenas adicionado: remover completedAt ao reabrir
        await db.tasks.update(task.id, { status: 'todo', progress: 0, completedAt: undefined as any });
        if (task.parentId) await updateParentStatusRecursively(task.parentId);
    }
  };

  const handleDelete = async () => {
    if (confirm('Excluir esta tarefa e todas as subtarefas?')) {
        const parentId = task.parentId;
        const deleteRecursive = async (id: number) => {
            const children = await db.tasks.where('parentId').equals(id).toArray();
            for (const child of children) {
                if (child.id) await deleteRecursive(child.id);
            }
            await db.tasks.delete(id);
        };
        if(task.id) await deleteRecursive(task.id);
        if (parentId) await updateParentStatusRecursively(parentId);
    }
  };

  const handleDateClick = () => {
    if (dateInputRef.current) {
        try { dateInputRef.current.showPicker(); } catch { dateInputRef.current.click(); }
    }
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!task.id) return;
      const val = e.target.value;
      if (!val) {
          await db.tasks.update(task.id, { deadline: undefined });
      } else {
          const newDate = new Date(val + 'T12:00:00'); 
          await db.tasks.update(task.id, { deadline: newDate });
      }
  };

  const dateValue = task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '';

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      <div 
        className={`group flex items-start gap-2 py-3 px-2 rounded-xl transition-all border border-transparent hover:border-gray-100 hover:bg-white hover:shadow-sm cursor-pointer ${task.status === 'done' ? 'opacity-60' : ''}`}
        onClick={!isEditing ? handleNavigate : undefined}
      >
        <button onClick={toggleExpand} className={`mt-1 p-0.5 rounded hover:bg-gray-100 text-gray-400 transition-colors shrink-0 ${!hasSubtasks ? 'invisible' : ''}`}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <button onClick={toggleStatus} className={`mt-0.5 transition-colors shrink-0 ${task.status === 'done' ? 'text-gray-400' : 'text-gray-300 hover:text-blue-500'}`}>
          {task.status === 'done' ? <CheckSquare size={20} /> : <Square size={20} />}
        </button>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input autoFocus className="w-full bg-gray-50 border border-blue-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-100" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={handleSave} onKeyDown={(e) => e.key === 'Enter' && handleSave()} onClick={(e) => e.stopPropagation()} />
          ) : (
            <div className="flex flex-col gap-1">
                <span className={`text-sm font-medium leading-tight ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{task.title}</span>
                <div className="flex items-center flex-wrap gap-3">
                    {task.deadline && (<span className={`text-[10px] flex items-center gap-1 ${new Date(task.deadline) < new Date() && task.status !== 'done' ? 'text-red-500 font-bold' : 'text-gray-400'}`}><Calendar size={10} /> {new Date(task.deadline).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>)}
                    {hasSubtasks && (<div className="flex items-center gap-2"><div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${calculatedProgress}%` }} /></div><span className="text-[10px] text-gray-400 font-mono">{Math.round(calculatedProgress)}%</span></div>)}
                    
                    {/* Apenas as datas foram adicionadas visualmente aqui: */}
                    {task.createdAt && <span className="text-[10px] text-gray-400 font-mono">Criada: {formatDateTime(task.createdAt)}</span>}
                    {task.status === 'done' && task.completedAt && <span className="text-[10px] text-gray-400 font-mono">Feita: {formatDateTime(task.completedAt)}</span>}
                </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity self-start md:self-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleAddSubtask} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Adicionar Subtarefa"><Plus size={18} /></button>
            <div className="relative">
                <button onClick={handleDateClick} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Definir Data Limite"><Calendar size={16} /></button>
                <input type="date" ref={dateInputRef} value={dateValue} onChange={handleDateChange} className="absolute opacity-0 w-0 h-0 pointer-events-none" />
            </div>
            <button onClick={() => setIsEditing(true)} className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors" title="Editar Título"><Edit2 size={16} /></button>
            <button onClick={() => setIsMoveModalOpen(true)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Mover Tarefa"><ArrowRight size={18} /></button>
            <button onClick={handleDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={16} /></button>
        </div>
      </div>
      {isExpanded && sortedSubtasks && sortedSubtasks.length > 0 && (
        <div className="pl-4 ml-3 border-l border-gray-100 space-y-1">
            {/* Repassa o onNavigate para os filhos recursivamente */}
            {sortedSubtasks.map(subtask => (
            <TaskItem key={subtask.id} task={subtask} depth={depth + 1} onNavigate={onNavigate} />
            ))}
        </div>
      )}
      <MoveTaskModal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} task={task} />
    </div>
  );
}