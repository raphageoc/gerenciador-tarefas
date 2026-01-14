// src/components/BreathingModal.tsx
import { useState, useEffect, useRef } from 'react';
import { X, Play, Wind, Box, Activity, Clock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TECHNIQUES = [
  {
    id: '4-7-8',
    name: 'Relaxamento (4-7-8)',
    description: 'Para ansiedade e sono. Acalma o sistema nervoso.',
    icon: Wind,
    color: 'bg-blue-500',
    steps: [
      { phase: 'inhale', label: 'Inspire', ms: 4000 },
      { phase: 'hold', label: 'Segure', ms: 7000 },
      { phase: 'exhale', label: 'Expire', ms: 8000 },
    ]
  },
  {
    id: 'box',
    name: 'Foco (Quadrada)',
    description: 'Para concentração e alerta. Usada por militares.',
    icon: Box,
    color: 'bg-indigo-500',
    steps: [
      { phase: 'inhale', label: 'Inspire', ms: 4000 },
      { phase: 'hold', label: 'Segure', ms: 4000 },
      { phase: 'exhale', label: 'Expire', ms: 4000 },
      { phase: 'hold_empty', label: 'Segure (Vazio)', ms: 4000 },
    ]
  },
  {
    id: 'coherence',
    name: 'Equilíbrio (Coerência)',
    description: 'Para estabilidade emocional. Ritmo cardíaco suave.',
    icon: Activity,
    color: 'bg-teal-500',
    steps: [
      { phase: 'inhale', label: 'Inspire', ms: 5500 },
      { phase: 'exhale', label: 'Expire', ms: 5500 },
    ]
  }
];

export function BreathingModal({ isOpen, onClose }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState('4-7-8');
  const [durationMinutes, setDurationMinutes] = useState(3);
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const cycleTimeoutRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  const currentTech = TECHNIQUES.find(t => t.id === selectedTechId) || TECHNIQUES[0];
  const currentStep = currentTech.steps[currentStepIndex];

  useEffect(() => {
    if (isOpen) {
      setIsActive(false);
      isRunningRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: number;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const runCycleStep = (stepIndex: number) => {
    if (!isRunningRef.current) return;

    const technique = TECHNIQUES.find(t => t.id === selectedTechId) || TECHNIQUES[0];
    const step = technique.steps[stepIndex];
    
    setCurrentStepIndex(stepIndex);

    cycleTimeoutRef.current = setTimeout(() => {
      const nextIndex = (stepIndex + 1) % technique.steps.length;
      runCycleStep(nextIndex);
    }, step.ms);
  };

  const startSession = () => {
    setTimeLeft(durationMinutes * 60);
    setIsActive(true);
    isRunningRef.current = true;
    setCurrentStepIndex(0);
    runCycleStep(0);
  };

  const stopSession = () => {
    setIsActive(false);
    isRunningRef.current = false;
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
  };

  useEffect(() => {
    return () => {
      if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // CORREÇÃO: Função simplificada removendo variáveis não usadas
  const getCircleStyle = () => {
    const phase = currentStep.phase;
    const duration = currentStep.ms;

    // Define se deve estar expandido (Inspire/Hold) ou contraído (Exhale)
    const isExpanded = phase === 'inhale' || phase === 'hold';
    
    // Define opacidade sutil para feedback visual extra
    let opacity = 1;
    if (phase === 'hold' || phase === 'hold_empty') opacity = 0.8;
    
    return {
        transform: isExpanded ? 'scale(2.5)' : 'scale(1)',
        transition: `transform ${duration}ms linear, opacity ${duration}ms ease-in-out`,
        opacity: opacity
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
      
      <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white z-50">
        <X size={32} />
      </button>

      {isActive ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden">
            
            <div className="relative z-30 text-center mb-16">
                <p className="text-white/50 text-sm font-mono tracking-widest uppercase mb-2">
                    {currentTech.name}
                </p>
                <h2 className="text-5xl md:text-7xl font-bold text-white tracking-widest uppercase transition-all duration-300 drop-shadow-2xl">
                    {currentStep.label}
                </h2>
                <div className="mt-6 inline-flex items-center gap-2 bg-white/10 px-4 py-1 rounded-full text-blue-200">
                    <Clock size={16} />
                    <span className="font-mono text-xl">{formatTime(timeLeft)}</span>
                </div>
            </div>

            <div className="relative flex items-center justify-center z-20">
                <div className="absolute w-24 h-24 rounded-full border border-white/10 scale-[2.5]" />
                <div className="absolute w-24 h-24 rounded-full border border-white/5" />

                {/* Círculo Principal Animado */}
                <div 
                    className="w-24 h-24 rounded-full bg-blue-500/20 border-4 border-blue-400 shadow-[0_0_50px_rgba(59,130,246,0.5)] backdrop-blur-sm will-change-transform"
                    style={getCircleStyle()}
                />
                
                <div className="absolute z-40 text-xs font-bold text-white/80 uppercase tracking-widest pointer-events-none">
                    Foco
                </div>
            </div>

            <button 
                onClick={stopSession}
                className="mt-32 px-8 py-3 rounded-full border border-white/20 text-white/60 hover:text-white hover:border-white hover:bg-white/10 transition-all text-sm uppercase tracking-widest z-30"
            >
                Encerrar
            </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300 relative z-20 flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
            
            <div className="flex-1 p-6 md:p-8 bg-gray-50 border-r border-gray-100 overflow-y-auto">
                <h3 className="text-xl font-bold text-gray-800 mb-1">Técnica</h3>
                <p className="text-xs text-gray-500 mb-4">Escolha o padrão ideal para agora.</p>
                
                <div className="space-y-3">
                    {TECHNIQUES.map(tech => (
                        <button
                            key={tech.id}
                            onClick={() => setSelectedTechId(tech.id)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3 group ${selectedTechId === tech.id ? 'border-blue-500 bg-white shadow-md' : 'border-transparent bg-white/50 hover:bg-white hover:border-gray-200'}`}
                        >
                            <div className={`p-2 rounded-lg text-white shrink-0 ${tech.color} ${selectedTechId === tech.id ? 'shadow-lg' : 'opacity-70'}`}>
                                <tech.icon size={20} />
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${selectedTechId === tech.id ? 'text-gray-900' : 'text-gray-600'}`}>{tech.name}</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tech.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full md:w-[280px] p-6 md:p-8 flex flex-col bg-white">
                <div className="mb-auto">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">Duração</h3>
                    <p className="text-xs text-gray-500 mb-4">Quanto tempo você tem?</p>
                    
                    <div className="space-y-2">
                        {[1, 3, 5, 10].map(min => (
                            <button 
                                key={min}
                                onClick={() => setDurationMinutes(min)}
                                className={`w-full py-3 px-4 rounded-lg text-sm font-bold flex justify-between items-center transition-all ${durationMinutes === min ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                <span>{min} minutos</span>
                                {durationMinutes === min && <Activity size={14} className="animate-pulse"/>}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <button 
                        onClick={startSession}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-blue-200"
                    >
                        <Play fill="currentColor" size={20} />
                        Começar
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-3">
                        O cronômetro da tarefa continuará rodando.
                    </p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
