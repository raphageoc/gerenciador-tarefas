// src/components/DataManagementModal.tsx
import { useState, useRef } from 'react';
import { db } from '../db';
import { X, Download, Upload, Trash2, Database,  CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function DataManagementModal({ isOpen, onClose }: Props) {
  const [isImporting, setIsImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const tasks = await db.tasks.toArray();
      const checkins = await db.checkins.toArray();
      
      const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        tasks,
        checkins
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `flow-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatusMsg('Backup realizado com sucesso!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (error) {
      console.error(error);
      setStatusMsg('Erro ao exportar dados.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('ATENÇÃO: Importar um backup irá SUBSTITUIR todos os dados atuais. Deseja continuar?')) {
        e.target.value = ''; // Reset input
        return;
    }

    setIsImporting(true);
    setStatusMsg('Lendo arquivo...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        if (!data.tasks || !data.checkins) {
            throw new Error('Formato de arquivo inválido.');
        }

        await db.transaction('rw', db.tasks, db.checkins, async () => {
          await db.tasks.clear();
          await db.checkins.clear();
          
          // Sanitiza datas (JSON transforma Date em string)
          const tasks = data.tasks.map((t: any) => ({
             ...t,
             createdAt: new Date(t.createdAt),
             deadline: t.deadline ? new Date(t.deadline) : undefined,
             sessions: t.sessions?.map((s: any) => ({
                 ...s,
                 start: new Date(s.start),
                 end: new Date(s.end)
             })) || [],
             resources: t.resources?.map((r: any) => ({
                 ...r,
                 createdAt: new Date(r.createdAt)
             })) || []
          }));

          const checkins = data.checkins.map((c: any) => ({
              ...c,
              timestamp: new Date(c.timestamp)
          }));

          await db.tasks.bulkAdd(tasks);
          await db.checkins.bulkAdd(checkins);
        });

        setStatusMsg('Dados restaurados com sucesso!');
        setTimeout(() => {
            window.location.reload(); // Recarrega para atualizar UI
        }, 1500);

      } catch (error) {
        console.error(error);
        setStatusMsg('Erro ao importar: Arquivo inválido.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
      if (confirm('TEM CERTEZA? Isso apagará TUDO permanentemente. Não há como desfazer.')) {
          if (prompt('Digite DELETAR para confirmar:') === 'DELETAR') {
              await db.delete();
              window.location.reload();
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
             <Database size={20} className="text-blue-600"/> Gerenciar Dados
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
            
            {statusMsg && (
                <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${statusMsg.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <CheckCircle2 size={16} /> {statusMsg}
                </div>
            )}

            {/* Exportar */}
            <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-700">Backup (Exportar)</h4>
                <p className="text-xs text-gray-500">Salve seus projetos e histórico em um arquivo JSON.</p>
                <button 
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all shadow-sm font-medium text-gray-600"
                >
                    <Download size={18} /> Baixar meus dados
                </button>
            </div>

            <hr className="border-gray-100" />

            {/* Importar */}
            <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-700">Restaurar (Importar)</h4>
                <p className="text-xs text-gray-500">Recupere dados de um arquivo. <span className="text-red-500 font-bold">Atenção: Substitui os dados atuais.</span></p>
                <button 
                    onClick={handleImportClick}
                    disabled={isImporting}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:text-green-700 rounded-xl transition-all shadow-sm font-medium text-gray-600"
                >
                    <Upload size={18} /> {isImporting ? 'Importando...' : 'Carregar arquivo de backup'}
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={handleFileChange}
                />
            </div>

            <hr className="border-gray-100" />

            {/* Resetar */}
            <div className="space-y-2 pt-2">
                <button 
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-bold text-xs uppercase tracking-widest"
                >
                    <Trash2 size={16} /> Apagar tudo e reiniciar
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}
