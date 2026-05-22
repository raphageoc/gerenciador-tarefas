// src/components/CloudGate.tsx
import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Brain, AlertTriangle, Cloud, Monitor, Unlock, ArrowRight, Info } from 'lucide-react';
import { db} from '../db';


interface CloudGateProps {
  onUnlock: (isReadOnly: boolean) => void;
}

export function CloudGate({ onUnlock }: CloudGateProps) {
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'same_device_locked' | 'different_device_locked' | 'error'>('idle');
  const [loadingMsg, setLoadingMsg] = useState('Checando sincronização...');
  const [lockInfo, setLockInfo] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem('flow_device_id');
    if (!id) {
      id = crypto.randomUUID(); 
      localStorage.setItem('flow_device_id', id);
    }
    setDeviceId(id);
  }, []);

  const loginAndCheck = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setToken(tokenResponse.access_token);
      setStatus('loading');
      setLoadingMsg('Checando trava de segurança...');
      await checkDriveLock(tokenResponse.access_token);
    },
    onError: () => setStatus('error'),
    scope: 'https://www.googleapis.com/auth/drive.file',
  });

  // FUNÇÃO QUE RESTAURA OS DADOS SILENCIOSAMENTE (Já com a correção do completedAt)
  const autoRestoreFromDrive = async (accessToken: string) => {
    setLoadingMsg('Baixando dados mais recentes da nuvem...');
    try {
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_backup.json' and trashed=false", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const searchData = await searchRes.json();
      const fileId = searchData.files?.[0]?.id;

      if (fileId) {
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const text = await fileRes.text();
        const data = JSON.parse(text);

        if (data.tasks && data.checkins) {
          await db.transaction('rw', db.tasks, db.checkins, async () => {
            await db.tasks.clear();
            await db.checkins.clear();
            
            const tasks = data.tasks.map((t: any) => ({
               ...t,
               createdAt: new Date(t.createdAt),
               deadline: t.deadline ? new Date(t.deadline) : undefined,
               completedAt: t.completedAt ? new Date(t.completedAt) : undefined, // <-- CORREÇÃO AQUI
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
        }
      }
    } catch (error) {
      console.error("Erro no auto-restore:", error);
    }
  };

  const checkDriveLock = async (accessToken: string) => {
    try {
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_lock.json' and trashed=false", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const searchData = await searchRes.json();
      const fileId = searchData.files?.[0]?.id;

      if (!fileId) {
        await updateLockOnDrive(accessToken, null);
        return;
      }

      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const currentLock = await fileRes.json();
      
      if (currentLock.isLocked) {
        setLockInfo(currentLock);
        if (currentLock.deviceId === deviceId) {
          setStatus('same_device_locked');
        } else {
          setStatus('different_device_locked');
        }
      } else {
        // SE A TRAVA ESTIVER LIVRE MAS FOR UM DISPOSITIVO DIFERENTE, BAIXA OS DADOS!
        if (currentLock.deviceId !== deviceId) {
            await autoRestoreFromDrive(accessToken);
        }
        await updateLockOnDrive(accessToken, fileId);
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  const updateLockOnDrive = async (accessToken: string, fileId: string | null) => {
    try {
      setLoadingMsg('Iniciando aplicativo...');
      const lockData = {
        deviceId,
        userAgent: navigator.userAgent.substring(0, 40) + '...',
        isLocked: true,
        lastOpened: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(lockData)], { type: 'application/json' });
      const metadata = { name: 'flowmanager_lock.json', mimeType: 'application/json' };
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const url = fileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      
      await fetch(url, {
        method: fileId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      
      onUnlock(false);
    } catch (error) {
      console.error("Erro ao travar", error);
      setStatus('error');
    }
  };

  const handleTakeover = async () => {
    setStatus('loading');
    if (token) {
      // SE ASSUMIR O CONTROLE DE OUTRO PC, TAMBÉM BAIXA OS DADOS PRIMEIRO!
      await autoRestoreFromDrive(token);
      
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_lock.json' and trashed=false", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const searchData = await searchRes.json();
      await updateLockOnDrive(token, searchData.files?.[0]?.id);
    }
  };

  const handleEnterSameDevice = () => {
    onUnlock(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FDFDFD] flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
          <Brain size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Flow Manager</h1>
        <p className="text-gray-500 mb-8 text-sm">Sincronize sua mente na nuvem de forma segura.</p>

        {status === 'idle' && (
          <button 
            onClick={() => loginAndCheck()}
            className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-md"
          >
            <Cloud size={20} /> Entrar com Google Drive
          </button>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-blue-600">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium animate-pulse">{loadingMsg}</p>
          </div>
        )}

        {status === 'same_device_locked' && (
          <div className="w-full text-left bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-blue-700 mb-2 font-bold">
              <Info size={20} /> Sincronização Pendente
            </div>
            <p className="text-sm text-blue-800 mb-4">
              Você não salvou na nuvem a última vez que usou neste dispositivo. É recomendado fazer o backup logo após entrar.
            </p>
            <div className="space-y-2">
              <button onClick={handleEnterSameDevice} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition flex justify-center items-center gap-2">
                Entrar e Sincronizar Depois
              </button>
            </div>
          </div>
        )}

        {status === 'different_device_locked' && (
          <div className="w-full text-left bg-orange-50 border border-orange-200 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-orange-700 mb-2 font-bold">
              <AlertTriangle size={20} /> App Aberto em Outro Local!
            </div>
            <p className="text-sm text-orange-800 mb-4">
              O Flow Manager precisa ser sincronizado lá no outro dispositivo primeiro, senão <strong>você perderá os dados não salvos de lá.</strong> <br/><br/>
              Aberto desde: <br/><strong>{new Date(lockInfo?.lastOpened).toLocaleString()}</strong>
            </p>
            <div className="space-y-2">
              <button onClick={handleTakeover} className="w-full bg-orange-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition flex justify-center items-center gap-2">
                <Unlock size={16} /> Assumir Controle Aqui
              </button>
              <button onClick={() => onUnlock(true)} className="w-full bg-white border border-orange-200 text-orange-700 py-2 rounded-lg text-sm font-medium hover:bg-orange-100 transition flex justify-center items-center gap-2">
                <Monitor size={16} /> Entrar Localmente (Visualização)
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full text-center">
            <p className="text-red-500 text-sm mb-4">Falha ao conectar. Verifique sua internet ou permissões.</p>
            <button onClick={() => onUnlock(true)} className="text-blue-600 text-sm font-medium hover:underline flex items-center justify-center gap-1 w-full">
              Continuar Offline (Visualização) <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}