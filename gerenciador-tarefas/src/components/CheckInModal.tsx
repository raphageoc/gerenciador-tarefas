// src/components/BreathingModal.tsx
import { useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function BreathingModal({ isOpen, onClose }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [timeLeft, setTimeLeft] = useState(0); // em segundos
  const [durationMinutes, setDurationMinutes] = useState(3);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setIsActive(false);
      setPhase('inhale');
    }
  }, [isOpen]);

  // Timer Geral da Sessão
  useEffect(() => {
    let interval: number;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // Ciclo de Respiração (4-7-8)
  useEffect(() => {
    let phaseTimeout: number;
    if (isActive) {
      const runCycle = () => {
        setPhase('inhale'); // 4s
        phaseTimeout = setTimeout(() => {
          setPhase('hold'); // 7s
          phaseTimeout = setTimeout(() => {
            setPhase('exhale'); // 8s
            phaseTimeout = setTimeout(() => {
              runCycle(); // Reinicia
            }, 8000);
          }, 7000);
        }, 4000);
      };
      runCycle();
    }
    return () => clearTimeout(phaseTimeout);
  }, [isActive]);

  const startBreathing = () => {
    setTimeLeft(durationMinutes * 60);
    setIsActive(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
      
      <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white z-50">
        <X size={32} />
      </button>

      {/* MUDANÇA: Se estiver ativo, mostra SÓ a animação. Se não, mostra o menu. */}
      {isActive ? (
        <div className="flex flex-col items-center justify-center w-full h-full relative">
            
            {/* Texto de Orientação */}
            <div className="absolute top-1/4 text-center z-20">
                <h2 className="text-4xl md:text-6xl font-bold text-white tracking-widest uppercase transition-all duration-1000">
                    {phase === 'inhale' ? 'Inspire' : phase === 'hold' ? 'Segure' : 'Expire'}
                </h2>
                <p className="text-white/60 mt-4 text-xl font-mono">{formatTime(timeLeft)}</p>
            </div>

            {/* Animação de Respiração (Círculos) */}
            <div className="relative flex items-center justify-center">
                {/* Círculo Guia */}
                <div 
                    className={`w-64 h-64 rounded-full border-4 border-white/20 transition-all ease-in-out duration-[4000ms] 
                    ${phase === 'inhale' ? 'scale-150 border-blue-400/50 bg-blue-500/10' : 
                      phase === 'hold' ? 'scale-150 border-white/50 bg-white/5' : 
                      'scale-100 border-white/20 bg-transparent'}`}
                    style={{ transitionDuration: phase === 'inhale' ? '4000ms' : phase === 'hold' ? '0ms' : '8000ms' }}
                ></div>
                
                {/* Ponto Central */}
                <div className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)]"></div>
            </div>

            <button 
                onClick={() => setIsActive(false)}
                className="mt-20 px-6 py-2 rounded-full border border-white/20 text-white/40 hover:text-white hover:border-white hover:bg-white/10 transition-all text-sm uppercase tracking-widest"
            >
                Parar Sessão
            </button>
        </div>
      ) : (
        // MENU DE CONFIGURAÇÃO (Só aparece quando NÃO está ativo)
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 relative z-10">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Pausa para Respirar</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
                Acalme sua mente usando a técnica 4-7-8. Inspire pelo nariz, segure, e solte pela boca.
            </p>

            <div className="space-y-4 mb-8">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Duração da Sessão</label>
                <div className="grid grid-cols-3 gap-3">
                    {[1, 3, 5].map(min => (
                        <button 
                            key={min}
                            onClick={() => setDurationMinutes(min)}
                            className={`py-3 rounded-xl font-bold transition-all ${durationMinutes === min ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            {min} min
                        </button>
                    ))}
                </div>
            </div>

            <button 
                onClick={startBreathing}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-xl"
            >
                <Play fill="currentColor" size={20} />
                Iniciar Agora
            </button>
        </div>
      )}
    </div>
  );
}