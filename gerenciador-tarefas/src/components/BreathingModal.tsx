// src/components/BreathingModal.tsx
import { useState, useEffect, useRef } from 'react';
import { X, Play, Square, Info, Wind } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type PhaseType = 'inhale' | 'hold-full' | 'exhale' | 'hold-empty' | 'idle';

interface Technique {
  id: string;
  name: string;
  pattern: string;
  description: string;
  config: {
    inhale: number;
    holdFull: number;
    exhale: number;
    holdEmpty: number;
  };
}

const TECHNIQUES: Technique[] = [
  {
    id: 'coherence',
    name: 'Coerência Cardíaca',
    pattern: '5-0-5-0',
    description: 'Equilíbrio emocional e redução de cortisol (Ressonância 0.1Hz).',
    config: { inhale: 5000, holdFull: 0, exhale: 5000, holdEmpty: 0 }
  },
  {
    id: 'relax_478',
    name: 'Relaxamento 4-7-8',
    pattern: '4-7-8',
    description: 'Técnica para insônia e ansiedade profunda.',
    config: { inhale: 4000, holdFull: 7000, exhale: 8000, holdEmpty: 0 }
  },
  {
    id: 'box',
    name: 'Box Breathing',
    pattern: '4-4-4-4',
    description: 'Foco militar para controle sob estresse intenso.',
    config: { inhale: 4000, holdFull: 4000, exhale: 4000, holdEmpty: 4000 }
  },
  {
    id: 'diafragmatica',
    name: 'Diafragmática Lenta',
    pattern: '6-0-6-0',
    description: 'Aumenta atividade fronto-límbica e foco.',
    config: { inhale: 6000, holdFull: 0, exhale: 6000, holdEmpty: 0 }
  }
];

