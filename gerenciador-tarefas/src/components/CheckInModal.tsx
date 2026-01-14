import { useState, useEffect } from 'react';
import { X, Wind, Heart, ArrowRight } from 'lucide-react';
import { db } from '../db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'ask' | 'breathing_setup' | 'breathing_run' | 'journal';

export function CheckInModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<Step>('ask');
  
  // Dados do Diário
  const [stress, setStress] = useState(5);
  const [note, setNote] = useState('');

  // Dados da Respiração
  const [minutes, setMinutes] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [instruction, setInstruction] = useState('Inspire...');

  // Resetar estado quando abrir
  useEffect(() => {
    if (isOpen) {
      setStep('ask');
      setStress(5);
      setNote('');
    }
  }, [isOpen]);

  // Lógica do Timer e Animação de Respiração (Mantida igual)
  useEffect(() => {
    if (step !== 'breathing_run') return;

    const timerInterval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setStep('journal'); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const cycleTime = 8000;
    const breathCycle = () => {
      setBreathPhase('inhale');
      setInstruction('Inspire...');
      setTimeout(() => {
        if (step === 'breathing_run') {
            setBreathPhase('exhale');
            setInstruction('Expire...');
        }
      }, 4000);
    };

    breathCycle();
    const breathInterval = setInterval(breathCycle, cycleTime);

    return () => {
      clearInterval(timerInterval);
      clearInterval(breathInterval);
    };
  }, [step]);

  const startBreathing = () => {
    setSecondsLeft(minutes * 60);
    setStep('breathing_run');
  };

  // --- CORREÇÃO PRINCIPAL AQUI ---
  const handleSave = async () => {
    try {
      await db.checkins.add({
        date: new Date(),
        stressLevel: stress,
        note: note,
        breathingMinutes: step === 'breathing_run' || step === 'journal' ? minutes : 0
      });
    } catch (error) {
      console.error("Erro ao salvar check-in:", error);
      // Opcional: alert("Erro ao salvar no banco, verifique o console.");
    } finally {
      // O finally garante que o modal feche INDEPENDENTE se salvou ou deu erro
      onClose(); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-300">
        
        {step !== 'breathing_run' && (
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        )}

        {step === 'ask' && (
          <div className="p-8 text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
              <Wind size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Olá!</h2>
              <p className="text-gray-500 mt-2">Gostaria de fazer um breve exercício de respiração para centrar a mente?</p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button onClick={() => setStep('breathing_setup')} className="bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
                Sim, quero respirar
              </button>
              <button onClick={() => setStep('journal')} className="text-gray-500 py-3 rounded-xl font-medium hover:bg-gray-50 transition">
                Não, ir direto para o check-in
              </button>
            </div>
          </div>
        )}

        {step === 'breathing_setup' && (
          <div className="p-8 text-center flex flex-col items-center gap-6">
             <h3 className="text-xl font-bold text-gray-800">Quanto tempo?</h3>
             <div className="flex items-center gap-4">
                <button onClick={() => setMinutes(m => Math.max(1, m - 1))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold">-</button>
                <div className="text-4xl font-mono font-bold text-blue-600 w-24">{minutes}:00</div>
                <button onClick={() => setMinutes(m => Math.min(10, m + 1))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold">+</button>
             </div>
             <button onClick={startBreathing} className="bg-blue-600 text-white w-full py-3 rounded-xl font-semibold hover:bg-blue-700 transition mt-4">
                Iniciar
              </button>
          </div>
        )}

        {step === 'breathing_run' && (
          <div className="p-10 text-center flex flex-col items-center justify-center h-96 bg-blue-50">
            <div className="text-4xl font-mono font-bold text-blue-300 mb-8">
              {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
            </div>
            <div className="relative flex items-center justify-center w-48 h-48">
              <div className={`absolute bg-blue-400 rounded-full transition-all duration-[4000ms] ease-in-out opacity-80 ${breathPhase === 'inhale' ? 'w-48 h-48' : 'w-24 h-24'}`} />
              <div className="z-10 text-white text-xl font-bold font-mono tracking-widest uppercase">{instruction}</div>
            </div>
            <button onClick={() => setStep('journal')} className="mt-10 text-blue-400 hover:text-blue-600 text-sm font-semibold uppercase tracking-wider">
              Pular Exercício
            </button>
          </div>
        )}

        {step === 'journal' && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Heart className="text-red-500" fill="currentColor" /> Como você está?
            </h2>
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase">Stress</span>
                <span className={`text-sm font-bold ${stress > 7 ? 'text-red-500' : 'text-blue-600'}`}>{stress}/10</span>
              </div>
              <input type="range" min="0" max="10" value={stress} onChange={(e) => setStress(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">O que está sentindo?</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escreva brevemente o motivo..." className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none text-sm" />
            </div>
            <button onClick={handleSave} className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-black transition flex items-center justify-center gap-2">
              Salvar Check-in <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
