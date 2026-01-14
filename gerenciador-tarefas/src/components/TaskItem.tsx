// src/components/TaskItem.tsx
import { useState, useRef, useEffect } from 'react';
import { 
  CheckSquare, Square, MoreHorizontal, CornerDownRight, 
  Trash2, Plus, GripVertical, Calendar, ArrowRight, CornerRightUp
} from 'lucide-react';
import { db, Task } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MoveTaskModal } from './MoveTaskModal';

interface Props {
  task: Task;
  depth?: number;
}

export function TaskItem({ task, depth = 0 }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showMenu, setShowMenu] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const subtasks = useLiveQuery(
    () => task.id ? db.tasks.where('parentId').equals(task.id).toArray() : [],
    [task.id]
  );
  
  // Ordena subtarefas: Feitas vão para o final
  const sortedSubtasks = subtasks?.sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return 0;
  });

  const toggleStatus = async () => {
    if (!task.id) return;
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const newProgress = newStatus === 'done' ? 100 : 0;
    await db.tasks.update(task.id, { status: newStatus, progress: newProgress });
  };

  const handleSave = async () => {
    if (task.id && editTitle.trim()) {
      await db.tasks.update(task.id, { title: editTitle });
      setIsEditing(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!task.id) return;
    await db.tasks.add({ 
      parentId: task.id, 
      title: 'Nova etapa', 
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

  const handleDelete = async () => {
    if (confirm('Excluir esta tarefa e todas as subtarefas?')) {
        const deleteRecursive = async (id: number) => {
            const children = await db.tasks.where('parentId').equals(id).toArray();
            for (const child of children) {
                if (child.id) await deleteRecursive(child.id);
            }
            await db.tasks.delete(id);
        };
        if(task.id) await deleteRecursive(task.id);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Barra de progresso visual
  const p = task.progress !== undefined ? task.progress : (task.status === 'done' ? 100 : 0);

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      <div className={`group flex items-start gap-3 py-3 px-3 rounded-xl transition-all border border-transparent hover:border-gray-100 hover:bg-white hover:shadow-sm ${task.status === 'done' ? 'opacity-60' : ''}`}>
        
        {/* Checkbox */}
        <button onClick={toggleStatus} className={`mt-0.5 transition-colors ${task.status === 'done' ? 'text-gray-400' : 'text-gray-300 hover:text-blue-500'}`}>
          {task.status === 'done' ? <CheckSquare size={20} /> : <Square size={20} />}
        </button>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input 
              autoFocus
              className="w-full bg-gray-50 border border-blue-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-100"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          ) : (
            <div className="flex flex-col gap-1">
                <span onClick={() => setIsEditing(true)} className={`text-sm font-medium cursor-text leading-tight ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {task.title}
                </span>
                
                {/* Meta info e Progresso */}
                <div className="flex items-center gap-3">
                    {task.deadline && (
                        <span className={`text-[10px] flex items-center gap-1 ${new Date(task.deadline) < new Date() && task.status !== 'done' ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                            <Calendar size={10} /> {new Date(task.deadline).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                        </span>
                    )}
                    {subtasks && subtasks.length > 0 && (
                        <div className="flex items-center gap-2">
                             <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${p}%` }} />
                             </div>
                             <span className="text-[10px] text-gray-400 font-mono">{Math.round(p)}%</span>
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>

        {/* Ações - MODIFICADO AQUI: Opacity-100 no mobile, opacity-0 no desktop (md) */}
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity self-start md:self-center">
            <button onClick={handleAddSubtask} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Adicionar Subtarefa">
                <CornerDownRight size={16} />
            </button>
            <button onClick={() => setIsMoveModalOpen(true)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Mover Tarefa">
                <ArrowRight size={16} />
            </button>
            
            <div className="relative" ref={menuRef}>
                <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <MoreHorizontal size={16} />
                </button>
                {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <Trash2 size={14} /> Excluir
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Subtarefas Recursivas */}
      <div className="pl-4 ml-3 border-l border-gray-100 space-y-1">
        {sortedSubtasks?.map(subtask => (
          <TaskItem key={subtask.id} task={subtask} depth={depth + 1} />
        ))}
        {subtasks && subtasks.length > 0 && (
            <button onClick={handleAddSubtask} className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-blue-600 py-2 px-2 hover:bg-blue-50 rounded-lg w-fit transition-colors mt-1 opacity-0 group-hover:opacity-100 duration-200">
                <Plus size={12} /> Adicionar passo
            </button>
        )}
      </div>

      <MoveTaskModal 
        isOpen={isMoveModalOpen} 
        onClose={() => setIsMoveModalOpen(false)} 
        task={task} 
      />
    </div>
  );
}
