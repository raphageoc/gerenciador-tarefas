// src/components/DataManagement.tsx
import { useState, useRef } from 'react';
import { db } from '../db';
import { Download, Trash2, UploadCloud, RefreshCw } from 'lucide-react';

// ATENÇÃO: A palavra 'export' aqui é obrigatória para o erro sumir
export function DataManagement() {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. EXPORTAR ---
  const handleExportBackup = async () => {
    setIsProcessing(true);
    try {
      const allTasks = await db.tasks.toArray();
      const allCheckins = await db.checkins.toArray();
      
      const backupData = {
        version: 1,
        generatedAt: new Date().toISOString(),
        tasks: allTasks,
        checkins: allCheckins
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Flow_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert("Backup baixado!");
    } catch (error) {
      alert("Erro ao exportar.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 2. IMPORTAR ---
  const handleImportClick = () => fileInputRef.current?.click();

  const processImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("ATENÇÃO: Importar um backup irá substituir/mesclar com seus dados atuais. Continuar?")) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.tasks) await db.tasks.bulkPut(data.tasks);
        if (data.checkins) await db.checkins.bulkPut(data.checkins);
        alert("Dados restaurados com sucesso! Atualize a página.");
        window.location.reload();
      } catch (err) {
        alert("Arquivo de backup inválido.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  // --- 3. LIMPAR TUDO ---
  const handleClearCompleted = async () => {
    if (confirm("Tem certeza que deseja apagar o banco inteiro? Isso é irreversível.")) {
      await db.tasks.clear();
      await db.checkins.clear();
      window.location.reload();
    }
  };

  // --- 4. REPARAR FANTASMAS ---
  const handleFixGhosts = async () => {
    setIsProcessing(true);
    try {
        const allTasks = await db.tasks.toArray();
        const allIds = new Set(allTasks.map(t => t.id));
        let deletedCount = 0;

        const tasksToDelete = allTasks.filter(t => {
            if (t.parentId && !allIds.has(t.parentId)) {
                return true;
            }
            return false;
        });

        if (tasksToDelete.length > 0) {
            const idsToDelete = tasksToDelete.map(t => t.id!);
            await db.tasks.bulkDelete(idsToDelete);
            deletedCount = idsToDelete.length;
        }

        alert(`Limpeza concluída! ${deletedCount} itens fantasmas removidos.`);
        if (deletedCount > 0) window.location.reload();

    } catch (e) {
        alert("Erro ao reparar banco.");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-8">
      <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
         Gerenciamento de Dados
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Controle seus backups e manutenção do sistema.
      </p>
      
      <input type="file" accept=".json" ref={fileInputRef} onChange={processImportFile} className="hidden" />
      
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={handleExportBackup}
          disabled={isProcessing}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-xs md:text-sm"
        >
          <Download size={16} /> Backup
        </button>

        <button 
          onClick={handleImportClick}
          disabled={isProcessing}
          className="flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 text-xs md:text-sm"
        >
          <UploadCloud size={16} /> Restaurar
        </button>

        <button 
          onClick={handleFixGhosts}
          disabled={isProcessing}
          className="flex items-center gap-2 bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-lg hover:bg-yellow-100 transition disabled:opacity-50 text-xs md:text-sm"
          title="Remove tarefas de projetos excluídos que ficaram no sistema"
        >
          <RefreshCw size={16} /> Reparar Erros
        </button>

        <button 
          onClick={handleClearCompleted}
          className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 transition ml-auto text-xs md:text-sm"
        >
          <Trash2 size={16} /> Resetar App
        </button>
      </div>
    </div>
  );
}
