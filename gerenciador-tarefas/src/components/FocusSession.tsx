// src/components/FocusSession.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  Play, Pause, ArrowLeft, Volume2, VolumeX, 
  CheckSquare, Square, MoreHorizontal, Wind, RotateCcw, StopCircle, Clock, Plus, AlertTriangle 
} from 'lucide-react';
import { TaskResources } from './TaskResources';
import { BreathingModal } from './BreathingModal';
import { PreSessionModal } from './PreSessionModal';
import brownNoiseUrl from '../assets/brown_noise.mp3'; 

export function FocusSession() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const id = Number(taskId);
  
  const task = useLiveQuery(() => db.tasks.get(id), [id]);
  const subtasks = useLiveQuery(() => 
    id ? db.tasks.where('parentId').equals(id).toArray() : []
  , [id]);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPreSession, setShowPreSession] = useState(false);
  
  const startTimeRef = useRef<Date | null>(null);
  const isSessionActiveRef = useRef(false);
  const taskIdRef = useRef(id);

  useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);
  useEffect(() => { taskIdRef.current = id; }, [id]);

  const [visualElapsed, setVisualElapsed] = useState(0); 
  const [sessionDuration, setSessionDuration] = useState(25 * 60); 
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editValue, setEditValue] = useState("25");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [notes, setNotes] = useState("");
  const [isBreathing, setIsBreathing] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (task) {
      if (!notes) setNotes(task.description || "");
      setVisualElapsed(Math.floor(task.timeSpentMs / 1000));
    }
  }, [task]);

  const executeFinalSave = async () => {
      if (!isSessionActiveRef.current || !startTimeRef.current || !taskIdRef.current) return;
      isSessionActiveRef.current = false;
      try {
          const currentId = taskIdRef.current;
          const start = startTimeRef.current;
          const now = new Date();
          const diffMs = now.getTime() - start.getTime();
          if (diffMs < 1000) return;

          const currentTask = await db.tasks.get(currentId);
          if (currentTask) {
              const newTotalMs = (currentTask.timeSpentMs || 0) + diffMs;
              const sessions = [...(currentTask.sessions || [])];
              if (sessions.length > 0) sessions[sessions.length - 1].end = now;
              else sessions.push({ start: start, end: now, didBreathing: false });
              await db.tasks.update(currentId, { timeSpentMs: newTotalMs, sessions: sessions, status: 'paused' });
          }
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    window.history.pushState(null, document.title, window.location.href);
    const handlePopState = () => {
        if (isSessionActiveRef.current) {
            window.history.pushState(null, document.title, window.location.href);
            setShowExitConfirm(true);
        } else {
            navigate('/');
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isSessionActiveRef.current) {
            executeFinalSave(); e.preventDefault(); e.returnValue = ''; 
        }
    };
    const handleUnload = () => { if (isSessionActiveRef.current) executeFinalSave(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('unload', handleUnload);
    };
  }, []);

  useEffect(() => { return () => { if (isSessionActiveRef.current) executeFinalSave(); }; }, []);

  useEffect(() => {
    let interval: number;
    if (isSessionActive) {
      if (!startTimeRef.current) startTimeRef.current = new Date();
      interval = setInterval(() => {
        if (task && startTimeRef.current) {
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
  }, [isSessionActive, isCountdownActive, isEditingTime, task]);

  const attemptExit = () => { if (isSessionActive) setShowExitConfirm(true); else manualExit(); };
  const manualExit = async () => {
    if (isSessionActive) await executeFinalSave();
    if (task && notes !== task.description) await db.tasks.update(id, { description: notes, status: 'paused' });
    navigate('/');
  };

  const handlePlayClick = async () => {
    if (!task) return;
    if (isSessionActive) {
        await executeFinalSave();
        setIsSessionActive(false);
        setIsCountdownActive(false);
        startTimeRef.current = null;
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
    await db.tasks.update(id, { status: 'in_progress', sessions: newSessions });
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
  const handleAddSubtask = async (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { const title = e.currentTarget.value; if (!title.trim() || !task?.id) return; await db.tasks.add({ parentId: task.id, title, description: '', status: 'todo', progress: 0, createdAt: new Date(), timeSpentMs: 0, sessions: [], resources: [], links: [] }); e.currentTarget.value = ''; } };
  const toggleSubtask = async (subId?: number, currentStatus?: string) => { if (!subId) return; await db.tasks.update(subId, { status: currentStatus === 'done' ? 'todo' : 'done' }); };
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setNotes(e.target.value); };

  if (!task) return <div className="p-10 opacity-50">Carregando...</div>;
  const progressPercent = sessionDuration > 0 ? Math.max(0, (timeLeft / sessionDuration) * 100) : 0;

  return (
    // MUDANÇA 1: h-screen apenas no desktop. No mobile é h-auto com min-h-screen
    <div className="fixed inset-0 z-50 bg-[#FDFDFD] flex flex-col h-full md:h-screen md:overflow-hidden overflow-y-auto animate-in fade-in duration-300">
      <div className="absolute top-0 left-0 w-full h-[4px] bg-gray-100 z-50">
        <div className={`h-full transition-all duration-1000 ease-linear ${timeLeft === 0 ? 'bg-orange-400' : 'bg-blue-600'}`} style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Conteúdo rolável no mobile */}
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

        {/* LAYOUT GRID vs FLEX NO MOBILE */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
            {/* Coluna da Esquerda (Passos e Recursos) */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
                
                {/* Lista de Passos */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col h-[300px] md:h-1/2 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lista de Passos</span><button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={14} /></button></div>
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                        {subtasks?.map(sub => (<div key={sub.id} onClick={() => toggleSubtask(sub.id, sub.status)} className="group flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"><div className={`mt-0.5 ${sub.status === 'done' ? 'text-gray-300' : 'text-gray-400 group-hover:text-blue-500'}`}>{sub.status === 'done' ? <CheckSquare size={16} /> : <Square size={16} />}</div><span className={`text-sm leading-tight ${sub.status === 'done' ? 'text-gray-300 line-through' : 'text-gray-600'}`}>{sub.title}</span></div>))}
                        <div className="flex items-center gap-2 mt-2 px-2 py-1 bg-gray-50 rounded-lg focus-within:ring-2 focus-within:ring-blue-100"><Plus className="text-gray-400" size={14} /><input type="text" placeholder="Adicionar passo..." className="w-full bg-transparent text-sm outline-none text-gray-600 placeholder-gray-400" onKeyDown={handleAddSubtask} /></div>
                    </div>
                </div>

                {/* Recursos - MUDANÇA: Altura fixa no mobile para não sumir */}
                <div className="h-[300px] md:flex-1 md:h-auto overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                    <TaskResources task={task} />
                </div>
            </div>

            {/* Coluna da Direita (Notas) */}
            {/* MUDANÇA: Altura mínima no mobile */}
            <div className="col-span-1 md:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative group min-h-[400px] md:min-h-0">
                <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Diário de Bordo / Notas</span><span className="text-[10px] text-gray-400">{notes.length} caracteres</span></div>
                <textarea value={notes} onChange={handleNoteChange} placeholder="Registre suas ideias..." className="flex-1 w-full h-full p-6 resize-none outline-none text-gray-700 text-base leading-relaxed font-normal placeholder-gray-300" spellCheck={false} />
            </div>
        </div>
      </div>
      
      <BreathingModal isOpen={isBreathing} onClose={() => setIsBreathing(false)} />
      
      <PreSessionModal 
        isOpen={showPreSession} 
        onCancel={() => setShowPreSession(false)} 
        onStart={startSessionConfirmed} 
      />

      {showExitConfirm && (<div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"><div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"><div className="flex flex-col items-center text-center gap-4"><div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600"><AlertTriangle size={24} /></div><div><h3 className="text-lg font-bold text-gray-800">Sessão em Andamento!</h3><p className="text-sm text-gray-500 mt-1">O cronômetro ainda está rodando. Se sair agora, o tempo será salvo.</p></div><div className="flex gap-3 w-full mt-2"><button onClick={() => setShowExitConfirm(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">Cancelar</button><button onClick={manualExit} className="flex-1 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 font-medium">Salvar e Sair</button></div></div></div></div>)}
    </div>
  );
}