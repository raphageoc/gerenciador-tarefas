// src/components/PreSessionModal.tsx
import { useState } from 'react';
import { Wind, Play, Activity, MessageSquare } from 'lucide-react';
import { BreathingModal } from './BreathingModal';

interface Props {
  isOpen: boolean;
  onCancel: () => void;
  onStart: (stressLevel: number | undefined, didBreathing: boolean, stressNote: string) => void;
}

export function PreSessionModal({ isOpen, onCancel, onStart }: Props) {
  const [stress, setStress] = useState(5);
  const [showBreathing, setShowBreathing] = useState(false);
  const [didBreathing, setDidBreathing] = useState(false);
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const getStressColor = (val: number) => {
    if (val < 4) return 'bg-green-500';
    if (val < 7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleStart = () => {
    onStart(stress, didBreathing, note);
  };

  const handleSkip = () => {
    onStart(undefined, false, "");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-50 p-6 border-b border-gray-100 text-center shrink-0">
            <h2 className="text-xl font-bold text-gray-800">Check-in Inicial</h2>
            <p className="text-sm text-gray-500 mt-1">Como você está se sentindo?</p>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
            
            {/* 1. Nível de Stress */}
            <div className="space-y-3">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Activity size={16} className="text-blue-500"/> Nível de Tensão
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getStressColor(stress)}`}>
                        {stress}/10
                    </span>
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="1" 
                    value={stress} 
                    onChange={(e) => setStress(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                    <span>Tranquilo</span>
                    <span>Muito Tenso</span>
                </div>
            </div>

            {/* 2. Diário Rápido */}
            <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <MessageSquare size={16} className="text-purple-500" /> 
                    O que está na sua cabeça?
                </label>
                <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex: Preocupado com o prazo..."
                    className="w-full h-20 p-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none resize-none transition-all placeholder:text-gray-400"
                />
            </div>

            {/* 3. Respiração */}
            <div className={`p-4 rounded-xl border transition-all ${didBreathing ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${didBreathing ? 'bg-green-100 text-green-600' : 'bg-white text-blue-600 shadow-sm'}`}>
                        <Wind size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 text-sm">
                            {didBreathing ? 'Mente oxigenada!' : 'Precisa acalmar?'}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {didBreathing 
                                ? 'Pronto para o foco total.' 
                                : 'Faça uma respiração guiada.'}
                        </p>
                    </div>
                    {!didBreathing && (
                        <button 
                            onClick={() => setShowBreathing(true)}
                            className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                        >
                            Respirar
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0 flex flex-col gap-3">
            <div className="flex gap-3">
                <button 
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-medium hover:bg-gray-50 transition text-sm"
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleStart}
                    className="flex-[2] py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-lg shadow-gray-200 text-sm"
                >
                    <Play size={16} fill="currentColor" />
                    Registrar e Iniciar
                </button>
            </div>
            
            {/* BOTÃO PULAR EM VERMELHO */}
            <button 
                onClick={handleSkip}
                className="w-full text-center text-xs font-semibold text-red-600 hover:text-red-800 py-1 transition-colors"
            >
                Pular check-in e iniciar tarefa agora
            </button>
        </div>
      </div>

      <BreathingModal 
        isOpen={showBreathing} 
        onClose={() => {
            setShowBreathing(false);
            setDidBreathing(true);
            if(stress > 2) setStress(prev => prev - 2);
        }} 
      />
    </div>
  );
}
