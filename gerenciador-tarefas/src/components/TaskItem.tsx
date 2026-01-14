// src/components/TaskItem.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../db';
import { 
  ChevronRight, ChevronDown, Plus, Trash2, 
  Check, Calendar, AlertCircle, X, FolderInput 
} from 'lucide-react';
import clsx from 'clsx';
import { MoveTaskModal } from './MoveTaskModal';

interface Props {
  task: Task;
}

export function TaskItem({ task }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const navigate = useNavigate();
  const dateInputRef = useRef<HTMLInputElement>(null);

  // 1. Busca Subtarefas
  const subtasks = useLiveQuery(async () => {
    if (!task.id) return [];
    return await db.tasks.where('parentId').equals(task.id).toArray();
  }, [task.id]);

  // 2. Cálculos de Progresso
  const totalSub = subtasks?.length || 0;
  const sumProgress = subtasks?.reduce((acc, t) => {
    const p = t.progress !== undefined ? t.progress : (t.status === 'done' ? 100 : 0);
    return acc + p;
  }, 0) || 0;

  const progressPercent = totalSub === 0 ? 0 : Math.round(sumProgress / totalSub);
  const hasChildren = totalSub > 0;

  // --- NAVEGAÇÃO (Novo Comportamento) ---
  const handleEnterProject = () => {
    navigate(`/focus/${task.id}`);
  };

  // --- DATA ---
  const handleDateButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dateInputRef.current) {
        try { dateInputRef.current.showPicker(); } catch (error) { dateInputRef.current.click(); }
    }
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!task.id) return;
    const dateStr = e.target.value;
    if (!dateStr) {
        await db.tasks.update(task.id, { deadline: undefined });
        return;
    }
    const newDeadline = new Date(dateStr + 'T23:59:59');
    await db.tasks.update(task.id, { deadline: newDeadline });
  };

  const clearDate = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (task.id) await db.tasks.update(task.id, { deadline: undefined });
  };

  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadlineDate && new Date() > deadlineDate && task.status !== 'done';
  const isDone = task.status === 'done';
  const formattedDate = deadlineDate ? deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

  const dateBtnClass = clsx(
      "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer shrink-0 z-20",
      isDone ? "bg-gray-50 text-gray-400 border-gray-100" : isOverdue ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : deadlineDate ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
  );

  // --- CRUD ---
  const updateParentProgress = async (parentId: number) => {
    const siblings = await db.tasks.where('parentId').equals(parentId).toArray();
    if (siblings.length === 0) return;
    const total = siblings.reduce((acc, t) => acc + (t.progress ?? (t.status === 'done' ? 100 : 0)), 0);
    const avg = Math.round(total / siblings.length);
    const newStatus = avg === 100 ? 'done' : 'todo';
    const parent = await db.tasks.get(parentId);
    if (parent && (parent.progress !== avg || parent.status !== newStatus)) {
      await db.tasks.update(parentId, { progress: avg, status: newStatus });
      if (parent.parentId) await updateParentProgress(parent.parentId);
    }
  };

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const newProgress = newStatus === 'done' ? 100 : 0;
    await db.tasks.update(task.id, { status: newStatus, progress: newProgress });
    if (task.parentId) await updateParentProgress(task.parentId);
  };

  const addSubtask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const title = prompt(`Nova subtarefa para "${task.title}":`);
    if (!title || !task.id) return;
    await db.tasks.add({ parentId: task.id, title, description: '', status: 'todo', progress: 0, createdAt: new Date(), timeSpentMs: 0, sessions: [], resources: [], links: [] });
    await updateParentProgress(task.id);
    setIsExpanded(true);
  };

  const deleteRecursive = async (id: number) => {
    const children = await db.tasks.where('parentId').equals(id).toArray();
    for (const child of children) {
        if (child.id) await deleteRecursive(child.id);
    }
    await db.tasks.delete(id);
  };

  const deleteTask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja apagar "${task.title}" e todos os seus itens?`)) {
      if (task.id) {
        await deleteRecursive(task.id);
        if (task.parentId) await updateParentProgress(task.parentId);
      }
    }
  };

  const handleMoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMoveModal(true);
  };

  return (
    <>
        <div className="select-none flex flex-col">
            <div 
                className={clsx(
                "group flex items-center gap-3 p-3 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all duration-200 cursor-pointer relative",
                task.status === 'done' && "opacity-60"
                )}
                // MUDANÇA: Clicar no container navega para o foco
                onClick={handleEnterProject}
                title="Clique para entrar no Modo Foco"
            >
                {/* Barra de Progresso */}
                {hasChildren && task.status !== 'done' && (
                   <div className="absolute bottom-0 left-0 h-[2px] bg-blue-500/10 transition-all duration-500 rounded-b-lg" style={{ width: `${progressPercent}%` }} />
                )}

                {/* Seta Expandir (Stop Propagation para não entrar no projeto) */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                  className={clsx("p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors z-10", !hasChildren && "opacity-0 pointer-events-none")}
                  title={isExpanded ? "Colapsar" : "Expandir"}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* Checkbox */}
                <button 
                  onClick={toggleStatus}
                  className={clsx("w-5 h-5 rounded-md border flex items-center justify-center transition-all z-10 flex-shrink-0", task.status === 'done' ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-blue-400 text-transparent")}
                >
                  <Check size={12} strokeWidth={3} />
                </button>

                {/* Conteúdo Central */}
                <div className="flex-1 min-w-0 z-10 flex items-center gap-3 flex-wrap">
                    <span className={clsx("truncate font-medium transition-colors text-base mr-auto", task.status === 'done' ? "line-through text-gray-500" : "text-gray-700")}>
                      {task.title}
                    </span>

                    {/* Data */}
                    <button onClick={handleDateButtonClick} className={dateBtnClass} title={formattedDate ? `Prazo: ${formattedDate}` : "Definir Prazo"}>
                        {isOverdue ? <AlertCircle size={14} /> : <Calendar size={14} />}
                        <span>{formattedDate || "Prazo"}</span>
                        {deadlineDate && !isDone && ( <div onClick={clearDate} className="ml-1 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"><X size={12} /></div> )}
                    </button>
                    <input ref={dateInputRef} type="date" onChange={handleDateChange} onClick={(e) => e.stopPropagation()} className="sr-only" defaultValue={task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''} />

                    {hasChildren && (
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-bold font-mono border transition-colors", progressPercent === 100 ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-400 border-gray-100")}>
                        {progressPercent}%
                      </span>
                    )}
                </div>

                {/* Ações (Hover) - Play removido */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/80 rounded backdrop-blur-sm px-2">
                    <button onClick={addSubtask} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Adicionar Subtarefa"><Plus size={14} /></button>
                    <button onClick={handleMoveClick} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md" title="Mover / Organizar"><FolderInput size={14} /></button>
                    <button onClick={deleteTask} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="Excluir"><Trash2 size={14} /></button>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="flex flex-col ml-8 pl-2 border-l border-gray-100">
                  {
                  subtasks?.map(subtask => (
                    <TaskItem key={subtask.id} task={subtask} />
                  ))}
                </div>
            )}
        </div>

        {showMoveModal && (
            <MoveTaskModal 
                isOpen={showMoveModal} 
                onClose={() => setShowMoveModal(false)} 
                taskToMove={task} 
            />
        )}
    </>
  );
}
