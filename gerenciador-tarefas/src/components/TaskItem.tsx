/// src/components/TaskItem.tsx
import { useState, useMemo, useRef, useEffect, useContext } from 'react';
import { 
  CheckSquare, Square, Plus, 
  Trash2, Calendar, ArrowRight, Edit2, 
  ChevronRight, ChevronDown, AlertTriangle 
} from 'lucide-react';
import { db, type Task } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MoveTaskModal } from './MoveTaskModal';
import { useNavigate } from 'react-router-dom';
import { ReadOnlyContext } from '../App';

interface Props {
  task: Task;
  depth?: number;
  onNavigate?: (taskId: number) => void;
  indexString?: string;
}

const formatDateTime = (date: Date | string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
};

export function TaskItem({ task, depth = 0, onNavigate, indexString }: Props) {
  const navigate = useNavigate();
  const isReadOnly = useContext(ReadOnlyContext);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [modalState, setModalState] = useState<{ isOpen: boolean; type: 'add_subtask' | 'delete_task' | null }>({ isOpen: false, type: null });
  const [subtaskInput, setSubtaskInput] = useState('');

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
              // FORÇANDO O TIPO "ANY" PARA BLINDAR CONTRA ERROS DO TYPESCRIPT
              await db.tasks.update(parentId, { status: 'done', progress: 100, completedAt: new Date() } as any);
              if (parent.parentId) await updateParentStatusRecursively(parent.parentId);
          }
      } else {
          if (parent.status === 'done') {
              await db.tasks.update(parentId, { status: 'todo', progress: 0, completedAt: undefined } as any);
              if (parent.parentId) await updateParentStatusRecursively(parent.parentId);
          }
      }
  };

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id || isReadOnly) return;
    
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const newProgress = newStatus === 'done' ? 100 : 0;
    const newCompletedAt = newStatus === 'done' ? new Date() : undefined;
    
    await db.tasks.update(task.id, { status: newStatus, progress: newProgress, completedAt: newCompletedAt } as any);
    if (task.parentId) await updateParentStatusRecursively(task.parentId);
  };

  const handleSave = async () => {
    if (task.id && editTitle.trim() && !isReadOnly) {
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

  const openAddSubtaskModal = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!task.id || isReadOnly) return;
      setSubtaskInput('');
      setModalState({ isOpen: true, type: 'add_subtask' });
  };

  const confirmAddSubtask = async () => {
      const title = subtaskInput.trim();
      if (!title || !task.id || isReadOnly) return;
      
      await db.tasks.add({ 
        parentId: task.id, title: title, description: '', status: 'todo', progress: 0, 
        createdAt: new Date(), timeSpentMs: 0, sessions: [], resources: [], links: [] 
      });
      
      setIsExpanded(true);
      if (task.status === 'done') {
          await db.tasks.update(task.id, { status: 'todo', progress: 0, completedAt: undefined } as any);
          if (task.parentId) await updateParentStatusRecursively(task.parentId);
      }
      setModalState({ isOpen: false, type: null });
  };

  const openDeleteModal = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isReadOnly) return;
      setModalState({ isOpen: true, type: 'delete_task' });
  };

  const confirmDeleteTask = async () => {
      if (isReadOnly) return;
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
      setModalState({ isOpen: false, type: null });
  };

  const closeActionModal = () => setModalState({ isOpen: false, type: null });

  const handleKeyDownModal = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (modalState.type === 'add_subtask') confirmAddSubtask();
      }
  };

  const handleDateClick = () => {
    if (isReadOnly) return;
    if (dateInputRef.current) {
        try { dateInputRef.current.showPicker(); } catch { dateInputRef.current.click(); }
    }
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!task.id || isReadOnly) return;
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
        <button onClick={toggleStatus} className={`mt-0.5 transition-colors shrink-0 ${task.status === 'done' ? 'text-gray-400' : (isReadOnly ? 'text-gray-300' : 'text-gray-300 hover:text-blue-500')}`}>
          {task.status === 'done' ? <CheckSquare size={20} /> : <Square size={20} />}
        </button>
        <div className="flex-1 min-w-0">
          {isEditing && !isReadOnly ? (
            <input autoFocus className="w-full bg-gray-50 border border-blue-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-100" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={handleSave} onKeyDown={(e) => e.key === 'Enter' && handleSave()} onClick={(e) => e.stopPropagation()} />
          ) : (
            <div className="flex flex-col gap-1">
                <span className={`text-sm font-medium leading-tight flex items-center ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {indexString && <span className="text-gray-400 font-mono text-[11px] mr-1.5">{indexString}</span>}
                    {task.title}
                </span>
                <div className="flex items-center flex-wrap gap-3">
                    {task.deadline && (<span className={`text-[10px] flex items-center gap-1 ${new Date(task.deadline) < new Date() && task.status !== 'done' ? 'text-red-500 font-bold' : 'text-gray-400'}`}><Calendar size={10} /> {new Date(task.deadline).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>)}
                    {hasSubtasks && (<div className="flex items-center gap-2"><div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${calculatedProgress}%` }} /></div><span className="text-[10px] text-gray-400 font-mono">{Math.round(calculatedProgress)}%</span></div>)}
                    
                    {task.createdAt && <span className="text-[10px] text-gray-400 font-mono">Criada: {formatDateTime(task.createdAt)}</span>}
                    {task.status === 'done' && task.completedAt && <span className="text-[10px] text-gray-400 font-mono">Feita: {formatDateTime(task.completedAt)}</span>}
                </div>
            </div>
          )}
        </div>
        
        {!isReadOnly && (
            <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity self-start md:self-center" onClick={(e) => e.stopPropagation()}>
                <button onClick={openAddSubtaskModal} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Adicionar Subtarefa"><Plus size={18} /></button>
                <div className="relative">
                    <button onClick={handleDateClick} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Definir Data Limite"><Calendar size={16} /></button>
                    <input type="date" ref={dateInputRef} value={dateValue} onChange={handleDateChange} className="absolute opacity-0 w-0 h-0 pointer-events-none" />
                </div>
                <button onClick={() => setIsEditing(true)} className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors" title="Editar Título"><Edit2 size={16} /></button>
                <button onClick={() => setIsMoveModalOpen(true)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Mover Tarefa"><ArrowRight size={18} /></button>
                <button onClick={openDeleteModal} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={16} /></button>
            </div>
        )}
      </div>
      
      {isExpanded && sortedSubtasks && sortedSubtasks.length > 0 && (
        <div className="pl-4 ml-3 border-l border-gray-100 space-y-1">
            {sortedSubtasks.map((subtask, idx) => (
            <TaskItem 
                key={subtask.id} 
                task={subtask} 
                depth={depth + 1} 
                onNavigate={onNavigate} 
                indexString={indexString ? `${indexString}${idx + 1}.` : `${idx + 1}.`} 
            />
            ))}
        </div>
      )}
      
      {!isReadOnly && (
        <MoveTaskModal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} task={task} />
      )}

      {/* MODAIS PREMIUM DE AÇÕES (CRIAR E DELETAR) */}
      {modalState.isOpen && (
        <div 
          className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full cursor-default" onClick={(e) => e.stopPropagation()}>
            
            {modalState.type === 'add_subtask' && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-xl bg-blue-100">
                     <Plus size={24} className="text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 leading-tight">Nova Subtarefa</h3>
                </div>
                <p className="text-sm text-gray-600 mb-5">Adicione um novo passo para a tarefa <strong className="text-gray-700">{task.title}</strong>.</p>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Nome do Passo</label>
                    <input 
                        autoFocus 
                        type="text" 
                        value={subtaskInput} 
                        onChange={e => setSubtaskInput(e.target.value)} 
                        onKeyDown={handleKeyDownModal}
                        placeholder="Ex: Fazer revisão do texto..." 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-700"
                    />
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={closeActionModal} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-sm transition-colors">
                      Cancelar
                  </button>
                  <button onClick={confirmAddSubtask} disabled={!subtaskInput.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm transition-all shadow-sm disabled:opacity-50">
                      Adicionar Passo
                  </button>
                </div>
              </>
            )}

            {modalState.type === 'delete_task' && (
              <>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
                    <AlertTriangle size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 leading-tight">Excluir Tarefa?</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed px-2">
                    Tem certeza que deseja excluir <strong className="text-gray-800">{task.title}</strong> e <strong className="text-red-600">todas as suas subtarefas</strong>? Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex gap-3 w-full mt-6">
                    <button onClick={closeActionModal} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-sm transition-colors">
                      Cancelar
                    </button>
                    <button onClick={confirmDeleteTask} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-sm">
                      Sim, Excluir
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}