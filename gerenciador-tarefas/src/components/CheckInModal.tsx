// src/components/CheckInModal.tsx
import { useState } from 'react';
import { X, Activity, Wind, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';
import { db } from '../db';
import { BreathingModal } from './BreathingModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckInModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<'stress' | 'breathing_intro' | 'breathing_run' | 'journal' | 'done'>('stress');
  const [stressLevel, setStressLevel] = useState(5);
  const [note, setNote] = useState("");
  
  // CORREÇÃO AQUI: Removido 'setMinutes' pois não estava sendo usado
  const [minutes] = useState(3); 
  
  const [showBreathingExercise, setShowBreathingExercise] = useState(false);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 'stress') {
      if (stressLevel >= 7) setStep('breathing_intro');
      else setStep('journal');
    } else if (step === 'breathing_intro') {
      setShowBreathingExercise(true);
    } else if (step === 'breathing_run') {
      setStep('journal');
    } else if (step === 'journal') {
      handleSave();
    }
  };

  const handleBreathingComplete = () => {
      setShowBreathingExercise(false);
      setStep('journal');
  };

  const handleSave = async () => {
    try {
        let derivedMood = 'Neutro';
        if (stressLevel <= 3) derivedMood = 'Relaxado';
        else if (stressLevel >= 8) derivedMood = 'Tenso';

        await db.checkins.add({
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date(),
          stressLevel: stressLevel,
          notes: note,
          breathingMinutes: step === 'breathing_run' || step === 'journal' ? minutes : 0,
          mood: derivedMood
        });
        setStep('done');
        setTimeout(() => {
            onClose();
            setStep('stress');
            setStressLevel(5);
            setNote("");
        }, 1500);
    } catch (error) {
        console.error("Erro ao salvar checkin", error);
    }
  };

  const getStressColor = (level: number) => {
    if (level < 4) return 'bg-green-500';
    if (level < 8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh]">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
            <X size={20} />
        </button>

        <div className="p-8 flex-1 overflow-y-auto">
            
            {step === 'stress' && (
                <div className="space-y-6 text-center animate-in slide-in-from-right duration-300">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Check-in Inicial</h2>
                    <p className="text-gray-500">Qual seu nível de tensão/stress agora?</p>
                    
                    <div className="py-4">
                        <div className="flex justify-between text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                            <span>Zen</span>
                            <span>Explodindo</span>
                        </div>
                        <input 
                            type="range" min="0" max="10" step="1" 
                            value={stressLevel} onChange={(e) => setStressLevel(Number(e.target.value))}
                            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className={`mt-4 inline-block px-4 py-1 rounded-full text-white font-bold text-lg ${getStressColor(stressLevel)} transition-colors`}>
                            {stressLevel} / 10
                        </div>
                    </div>
                </div>
            )}

            {step === 'breathing_intro' && (
                <div className="space-y-6 text-center animate-in slide-in-from-right duration-300">
                     <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Wind size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Nível de tensão alto!</h2>
                    <p className="text-gray-600">Detectamos que você está com stress elevado ({stressLevel}/10).</p>
                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 text-left">
                        <p>Sugerimos uma pausa respiratória de 3 minutos antes de começar. Isso pode aumentar seu foco em até 40%.</p>
                    </div>
                </div>
            )}

            {step === 'journal' && (
                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                            <BookOpen size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Despejo Mental</h2>
                        <p className="text-sm text-gray-500">Tire da cabeça o que está te preocupando.</p>
                    </div>
                    <textarea 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Estou pensando sobre..."
                        className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none resize-none text-gray-700"
                    />
                </div>
            )}

            {step === 'done' && (
                <div className="flex flex-col items-center justify-center h-full py-10 animate-in zoom-in duration-300">
                    <CheckCircle2 size={64} className="text-green-500 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800">Tudo pronto!</h2>
                    <p className="text-gray-500">Bom trabalho.</p>
                </div>
            )}
        </div>

        {step !== 'done' && (
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                {step === 'breathing_intro' ? (
                    <>
                        <button onClick={() => setStep('journal')} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm">Pular</button>
                        <button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                            Iniciar Respiração <Wind size={18}/>
                        </button>
                    </>
                ) : (
                    <button onClick={handleNext} className="w-full bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2">
                        {step === 'journal' ? 'Concluir Check-in' : 'Continuar'} <ArrowRight size={18}/>
                    </button>
                )}
            </div>
        )}
      </div>
      
      <BreathingModal 
        isOpen={showBreathingExercise} 
        onClose={handleBreathingComplete} 
      />

    </div>
  );
}