export function BreathingModal({ isOpen, onClose }: Props) {
  const [selectedTechId, setSelectedTechId] = useState<string>('coherence');
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<PhaseType>('idle');
  const [timerText, setTimerText] = useState('');
  
  // Refs para limpeza
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const activeTech = TECHNIQUES.find(t => t.id === selectedTechId) || TECHNIQUES[0];

  // Reset ao abrir/fechar ou mudar técnica
  useEffect(() => {
    if (!isOpen) stopBreathing();
  }, [isOpen]);

  useEffect(() => {
    if (isActive) stopBreathing(); // Para se mudar a técnica no meio
  }, [selectedTechId]);

  const stopBreathing = () => {
    setIsActive(false);
    setPhase('idle');
    setTimerText('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startBreathing = () => {
    setIsActive(true);
    setPhase('inhale'); // Inicia o ciclo
  };

  // --- MOTOR DO CICLO DE RESPIRAÇÃO ---
  // Este useEffect roda toda vez que a 'phase' muda.
  // Ele define o timer visual e agenda a próxima fase.
  useEffect(() => {
    if (!isActive || phase === 'idle') return;

    let duration = 0;
    let nextPhase: PhaseType = 'idle';

    // 1. Configurar parâmetros da fase atual
    switch (phase) {
      case 'inhale':
        duration = activeTech.config.inhale;
        nextPhase = activeTech.config.holdFull > 0 ? 'hold-full' : 'exhale';
        break;
      case 'hold-full':
        duration = activeTech.config.holdFull;
        nextPhase = 'exhale';
        break;
      case 'exhale':
        duration = activeTech.config.exhale;
        nextPhase = activeTech.config.holdEmpty > 0 ? 'hold-empty' : 'inhale';
        break;
      case 'hold-empty':
        duration = activeTech.config.holdEmpty;
        nextPhase = 'inhale';
        break;
    }

    // 2. Configurar o Contador Visual (Regressivo)
    let timeLeft = duration / 1000;
    setTimerText(timeLeft.toString());

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft > 0) {
        setTimerText(timeLeft.toString());
      } else {
        setTimerText('');
      }
    }, 1000);

    // 3. Agendar a troca para a próxima fase
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPhase(nextPhase); // Isso dispara o useEffect novamente
    }, duration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, isActive, activeTech]); // Dependências cruciais para o loop funcionar


  // --- ESTILOS VISUAIS E ANIMAÇÃO ---
  const getVisualState = () => {
    let scale = 1;
    let durationStr = '0ms';
    let label = 'Pronto?';
    let colorClass = 'bg-blue-100 text-blue-800'; // Idle color

    if (isActive) {
        switch (phase) {
            case 'inhale':
                scale = 1.7; // Expande
                durationStr = `${activeTech.config.inhale}ms`;
                label = 'INSPIRE';
                colorClass = 'bg-blue-500 text-white shadow-blue-200';
                break;
            case 'hold-full':
                scale = 1.7; // Mantém expandido
                durationStr = '0ms'; // Sem transição (fixo)
                label = 'SEGURE';
                colorClass = 'bg-purple-500 text-white shadow-purple-200';
                break;
            case 'exhale':
                scale = 1.0; // Contrai
                durationStr = `${activeTech.config.exhale}ms`;
                label = 'EXPIRE';
                colorClass = 'bg-gray-200 text-gray-600';
                break;
            case 'hold-empty':
                scale = 1.0; // Mantém contraído
                durationStr = '0ms'; // Sem transição (fixo)
                label = 'AGUARDE';
                colorClass = 'bg-gray-800 text-white';
                break;
        }
    }

    return {
        style: {
            transform: `scale(${scale})`,
            transition: `transform ${durationStr} linear` // 'linear' é essencial para sincronia
        },
        label,
        colorClass
    };
  };

  const visual = getVisualState();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
        
        {/* MENU LATERAL */}
        <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Wind className="text-blue-600" /> Respiração
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={20} className="text-gray-500" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Protocolos</p>
                {TECHNIQUES.map(tech => (
                    <button
                        key={tech.id}
                        onClick={() => setSelectedTechId(tech.id)}
                        disabled={isActive}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                            selectedTechId === tech.id 
                            ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' 
                            : 'bg-white border-gray-200 hover:border-blue-300 text-gray-600 hover:bg-blue-50'
                        } ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold text-sm ${selectedTechId === tech.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                {tech.name}
                            </span>
                            <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                {tech.pattern}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            {tech.description}
                        </p>
                    </button>
                ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
                 {!isActive ? (
                    <button 
                        onClick={startBreathing}
                        className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition shadow-lg flex items-center justify-center gap-2 text-lg"
                    >
                        <Play size={20} fill="currentColor" /> Iniciar Prática
                    </button>
                 ) : (
                    <button 
                        onClick={stopBreathing}
                        className="w-full py-4 rounded-xl bg-white border-2 border-red-100 text-red-500 font-bold hover:bg-red-50 transition flex items-center justify-center gap-2"
                    >
                        <Square size={18} fill="currentColor" /> Parar
                    </button>
                 )}
            </div>
        </div>

        {/* ÁREA DE ANIMAÇÃO */}
        <div className="w-full md:w-2/3 bg-white relative flex flex-col items-center justify-center p-8 overflow-hidden">
            
            {/* Instrução */}
            <div className="absolute top-10 text-center z-10">
                <h3 className="text-4xl font-black text-gray-800 tracking-tight uppercase transition-all duration-300">
                    {visual.label}
                </h3>
                <p className="text-gray-400 text-sm mt-2 font-medium">
                    {activeTech.name}
                </p>
            </div>

            {/* Círculo Principal */}
            <div className="relative flex items-center justify-center">
                {/* Guia de fundo (Tamanho Máximo) */}
                <div className="absolute w-72 h-72 rounded-full border-2 border-dashed border-gray-100" />
                
                {/* Círculo Animado */}
                <div 
                    className={`w-40 h-40 rounded-full flex items-center justify-center shadow-2xl relative z-20 ${visual.colorClass}`}
                    style={visual.style}
                >
                    {/* Timer dentro do círculo */}
                    {isActive && timerText && (
                        <span className="text-4xl font-mono font-light animate-in zoom-in duration-200">
                            {timerText}
                        </span>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 flex items-center gap-2 text-gray-400 text-xs max-w-md text-center px-4">
                <Info size={14} />
                <span>Siga o círculo: Expandir = Inspirar | Contrair = Expirar</span>
            </div>
        </div>

      </div>
    </div>
  );
}
