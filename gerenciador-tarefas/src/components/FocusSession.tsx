// src/components/FocusSession.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  Play, Pause, ArrowLeft, Volume2, VolumeX, 
  MoreHorizontal, Wind, RotateCcw, StopCircle, Clock, Plus, AlertTriangle 
} from 'lucide-react';
import { TaskResources } from './TaskResources';
import { BreathingModal } from './BreathingModal';
import { PreSessionModal } from './PreSessionModal';
import { TaskItem } from './TaskItem';
import brownNoiseUrl from '../assets/pinknoise.mp3'; 

// --- WRAPPER (Essencial para resetar o estado ao mudar de tarefa) ---
export function FocusSession() {
  const { taskId } = useParams();
  const id = Number(taskId);
  return <FocusSessionInner key={id} taskId={id} />;
}

// --- COMPONENTE INTERNO ---
function FocusSessionInner({ taskId }: { taskId: number }) {
  const navigate = useNavigate();
  
  // CONSTANTE DE ID: Nunca muda durante a vida deste componente
  const ACTIVE_TASK_ID = taskId;
  
  const task = useLiveQuery(() => db.tasks.get(ACTIVE_TASK_ID), [ACTIVE_TASK_ID]);
  const subtasks = useLiveQuery(() => 
    db.tasks.where('parentId').equals(ACTIVE_TASK_ID).toArray()
  , [ACTIVE_TASK_ID]);
  
  const sortedSubtasks = subtasks?.sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return 0;
  });

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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [notes, setNotes] = useState("");
  const [isBreathing, setIsBreathing] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  // Sincroniza Ref apenas para verificação
  useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);

  // Carrega dados iniciais
  useEffect(() => {
    if (task && task.id === ACTIVE_TASK_ID) {
      if (!notes) setNotes(task.description || "");
      if (!isSessionActive) {
          setVisualElapsed(Math.floor(task.timeSpentMs / 1000));
      }
    }
  }, [task, ACTIVE_TASK_ID]); 

  // --- FUNÇÃO DE SALVAR BLINDADA ---
  const executeFinalSave = async () => {
      // 1. Captura os valores no momento exato da chamada
      const start = startTimeRef.current;
      const isActive = isSessionActiveRef.current;

      // 2. Se não tem start time, NÃO SALVA (impede salvar tempo do pai no filho)
      if (!isActive || !start) return;
      
      // 3. IMEDIATAMENTE invalida o startTime para impedir duplo salvamento
      startTimeRef.current = null; 

      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      
      if (diffMs < 1000) return;

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
      } catch (e) { console.error("Erro ao salvar:", e); }
  };

  // --- NAVEGAÇÃO SEGURA ---
  const handleTaskNavigate = async (targetId: number) => {
      // Se estiver rodando, SALVA a tarefa atual explicitamente
      if (isSessionActive) {
          await executeFinalSave(); // Isso já zera o startTimeRef
          
          // Desliga flags visuais
          setIsSessionActive(false);
          setIsCountdownActive(false);
      }
      // Navega (O componente será destruído e recriado para a nova tarefa)
      navigate(`/focus/${targetId}`);
  };

  // Salvar ao fechar aba
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isSessionActiveRef.current) {
            executeFinalSave(); e.preventDefault(); e.returnValue = ''; 
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Salvar ao desmontar (garantia extra)
  useEffect(() => { 
    return () => { 
      // Só salva se startTimeRef ainda existir (se handleTaskNavigate já rodou, ele será null e não salvará de novo)
      if (isSessionActiveRef.current && startTimeRef.current) {
          executeFinalSave(); 
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }; 
  }, []);

  // Timer Visual
  useEffect(() => {
    let interval: number;
    if (isSessionActive) {
      if (!startTimeRef.current) startTimeRef.current = new Date();
      
      interval = setInterval(() => {
        // SEGURANÇA: Só atualiza visual se task carregada for a correta
        if (task && task.id === ACTIVE_TASK_ID && startTimeRef.current) {
            const now = new Date();
            const sessionSeconds = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
            const totalBancoSeconds = Math.floor(task.timeSpentMs / 1000);
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
  }, [isSessionActive, isCountdownActive, isEditingTime, task, ACTIVE_TASK_ID]);

  const attemptExit = () => { if (isSessionActive) setShowExitConfirm(true); else manualExit(); };
  
  const manualExit = async () => {
    if (isSessionActive) await executeFinalSave();
    if (task && notes !== task.description) await db.tasks.update(ACTIVE_TASK_ID, { description: notes, status: 'paused' });
    setIsPlayingAudio(false); 
    navigate('/');
  };

  const handlePlayClick = async () => {
    if (!task) return;
    if (isSessionActive) {
        await executeFinalSave();
        setIsSessionActive(false);
        setIsCountdownActive(false);
        // startTimeRef já é zerado no executeFinalSave
        if (isPlayingAudio) setIsPlayingAudio(false);
    } else {
        setShowPreSession(true);
    }
  };

  const startSessionConfirmed = async (stressLevel: number | undefined, didBreathing: boolean, stressNote: string) => {
    setShowPreSession(false);
    if (!task) return;
    const now = new Date();
    startTimeRef.current = now;
    
    const newSession: any = { start: now, end: now, didBreathing: didBreathing };
    if (stressLevel !== undefined) { newSession.stressLevel = stressLevel; newSession.stressNote = stressNote; }
    const newSessions = [...(task.sessions || []), newSession];
    
    await db.tasks.update(ACTIVE_TASK_ID, { status: 'in_progress', sessions: newSessions });
    
    setIsSessionActive(true);
    if (timeLeft > 0) setIsCountdownActive(true);
  };

  useEffect(() => {
    if (isPlayingAudio) {
      if (!audioRef.current) { audioRef.current = new Audio(brownNoiseUrl); audioRef.current.loop = true; }
      audioRef.current.play().catch(e => { console.error("Erro audio:", e); setIsPlayingAudio(false); });
    } else { audioRef.current?.pause(); }
  }, [isPlayingAudio]);

  const playAlarm = () => { if (!alarmRef.current) alarmRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); alarmRef.current.play().catch(console.error); };
  const formatTotalTime = (totalSeconds: number) => { const h = Math.floor(totalSeconds / 3600); const m = Math.floor((totalSeconds % 3600) / 60); const s = totalSeconds % 60; return `${h}h ${m}m ${s}s`; };
  const formatTimer = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`; };
  const handleTimeClick = () => { setIsCountdownActive(false); setIsEditingTime(true); setEditValue(Math.ceil(timeLeft / 60).toString()); };
  const handleTimeSave = () => { let m = parseInt(editValue); if (isNaN(m) || m < 1) m = 25; setSessionDuration(m * 60); setTimeLeft(m * 60); setIsEditingTime(false); if (isSessionActive) setIsCountdownActive(true); };
  const setSessionTime = (m: number) => { setSessionDuration(m * 60); setTimeLeft(m * 60); if (isSessionActive) setIsCountdownActive(true); };
  
  const handleAddSubtask = async (e: React.KeyboardEvent<HTMLInputElement>) => { 
    if (e.key === 'Enter') { 
        e.preventDefault();
        const titleToAdd = newSubtaskTitle.trim();
        if (!titleToAdd || !task?.id) return; 
        setNewSubtaskTitle(""); 
        try {
            await db.tasks.add({ 
                parentId: task.id, title: titleToAdd, description: '', 
                status: 'todo', progress: 0, createdAt: new Date(), timeSpentMs: 0, 
                sessions: [], resources: [], links: [] 
            }); 
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setNewSubtaskTitle(titleToAdd);
        }
    } 
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setNotes(e.target.value); };

  // BARREIRA DE CARREGAMENTO (Evita mostrar dados errados)
  if (!task || task.id !== ACTIVE_TASK_ID) {
      return (
        <div className="fixed inset-0 bg-[#FDFDFD] flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3 opacity-50">
                <Clock className="animate-spin text-blue-500" size={32} />
                <span className="text-sm font-medium text-gray-500">Carregando tarefa...</span>
            </div>
        </div>
      );
  }
  
  const progressPercent = sessionDuration > 0 ? Math.max(0, (timeLeft / sessionDuration) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#FDFDFD] flex flex-col h-full md:h-screen md:overflow-hidden overflow-y-auto animate-in fade-in duration-300">
      <div className="absolute top-0 left-0 w-full h-[4px] bg-gray-100 z-50">
        <div className={`h-full transition-all duration-1000 ease-linear ${timeLeft === 0 ? 'bg-orange-400' : 'bg-blue-600'}`} style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="flex-1 flex flex-col p-4 md:p-6 max-w-[1600px] w-full mx-auto pb-20 md:pb-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-stretch justify-between mb-6 bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 gap-4 flex-shrink-0">
            <div className="flex-1 flex flex-col justify-center items-start gap-2 min-w-0">
                <button onClick={attemptExit} className="text-gray-400 hover:text-gray-800 flex items-center gap-1 text-xs mb-1 group"><div className="bg-gray-100 p-1 rounded-full group-hover:bg-gray-200"><ArrowLeft size={14} /></div><span>Voltar aos Projetos</span></button>
                <h1 className="text-xl font-bold text-gray-800 leading-tight truncate w-full" title={task.title}>{task.title}</h1>
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

            <div className="flex-1 flex flex-col items-end justify-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={handlePlayClick} className={`h-12 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm font-bold text-sm ${isSessionActive ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>{isSessionActive ? <><Pause size={18} fill="currentColor" /> PAUSAR</> : <><Play size={18} fill="currentColor" /> INICIAR</>}</button>
                    <button onClick={attemptExit} className="w-12 h-12 rounded-xl bg-white border-2 border-red-50 text-red-400 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center" title="Parar e Sair"><StopCircle size={20} /></button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsPlayingAudio(!isPlayingAudio)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isPlayingAudio ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{isPlayingAudio ? <Volume2 size={14} /> : <VolumeX size={14} />} <span className="hidden lg:inline">Foco Sonoro</span></button>
                    <button onClick={() => { if(isSessionActive) handlePlayClick(); setIsBreathing(true); }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Wind size={14} /> <span className="hidden lg:inline">Respirar</span></button>
                </div>
            </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
            <div className="col-span-1 md:col-span-4 flex flex-col gap-6 h-full min-h-0">
                
                {/* Lista de Passos */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col h-[300px] md:flex-1 min-h-0 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lista de Passos</span><button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={14} /></button></div>
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                        
                        {sortedSubtasks?.map(sub => (
                            <div key={sub.id} className="scale-[0.98] origin-left">
                                <TaskItem task={sub} onNavigate={handleTaskNavigate} />
                            </div>
                        ))}
                        
                        <div className="flex items-center gap-2 mt-2 px-2 py-1 bg-gray-50 rounded-lg focus-within:ring-2 focus-within:ring-blue-100">
                            <Plus className="text-gray-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Adicionar passo..." 
                                className="w-full bg-transparent text-sm outline-none text-gray-600 placeholder-gray-400" 
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                onKeyDown={handleAddSubtask} 
                            />
                        </div>

                    </div>
                </div>

                <div className="h-[300px] md:flex-1 md:h-auto min-h-0 overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                    <TaskResources task={task} />
                </div>
            </div>

            <div className="col-span-1 md:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative group min-h-[400px] md:h-full md:min-h-0">
                <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Diário de Bordo / Notas</span><span className="text-[10px] text-gray-400">{notes.length} caracteres</span></div>
                <textarea value={notes} onChange={handleNoteChange} placeholder="Registre suas ideias..." className="flex-1 w-full h-full p-6 resize-none outline-none text-gray-700 text-base leading-relaxed font-normal placeholder-gray-300" spellCheck={false} />
            </div>
        </div>
      </div>
      
      <BreathingModal isOpen={isBreathing} onClose={() => setIsBreathing(false)} />
      <PreSessionModal isOpen={showPreSession} onCancel={() => setShowPreSession(false)} onStart={startSessionConfirmed} />
      
      {showExitConfirm && (<div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"><div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"><div className="flex flex-col items-center text-center gap-4"><div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600"><AlertTriangle size={24} /></div><div><h3 className="text-lg font-bold text-gray-800">Sessão em Andamento!</h3><p className="text-sm text-gray-500 mt-1">O cronômetro ainda está rodando. Se sair agora, o tempo será salvo.</p></div><div className="flex gap-3 w-full mt-2"><button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">Cancelar</button><button onClick={manualExit} className="flex-1 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 font-medium">Salvar e Sair</button></div></div></div></div>)}
    </div>
  );
}
