// src/components/FocusSession.tsx
import { useEffect, useState, useRef, useMemo, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../db';
import { 
  Play, Pause, ArrowLeft, StopCircle, Clock, Plus, AlertTriangle, 
  Eye, ArrowUpRight, Home, ChevronRight, Volume2, VolumeX, Wind, RotateCcw,
  List, CheckSquare, Bold 
} from 'lucide-react';
import { TaskResources } from './TaskResources';
import { BreathingModal } from './BreathingModal';
import { PreSessionModal } from './PreSessionModal';
import { TaskItem } from './TaskItem';
import brownNoiseUrl from '../assets/pinknoise.mp3'; 
import { ReadOnlyContext } from '../App';

// --- ÁUDIO GLOBAL ---
const noiseAudio = new Audio(brownNoiseUrl);
noiseAudio.loop = true;
noiseAudio.volume = 0.5;

const alarmAudio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

// --- WRAPPER ---
export function FocusSession() {
  const { taskId } = useParams();
  const id = Number(taskId);
  return <FocusSessionInner key={id} taskId={id} />;
}

// --- COMPONENTE INTERNO ---
function FocusSessionInner({ taskId }: { taskId: number }) {
  const navigate = useNavigate();
  const ACTIVE_TASK_ID = taskId;
  const isReadOnly = useContext(ReadOnlyContext);
  const [viewedTaskId, setViewedTaskId] = useState(ACTIVE_TASK_ID);
  
  const viewedTaskIdRef = useRef(ACTIVE_TASK_ID);
  const notesRef = useRef(""); 
  
  const editorRef = useRef<HTMLDivElement>(null);
  const isNotesLoadedRef = useRef(false);

  // NOVO: Estado para controlar qual subtarefa está sendo arrastada
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<number | null>(null);

  useEffect(() => { 
      setViewedTaskId(ACTIVE_TASK_ID); 
      viewedTaskIdRef.current = ACTIVE_TASK_ID;
  }, [ACTIVE_TASK_ID]);

  useEffect(() => { 
      viewedTaskIdRef.current = viewedTaskId; 
      isNotesLoadedRef.current = false;
  }, [viewedTaskId]);
  

  // Queries
  const allTasks = useLiveQuery(() => db.tasks.toArray());
  const activeTask = useLiveQuery(() => db.tasks.get(ACTIVE_TASK_ID), [ACTIVE_TASK_ID]);
  const viewedTask = useLiveQuery(() => db.tasks.get(viewedTaskId), [viewedTaskId]);
  
  
  const subtasks = useLiveQuery(() => 
    db.tasks.where('parentId').equals(viewedTaskId).toArray()
  , [viewedTaskId]);
  
  // ATUALIZADO: Ordenar subtarefas considerando o campo "order"
  const sortedSubtasks = subtasks?.sort((a, b) => {
    // 1. Prioridade para tarefas concluídas irem para o final
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    
    // 2. Ordem customizada pelo Drag and Drop
    const orderA = a.order ?? 999999;
    const orderB = b.order ?? 999999;
    if (orderA !== orderB) return orderA - orderB;

    // 3. Fallback: Data de criação
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const breadcrumbs = useMemo(() => {
    if (!allTasks || !viewedTask) return [];
    const path: Task[] = [];
    let currentId: number | undefined = viewedTask.parentId;
    while (currentId) {
        const parent = allTasks.find(t => t.id === currentId);
        if (parent) { path.unshift(parent); currentId = parent.parentId; } 
        else break;
    }
    return path;
  }, [allTasks, viewedTask]);

  // Estados
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPreSession, setShowPreSession] = useState(false);
  
  const startTimeRef = useRef<Date | null>(null);
  const isSessionActiveRef = useRef(false);

  const [visualElapsed, setVisualElapsed] = useState(0); 
  const [sessionDuration, setSessionDuration] = useState(25 * 60); 
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editValue, setEditValue] = useState("25");
  
  const [isNoisePlaying, setIsNoisePlaying] = useState(!noiseAudio.paused && noiseAudio.currentTime > 0);
  const [notes, setNotes] = useState("");
  const [isBreathing, setIsBreathing] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [loadedTaskId, setLoadedTaskId] = useState<number | null>(null);

  useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);

  useEffect(() => {
    if (activeTask && !isSessionActive) {
        setVisualElapsed(Math.floor(activeTask.timeSpentMs / 1000));
    }
  }, [activeTask]);

  useEffect(() => {
  if (viewedTask && viewedTask.id === viewedTaskId && loadedTaskId !== viewedTaskId) {
      const desc = viewedTask.description || "";
      if (editorRef.current) {
          editorRef.current.innerHTML = desc;
      }
      setNotes(desc);
      notesRef.current = desc;
      setLoadedTaskId(viewedTaskId);
      isNotesLoadedRef.current = true; // <--- SINALIZA QUE FOI CARREGADO COM SUCESSO
  }
}, [viewedTask, viewedTaskId, loadedTaskId]);

  const saveCurrentNotes = async () => {
  // Se as notas ainda não foram carregadas, ABORTE o salvamento!
  // Isso evita que um texto vazio sobrescreva o banco acidentalmente.
  if (!isNotesLoadedRef.current) return; 

  const currentId = viewedTaskIdRef.current;
  const currentNotes = notesRef.current;
  
  if (currentId) {
      const task = await db.tasks.get(currentId);
      if (task && task.description !== currentNotes) {
          await db.tasks.update(currentId, { description: currentNotes });
      }
  }
};

  const handleSmartNavigate = async (targetId: number) => {
      await saveCurrentNotes();
      if (isSessionActive) {
          setViewedTaskId(targetId);
      } else {
          navigate(`/focus/${targetId}`);
      }
  };

  const handleBackToActive = async () => {
      await saveCurrentNotes();
      setViewedTaskId(ACTIVE_TASK_ID);
  };

  const handleSwitchFocus = async () => {
      if (isSessionActive) {
          await executeFinalSave();
          setIsSessionActive(false);
          startTimeRef.current = null;
      }
      await saveCurrentNotes();
      navigate(`/focus/${viewedTaskId}`);
  };

  const executeFinalSave = async () => {
      if (!isSessionActiveRef.current || !startTimeRef.current) return;
      const start = startTimeRef.current;
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      if (diffMs < 1000) return;
      startTimeRef.current = null;

      try {
          const currentTask = await db.tasks.get(ACTIVE_TASK_ID);
          if (currentTask) {
              const newTotalMs = (currentTask.timeSpentMs || 0) + diffMs;
              const sessions = [...(currentTask.sessions || [])];
              if (sessions.length > 0 && sessions[sessions.length - 1].end.getTime() === sessions[sessions.length - 1].start.getTime()) {
                  sessions[sessions.length - 1].end = now;
              } else {
                  sessions.push({ start: start, end: now, didBreathing: false });
              }
              await db.tasks.update(ACTIVE_TASK_ID, { timeSpentMs: newTotalMs, sessions: sessions, status: 'paused' });
          }
      } catch (e) { console.error("Erro save:", e); }
  };

  const toggleNoise = () => {
      if (isNoisePlaying) {
          noiseAudio.pause();
          setIsNoisePlaying(false);
      } else {
          noiseAudio.play().then(() => {
              setIsNoisePlaying(true);
          }).catch(e => {
              console.error("Erro ao tocar áudio:", e);
              setIsNoisePlaying(false);
          });
      }
  };

  const forceStopNoise = () => {
      noiseAudio.pause();
      setIsNoisePlaying(false);
  };

  const playAlarm = () => { 
      alarmAudio.currentTime = 0;
      alarmAudio.play().catch(console.error); 
  };

  useEffect(() => { 
    return () => { 
        if (isSessionActiveRef.current) executeFinalSave(); 
        saveCurrentNotes(); 
        forceStopNoise();
    }; 
  }, []);

  useEffect(() => {
    let interval: number;
    if (isSessionActive) {
      if (!startTimeRef.current) startTimeRef.current = new Date();
      interval = setInterval(() => {
        if (activeTask && startTimeRef.current) {
            const now = new Date();
            const sessionSeconds = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
            const totalBancoSeconds = Math.floor(activeTask.timeSpentMs / 1000);
            setVisualElapsed(totalBancoSeconds + sessionSeconds);
        }
        if (isCountdownActive && !isEditingTime) {
            setTimeLeft(prev => {
                if (prev <= 1) { playAlarm(); setIsCountdownActive(false); return 0; }
                return prev - 1;
            });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive, isCountdownActive, isEditingTime, activeTask]);

  const attemptExit = () => { if (isSessionActive) setShowExitConfirm(true); else manualExit(); };
  
  const manualExit = async () => {
    if (isSessionActive) await executeFinalSave();
    await saveCurrentNotes();
    forceStopNoise();
    navigate('/');
  };

  const handlePlayClick = async () => {
    if (!activeTask) return;
    if (isSessionActive) {
        await executeFinalSave();
        setIsSessionActive(false);
        setIsCountdownActive(false);
        forceStopNoise();
    } else {
        setShowPreSession(true);
    }
  };

  const startSessionConfirmed = async (stressLevel: number | undefined, didBreathing: boolean, stressNote: string) => {
    setShowPreSession(false);
    if (!activeTask) return;
    const now = new Date();
    startTimeRef.current = now;
    const newSession: any = { start: now, end: now, didBreathing: didBreathing };
    if (stressLevel !== undefined) { newSession.stressLevel = stressLevel; newSession.stressNote = stressNote; }
    const newSessions = [...(activeTask.sessions || []), newSession];
    await db.tasks.update(ACTIVE_TASK_ID, { status: 'in_progress', sessions: newSessions });
    setIsSessionActive(true);
    if (timeLeft > 0) setIsCountdownActive(true);
  };

  const formatTotalTime = (totalSeconds: number) => { const h = Math.floor(totalSeconds / 3600); const m = Math.floor((totalSeconds % 3600) / 60); const s = totalSeconds % 60; return `${h}h ${m}m ${s}s`; };
  const formatTimer = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`; };
  const handleTimeClick = () => { setIsCountdownActive(false); setIsEditingTime(true); setEditValue(Math.ceil(timeLeft / 60).toString()); };
  const handleTimeSave = () => { let m = parseInt(editValue); if (isNaN(m) || m < 1) m = 25; setSessionDuration(m * 60); setTimeLeft(m * 60); setIsEditingTime(false); if (isSessionActive) setIsCountdownActive(true); };
  const setSessionTime = (m: number) => { setSessionDuration(m * 60); setTimeLeft(m * 60); if (isSessionActive) setIsCountdownActive(true); };
  
  const handleAddSubtask = async (e: React.KeyboardEvent<HTMLInputElement>) => { 
    if (e.key === 'Enter') { 
        e.preventDefault();
        const titleToAdd = newSubtaskTitle.trim();
        if (!titleToAdd || !viewedTask?.id) return;
        setNewSubtaskTitle(""); 
        
        // Define a ordem da nova tarefa como o último da lista
        const lastOrder = sortedSubtasks && sortedSubtasks.length > 0 
            ? Math.max(...sortedSubtasks.map(t => t.order || 0)) 
            : 0;

        await db.tasks.add({ 
            parentId: viewedTask.id, title: titleToAdd, description: '', 
            status: 'todo', progress: 0, createdAt: new Date(), timeSpentMs: 0, 
            sessions: [], resources: [], links: [], order: lastOrder + 1
        }); 
    } 
  };

  // --- NOVO: FUNÇÕES DE DRAG AND DROP (SUBTAREFAS) ---
  const handleDragStart = (e: React.DragEvent, id: number) => {
      setDraggedSubtaskId(id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
      e.preventDefault();
      if (draggedSubtaskId === null || draggedSubtaskId === targetId || !sortedSubtasks) return;

      const currentList = [...sortedSubtasks];
      const oldIndex = currentList.findIndex(t => t.id === draggedSubtaskId);
      const newIndex = currentList.findIndex(t => t.id === targetId);

      if (oldIndex === -1 || newIndex === -1) return;

      const [movedItem] = currentList.splice(oldIndex, 1);
      currentList.splice(newIndex, 0, movedItem);

      // Atualiza a ordem mantendo a prioridade no Dexie
      const updates = currentList.map((task, index) => ({
          ...task,
          order: index 
      }));

      await db.tasks.bulkPut(updates);
      setDraggedSubtaskId(null);
  };

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
      const html = e.currentTarget.innerHTML;
      setNotes(html);
      notesRef.current = html;
  };

  const handleCheckboxInteraction = (e: React.MouseEvent<HTMLDivElement> | React.ChangeEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
        const checkbox = target as HTMLInputElement;
        
        // Sincroniza o atributo HTML com a propriedade de estado atual do DOM
        if (checkbox.checked) {
            checkbox.setAttribute('checked', 'true');
        } else {
            checkbox.removeAttribute('checked');
        }
        
        // Atualiza os estados e refs com o HTML modificado
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            setNotes(html);
            notesRef.current = html;
        }
    }
  };

  const handleFormat = (command: string) => {
      document.execCommand(command, false);
      editorRef.current?.focus();
      if (editorRef.current) {
          const html = editorRef.current.innerHTML;
          setNotes(html);
          notesRef.current = html;
      }
  };

  const applyChecklist = () => {
      const html = `<input type="checkbox" style="margin-right: 6px; cursor: pointer; width: 14px; height: 14px; vertical-align: middle;">&nbsp;`;
      document.execCommand('insertHTML', false, html);
      editorRef.current?.focus();
      if (editorRef.current) {
          const htmlStr = editorRef.current.innerHTML;
          setNotes(htmlStr);
          notesRef.current = htmlStr;
      }
  };

  if (!activeTask || !viewedTask) return <div className="p-10 opacity-50">Carregando...</div>;
  const progressPercent = sessionDuration > 0 ? Math.max(0, (timeLeft / sessionDuration) * 100) : 0;
  const isViewingOther = isSessionActive && (viewedTaskId !== ACTIVE_TASK_ID);

  return (
    <div className="fixed inset-0 z-50 bg-[#FDFDFD] flex flex-col h-screen animate-in fade-in duration-300">
      
      <div className="absolute top-0 left-0 w-full h-[4px] bg-gray-100 z-50">
        <div className={`h-full transition-all duration-1000 ease-linear ${timeLeft === 0 ? 'bg-orange-400' : 'bg-blue-600'}`} style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="flex-1 flex flex-col p-4 md:p-6 max-w-[1600px] w-full mx-auto min-h-0">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-stretch justify-between mb-4 bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 gap-4 flex-shrink-0">
            <div className="flex-1 flex flex-col justify-center items-start gap-2 min-w-0">
                <button onClick={attemptExit} className="text-gray-400 hover:text-gray-800 flex items-center gap-1 text-xs mb-1 group"><div className="bg-gray-100 p-1 rounded-full group-hover:bg-gray-200"><ArrowLeft size={14} /></div><span>Voltar aos Projetos</span></button>
                <div className="flex flex-col">
                    <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider flex items-center gap-1"><Clock size={10}/> Em andamento:</span>
                    <h1 className="text-xl font-bold text-gray-800 leading-tight truncate w-full" title={activeTask.title}>{activeTask.title}</h1>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"><Clock size={12} /><span>Total:</span><span className="font-bold text-gray-700">{formatTotalTime(visualElapsed)}</span>{isSessionActive && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1"/>}</div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center border-y md:border-y-0 md:border-x border-gray-100 py-4 md:py-0 px-4">
                <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1 flex items-center gap-1">Contador Regressivo</span>
                {isEditingTime ? (<div className="flex items-baseline border-b-2 border-blue-500 pb-1"><input autoFocus type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleTimeSave} onKeyDown={(e) => e.key === 'Enter' && handleTimeSave()} className="text-5xl font-mono font-light text-gray-800 w-24 bg-transparent outline-none text-center" /><span className="text-sm text-gray-400 ml-1">min</span></div>) : (<div onClick={handleTimeClick} className="group relative cursor-pointer flex flex-col items-center"><span className={`text-6xl font-mono font-light tracking-tighter tabular-nums transition-colors ${timeLeft === 0 ? 'text-orange-400' : 'text-gray-800'}`}>{formatTimer(timeLeft)}</span>{timeLeft === 0 && isSessionActive && <span className="text-[10px] font-bold text-white bg-orange-400 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse absolute -bottom-3 shadow-sm">Tempo Livre</span>}</div>)}
                <div className="flex gap-1 mt-2">
                    {[10, 25, 45, 60].map(m => (<button key={m} onClick={() => setSessionTime(m)} className={`text-[10px] px-2 py-1 rounded transition-colors ${sessionDuration === m * 60 ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>{m}m</button>))}
                    <button onClick={() => setSessionTime(sessionDuration / 60)} className="text-gray-300 hover:text-blue-600 p-1" title="Reiniciar"><RotateCcw size={12} /></button>
                </div>
            </div>
            {!isReadOnly && (
            <div className="flex-1 flex flex-col items-end justify-center gap-4">
                
                <div className="flex items-center gap-3">
                    <button onClick={handlePlayClick} className={`h-12 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm font-bold text-sm ${isSessionActive ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>{isSessionActive ? <><Pause size={18} fill="currentColor" /> PAUSAR</> : <><Play size={18} fill="currentColor" /> INICIAR</>}</button>
                    <button onClick={attemptExit} className="w-12 h-12 rounded-xl bg-white border-2 border-red-50 text-red-400 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center" title="Parar e Sair"><StopCircle size={20} /></button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleNoise} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isNoisePlaying ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{isNoisePlaying ? <Volume2 size={14} /> : <VolumeX size={14} />} <span className="hidden lg:inline">Foco Sonoro</span></button>
                    <button onClick={() => { if(isSessionActive) handlePlayClick(); setIsBreathing(true); }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Wind size={14} /> <span className="hidden lg:inline">Respirar</span></button>
                </div>
                
            </div>
            )}
        </div>

        {/* BARRA DE AVISO */}
        {isViewingOther && (
            <div className="mb-4 bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg text-blue-600 shadow-sm"><Eye size={20} /></div>
                    <div>
                        <p className="text-xs text-blue-400 font-bold uppercase tracking-wider">Modo de Visualização</p>
                        <p className="text-sm font-bold text-blue-900">Você está navegando em: <span className="underline decoration-blue-300">{viewedTask.title}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleBackToActive} className="px-4 py-2 bg-white text-blue-600 text-xs font-bold rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors">Voltar para Ativa</button>
                    <button onClick={handleSwitchFocus} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-200"><ArrowUpRight size={14} /> Focar Nesta</button>
                </div>
            </div>
        )}

        {/* =========================================================
            COLUNAS INVERTIDAS
            ESQUERDA: EDITOR + RECURSOS (span 4)
            DIREITA: SUBTAREFAS (span 8)
            ========================================================= */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
            
            {/* COLUNA ESQUERDA (Editor e Recursos) */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-3 h-full min-h-0">
                
                {/* Editor */}
                <div className={`bg-white rounded-2xl shadow-sm border flex flex-col overflow-hidden relative group flex-1 min-h-[300px] transition-colors ${isViewingOther ? 'border-blue-100 ring-2 ring-blue-50' : 'border-gray-100'}`}>
                    <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                {isViewingOther ? <Eye size={12} className="text-blue-400"/> : null}
                                Notas de: <span className="text-gray-700">{viewedTask.title}</span>
                            </span>
                            {!isReadOnly && (
                            <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                                <button 
                                    onClick={() => handleFormat('bold')} 
                                    className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors" 
                                    title="Negrito (Ctrl+B)"
                                >
                                    <Bold size={14} />
                                </button>
                                <button 
                                    onClick={() => handleFormat('insertUnorderedList')} 
                                    className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors" 
                                    title="Criar Lista"
                                >
                                    <List size={14} />
                                </button>
                                <button 
                                    onClick={applyChecklist} 
                                    className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors" 
                                    title="Adicionar Checkbox"
                                >
                                    <CheckSquare size={14} />
                                </button>
                            </div>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-400">
                            {notes.replace(/<[^>]*>?/gm, '').length} caracteres
                        </span>
                    </div>

                    <div 
                        ref={editorRef}
                        contentEditable={!isReadOnly}
                        onInput={handleEditorInput}
                        onClick={handleCheckboxInteraction}   
                        onChange={handleCheckboxInteraction}
                        data-placeholder={`Ideias sobre ${viewedTask.title}...`} 
                        className="flex-1 w-full h-full p-4 outline-none text-gray-700 text-sm leading-relaxed font-normal overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-bold [&_strong]:font-bold" 
                        spellCheck={false} 
                    />
                </div>

                {/* Recursos */}
                <div className={`flex-none min-h-[250px] rounded-xl border shadow-sm transition-colors ${isViewingOther ? 'border-blue-100 ring-2 ring-blue-50' : 'border-gray-100'}`}>
                    <TaskResources task={viewedTask} />
                </div>
            </div>

            {/* COLUNA DIREITA (Breadcrumbs e Subtarefas) */}
            <div className={`col-span-1 md:col-span-8 flex flex-col bg-white rounded-xl border p-4 shadow-sm transition-colors h-full min-h-0 ${isViewingOther ? 'border-blue-100 ring-2 ring-blue-50' : 'border-gray-100'}`}>
                
                {/* Breadcrumbs */}
                <div className="flex flex-col items-start justify-between mb-3 border-b border-gray-100 pb-2 gap-2 flex-shrink-0">
                    <div className="flex items-center flex-wrap gap-1 text-xs text-gray-500 w-full">
                        <button onClick={() => handleSmartNavigate(activeTask.id!)} className={`hover:text-blue-600 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors flex items-center gap-1 ${activeTask.id === viewedTaskId ? 'text-blue-600 font-bold' : ''}`}><Home size={10} /> Início</button>
                        {breadcrumbs.length > 0 && <ChevronRight size={10} className="text-gray-300" />}
                        {breadcrumbs.map((crumb) => (
                            <div key={crumb.id} className="flex items-center gap-1">
                                <button onClick={() => handleSmartNavigate(crumb.id!)} className="hover:text-blue-600 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors truncate max-w-[120px]" title={crumb.title}>{crumb.title}</button>
                                <ChevronRight size={10} className="text-gray-300" />
                            </div>
                        ))}
                        {isViewingOther && (<span className="font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={viewedTask.title}>{viewedTask.title}</span>)}
                    </div>
                </div>

                {/* Subtarefas */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-2 min-h-0">
                    {sortedSubtasks?.length === 0 && <div className="text-center py-8 text-gray-400 text-xs italic">Sem subtarefas.</div>}
                    
                    {sortedSubtasks?.map((sub, index) => {
                        const isDragging = draggedSubtaskId === sub.id;
                        
                        return (
                            <div 
                                key={sub.id} 
                                className={`scale-[0.98] origin-left transition-all ${isDragging ? 'opacity-40 ring-2 ring-blue-400 rounded-xl' : ''}`}
                                draggable={!isReadOnly}
                                onDragStart={(e) => sub.id && handleDragStart(e, sub.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => sub.id && handleDrop(e, sub.id)}
                            >
                                {/* ADICIONADO O INDEXSTRING AQUI */}
                                <TaskItem task={sub} onNavigate={handleSmartNavigate} indexString={`${index + 1}.`} />
                            </div>
                        );
                    })}
                    
                    {!isReadOnly && (
                        <div className="flex items-center gap-2 mt-2 px-2 py-1 bg-gray-50 rounded-lg focus-within:ring-2 focus-within:ring-blue-100 flex-shrink-0">
                            <Plus className="text-gray-400" size={14} />
                            <input type="text" placeholder="Adicionar passo..." className="w-full bg-transparent text-sm outline-none text-gray-600 placeholder-gray-400" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={handleAddSubtask} />
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
      
      <BreathingModal isOpen={isBreathing} onClose={() => setIsBreathing(false)} />
      <PreSessionModal isOpen={showPreSession} onCancel={() => setShowPreSession(false)} onStart={startSessionConfirmed} />
      
      {showExitConfirm && (<div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"><div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"><div className="flex flex-col items-center text-center gap-4"><div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600"><AlertTriangle size={24} /></div><div><h3 className="text-lg font-bold text-gray-800">Sessão em Andamento!</h3><p className="text-sm text-gray-500 mt-1">O cronômetro ainda está rodando. Se sair agora, o tempo será salvo.</p></div><div className="flex gap-3 w-full mt-2"><button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">Cancelar</button><button onClick={manualExit} className="flex-1 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 font-medium">Salvar e Sair</button></div></div></div></div>)}
    </div>
  );
}