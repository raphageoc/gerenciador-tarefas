// src/components/DataManagementModal.tsx
import { useState, useRef } from 'react';
import { db } from '../db';
import { X, Download, Upload, Trash2, Database, CheckCircle2, Cloud, LogOut } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function DataManagementModal({ isOpen, onClose }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // 1. ATUALIZAMOS OS TIPOS DE AÇÃO PARA IDENTIFICAR A ESCOLHA DO USUÁRIO
  const [driveAction, setDriveAction] = useState<'backup_only' | 'backup_exit' | 'restore' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDriveLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      // 2. REPASSA A INTENÇÃO DO USUÁRIO PARA A FUNÇÃO
      if (driveAction === 'backup_only' || driveAction === 'backup_exit') {
         executeDriveBackup(tokenResponse.access_token, driveAction === 'backup_exit');
      }
      if (driveAction === 'restore') executeDriveRestore(tokenResponse.access_token);
    },
    onError: () => {
      setStatusMsg('Erro ao conectar com o Google.');
      setIsLoading(false);
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
  });

  if (!isOpen) return null;

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
         completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
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

  const triggerDriveAction = (action: 'backup_only' | 'backup_exit' | 'restore') => {
    if (action === 'restore' && !confirm('ATENÇÃO: Restaurar do Drive irá SUBSTITUIR todos os dados atuais. Deseja continuar?')) {
        return;
    }
    setDriveAction(action);
    setIsLoading(true);
    setStatusMsg('Conectando ao Google...');
    handleDriveLogin();
  };

  // 3. FUNÇÃO AGORA RECEBE UM BOOLEANO: DEVE LIBERAR A TRAVA?
  const executeDriveBackup = async (accessToken: string, shouldReleaseLock: boolean) => {
    setStatusMsg('Verificando permissões de segurança...');
    try {
      // DUPLO CHEQUE: Eu ainda sou o dono da trava?
      const lockSearchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_lock.json' and trashed=false", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const lockSearchData = await lockSearchRes.json();
      const currentLockFileId = lockSearchData.files?.[0]?.id;

      let lockFileIdToUpdate = currentLockFileId;

      if (currentLockFileId) {
        const lockFileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${currentLockFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const currentLock = await lockFileRes.json();
        const myDeviceId = localStorage.getItem('flow_device_id');

        if (currentLock.isLocked && currentLock.deviceId !== myDeviceId) {
           setStatusMsg('ERRO: Outro dispositivo assumiu o controle. Operação cancelada.');
           setIsLoading(false);
           setDriveAction(null);
           return; 
        }
      }

      setStatusMsg('Empacotando e enviando para o Drive...');

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
      
      const uploadRes = await fetch(url, {
        method: existingFileId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });

      if (!uploadRes.ok) throw new Error('Falha no upload do backup');

      // 4. LÓGICA CONDICIONAL DE LIBERAÇÃO DA TRAVA E SAÍDA
      if (shouldReleaseLock) {
          setStatusMsg('Liberando trava e desconectando...');
          
          if (lockFileIdToUpdate) {
            const deviceId = localStorage.getItem('flow_device_id') || 'unknown';
            const unlockData = {
              deviceId: deviceId,
              userAgent: navigator.userAgent.substring(0, 40) + '...',
              isLocked: false, // <-- DESTRAVA
              lastOpened: new Date().toISOString()
            };
            
            const lockBlob = new Blob([JSON.stringify(unlockData)], { type: 'application/json' });
            const lockMetadata = { name: 'flowmanager_lock.json', mimeType: 'application/json' };
            const lockForm = new FormData();
            lockForm.append('metadata', new Blob([JSON.stringify(lockMetadata)], { type: 'application/json' }));
            lockForm.append('file', lockBlob);

            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${lockFileIdToUpdate}?uploadType=multipart`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${accessToken}` },
              body: lockForm,
            });
          }

          // Reinicia a página para voltar para o CloudGate
          setTimeout(() => {
            (window as any).skipUnloadCheck = true; // <-- DESLIGA O AVISO DE SAÍDA
            window.location.reload(); 
          }, 1500);

      } else {
          // SE NÃO PEDIU PRA SAIR, SÓ AVISA E FECHA O MODAL
          setStatusMsg('Backup salvo com sucesso! Você continua no controle.');
          setTimeout(() => {
            setStatusMsg('');
            onClose(); 
          }, 3000);
      }

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
      setTimeout(() => {
        (window as any).skipUnloadCheck = true; // <-- DESLIGA O AVISO DE SAÍDA
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error(error);
      setStatusMsg('Erro ao restaurar do Drive. Arquivo inválido.');
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const tasks = await db.tasks.toArray();
      const checkins = await db.checkins.toArray();
      const data = { version: 1, timestamp: new Date().toISOString(), tasks, checkins };

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
      setStatusMsg('Erro ao exportar dados.');
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

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
        setTimeout(() => {
            (window as any).skipUnloadCheck = true; // <-- DESLIGA O AVISO DE SAÍDA
            window.location.reload();
        }, 1500);
      } catch (error) {
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
              (window as any).skipUnloadCheck = true; // <-- DESLIGA O AVISO DE SAÍDA
              window.location.reload();
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
             <Database size={20} className="text-blue-600"/> Gerenciar Dados
          </h3>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
            
            {statusMsg && (
                <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${statusMsg.includes('ERRO') || statusMsg.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <CheckCircle2 size={16} className="shrink-0" /> 
                    <span>{statusMsg}</span>
                </div>
            )}

            {/* 5. INTERFACE DO DRIVE COM 3 BOTÕES */}
            <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                    <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                        <Cloud size={16} /> Google Drive
                    </h4>
                    <p className="text-xs text-blue-600/80 mt-1">Sincronize seus dados de forma segura na sua conta.</p>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => triggerDriveAction('backup_only')}
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center gap-1 p-2 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 rounded-lg transition-all shadow-sm font-medium disabled:opacity-50"
                        title="Salva na nuvem e permite que você continue editando"
                    >
                        <Upload size={16} /> <span className="text-[10px] text-center leading-tight">Apenas<br/>Salvar</span>
                    </button>
                    
                    <button 
                        onClick={() => triggerDriveAction('backup_exit')}
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center gap-1 p-2 bg-blue-600 hover:bg-blue-700 border border-blue-700 text-white rounded-lg transition-all shadow-sm font-bold disabled:opacity-50"
                        title="Salva na nuvem, destrava o app e volta pra tela inicial"
                    >
                        <LogOut size={16} /> <span className="text-[10px] text-center leading-tight">Salvar e<br/>Sair</span>
                    </button>

                    <button 
                        onClick={() => triggerDriveAction('restore')}
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center gap-1 p-2 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 rounded-lg transition-all shadow-sm font-medium disabled:opacity-50"
                        title="Baixa o backup da nuvem e substitui os dados daqui"
                    >
                        <Download size={16} /> <span className="text-[10px] text-center leading-tight">Baixar<br/>Nuvem</span>
                    </button>
                </div>
            </div>

            <hr className="border-gray-100" />

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

            <div className="space-y-2 pt-2">
                <button 
                    onClick={handleReset}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                >
                    <Trash2 size={16} /> Apagar tudo e reiniciar
                </button>
            </div>

            <hr className="border-gray-100 mt-6" />
            
            <div className="pt-2 pb-4">
                <button 
                    onClick={() => {
                        (window as any).skipUnloadCheck = true; // <-- DESLIGA O AVISO DE SAÍDA AQUI TAMBÉM
                        window.close();
                        alert("Dados salvos! Você já pode fechar a aba do navegador no 'X' lá em cima com segurança.");
                    }}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl transition-colors font-bold text-sm shadow-md"
                >
                    Já fechei meu aplicativo, quero fechar a aba
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}