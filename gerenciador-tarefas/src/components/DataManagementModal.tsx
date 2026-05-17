// src/components/DataManagementModal.tsx
import { useState, useRef } from 'react';
import { db } from '../db';
import { X, Download, Upload, Trash2, Database, CheckCircle2, Cloud } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function DataManagementModal({ isOpen, onClose }: Props) {
  // 1. TODOS OS HOOKS NO TOPO
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [driveAction, setDriveAction] = useState<'backup' | 'restore' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ESTE É UM HOOK, ENTÃO VAI ANTES DO RETURN
  const handleDriveLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      if (driveAction === 'backup') executeDriveBackup(tokenResponse.access_token);
      if (driveAction === 'restore') executeDriveRestore(tokenResponse.access_token);
    },
    onError: () => {
      setStatusMsg('Erro ao conectar com o Google.');
      setIsLoading(false);
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
  });

  // 2. SÓ DEPOIS DE DECLARAR OS HOOKS, PODEMOS PARAR A RENDERIZAÇÃO
  if (!isOpen) return null;

  // ============================================================================
  // FUNÇÃO REUTILIZÁVEL DE RESTAURAÇÃO 
  // ============================================================================
  const restoreDataToDb = async (data: any) => {
    if (!data.tasks || !data.checkins) {
        throw new Error('Formato de arquivo inválido.');
    }

    await db.transaction('rw', db.tasks, db.checkins, async () => {
      await db.tasks.clear();
      await db.checkins.clear();
      
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
  };

  // ============================================================================
  // GOOGLE DRIVE: LÓGICA DE SINCRONIZAÇÃO
  // ============================================================================
  const triggerDriveAction = (action: 'backup' | 'restore') => {
    if (action === 'restore' && !confirm('ATENÇÃO: Restaurar do Drive irá SUBSTITUIR todos os dados atuais. Deseja continuar?')) {
        return;
    }
    setDriveAction(action);
    setIsLoading(true);
    setStatusMsg('Conectando ao Google...');
    handleDriveLogin();
  };

  const executeDriveBackup = async (accessToken: string) => {
    setStatusMsg('Empacotando e enviando para o Drive...');
    try {
      // 1. SALVA O BACKUP DOS DADOS
      const tasks = await db.tasks.toArray();
      const checkins = await db.checkins.toArray();
      const data = { version: 1, timestamp: new Date().toISOString(), tasks, checkins };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });

      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_backup.json' and trashed=false", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const searchData = await searchRes.json();
      const existingFileId = searchData.files?.[0]?.id;

      const metadata = { name: 'flowmanager_backup.json', mimeType: 'application/json' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const url = existingFileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      
      const method = existingFileId ? 'PATCH' : 'POST';

      const uploadRes = await fetch(url, {
        method: method,
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });

      if (!uploadRes.ok) throw new Error('Falha no upload do backup');

      // =========================================================
      // 2. NOVO: LIBERA O LOCK (DESTRAVA O APP PARA OUTRO PC)
      // =========================================================
      setStatusMsg('Liberando acesso para outros dispositivos...');
      const lockSearchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_lock.json' and trashed=false", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const lockSearchData = await lockSearchRes.json();
      const lockFileId = lockSearchData.files?.[0]?.id;

      if (lockFileId) {
        // Pega o ID do dispositivo atual
        const deviceId = localStorage.getItem('flow_device_id') || 'unknown';
        
        // Define isLocked como false
        const unlockData = {
          deviceId: deviceId,
          userAgent: navigator.userAgent.substring(0, 40) + '...',
          isLocked: false, // <--- LIBERADO
          lastOpened: new Date().toISOString()
        };
        
        const lockBlob = new Blob([JSON.stringify(unlockData)], { type: 'application/json' });
        const lockMetadata = { name: 'flowmanager_lock.json', mimeType: 'application/json' };
        
        const lockForm = new FormData();
        lockForm.append('metadata', new Blob([JSON.stringify(lockMetadata)], { type: 'application/json' }));
        lockForm.append('file', lockBlob);

        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${lockFileId}?uploadType=multipart`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: lockForm,
        });
      }
      // =========================================================

      setStatusMsg('Backup salvo e app destravado com sucesso!');
      
      // Fecha o aplicativo/modal para o usuário saber que já pode sair
      setTimeout(() => {
        setStatusMsg('');
        onClose(); 
      }, 3000);

    } catch (error) {
      console.error(error);
      setStatusMsg('Erro ao salvar no Drive.');
    } finally {
      setIsLoading(false);
      setDriveAction(null);
    }
  };

  const executeDriveRestore = async (accessToken: string) => {
    setStatusMsg('Buscando backup no Drive...');
    try {
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_backup.json' and trashed=false", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const searchData = await searchRes.json();
      const fileId = searchData.files?.[0]?.id;

      if (!fileId) {
        setStatusMsg('Erro: Nenhum backup encontrado no seu Drive.');
        setIsLoading(false);
        return;
      }

      setStatusMsg('Baixando e restaurando dados...');
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const text = await fileRes.text();
      const data = JSON.parse(text);

      await restoreDataToDb(data);

      setStatusMsg('Dados restaurados com sucesso!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error(error);
      setStatusMsg('Erro ao restaurar do Drive. Arquivo inválido.');
      setIsLoading(false);
    }
  };

  // ============================================================================
  // FUNÇÕES LOCAIS (PC)
  // ============================================================================
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
      
      setStatusMsg('Backup local realizado com sucesso!');
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
        e.target.value = ''; 
        return;
    }

    setIsLoading(true);
    setStatusMsg('Lendo arquivo...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        await restoreDataToDb(data);

        setStatusMsg('Dados restaurados com sucesso!');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        console.error(error);
        setStatusMsg('Erro ao importar: Arquivo inválido.');
        setIsLoading(false);
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
             <Database size={20} className="text-blue-600"/> Gerenciar Dados
          </h3>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        {/* Body com Scroll */}
        <div className="p-6 space-y-6 overflow-y-auto">
            
            {statusMsg && (
                <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${statusMsg.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <CheckCircle2 size={16} className="shrink-0" /> 
                    <span>{statusMsg}</span>
                </div>
            )}

            {/* SEÇÃO NUVEM (Google Drive) */}
            <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                    <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                        <Cloud size={16} /> Google Drive
                    </h4>
                    <p className="text-xs text-blue-600/80 mt-1">Sincronize seus dados de forma segura na sua conta do Google.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => triggerDriveAction('backup')}
                        disabled={isLoading}
                        className="flex flex-col items-center gap-1 p-3 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 rounded-lg transition-all shadow-sm font-medium disabled:opacity-50"
                    >
                        <Upload size={18} /> <span className="text-xs">Salvar Nuvem</span>
                    </button>
                    <button 
                        onClick={() => triggerDriveAction('restore')}
                        disabled={isLoading}
                        className="flex flex-col items-center gap-1 p-3 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 rounded-lg transition-all shadow-sm font-medium disabled:opacity-50"
                    >
                        <Download size={18} /> <span className="text-xs">Baixar Nuvem</span>
                    </button>
                </div>
            </div>

            <hr className="border-gray-100" />

            {/* Exportar Local */}
            <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-700">Backup Manual (PC)</h4>
                <p className="text-xs text-gray-500">Salve seus projetos em um arquivo JSON no computador.</p>
                <button 
                    onClick={handleExport}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:text-blue-700 rounded-xl transition-all shadow-sm font-medium text-gray-600 disabled:opacity-50"
                >
                    <Download size={18} /> Baixar meus dados
                </button>
            </div>

            {/* Importar Local */}
            <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-700">Restaurar Manual (PC)</h4>
                <p className="text-xs text-gray-500">Recupere de um arquivo local. <span className="text-red-500 font-bold">Substitui dados atuais.</span></p>
                <button 
                    onClick={handleImportClick}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 hover:border-green-300 hover:bg-gray-50 hover:text-green-700 rounded-xl transition-all shadow-sm font-medium text-gray-600 disabled:opacity-50"
                >
                    <Upload size={18} /> Carregar arquivo local
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
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                >
                    <Trash2 size={16} /> Apagar tudo e reiniciar
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}