// src/components/CloudGate.tsx
import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Brain, AlertTriangle, Cloud, Monitor, Unlock, ArrowRight } from 'lucide-react';

interface CloudGateProps {
  onUnlock: () => void;
}

export function CloudGate({ onUnlock }: CloudGateProps) {
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'conflict' | 'error'>('idle');
  const [lockInfo, setLockInfo] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Gera ou recupera a identidade deste navegador específico
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
      await checkDriveLock(tokenResponse.access_token);
    },
    onError: () => setStatus('error'),
    scope: 'https://www.googleapis.com/auth/drive.file',
  });

  const checkDriveLock = async (accessToken: string) => {
    try {
      // 1. Procura o arquivo de trava
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_lock.json' and trashed=false", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const searchData = await searchRes.json();
      const fileId = searchData.files?.[0]?.id;

      if (!fileId) {
        // Se não existe, cria a trava e entra
        await updateLockOnDrive(accessToken, null);
        return;
      }

      // 2. Lê a trava existente
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const currentLock = await fileRes.json();
      
      // 3. Verifica se outra pessoa/PC está com o app aberto
      if (currentLock.isLocked && currentLock.deviceId !== deviceId) {
        setLockInfo(currentLock);
        setStatus('conflict');
      } else {
        // Se já era nosso ou estava destravado, retoma a trava e entra
        await updateLockOnDrive(accessToken, fileId);
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  const updateLockOnDrive = async (accessToken: string, fileId: string | null) => {
    try {
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
      
      onUnlock();
    } catch (error) {
      console.error("Erro ao travar", error);
      setStatus('error');
    }
  };

  const handleTakeover = async () => {
    setStatus('loading');
    if (token) {
      // Como não guardamos o fileId no state neste exemplo simplificado, 
      // fazemos uma busca rápida para pegar o ID e sobrescrever.
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='flowmanager_lock.json' and trashed=false", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const searchData = await searchRes.json();
      await updateLockOnDrive(token, searchData.files?.[0]?.id);
    }
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
            <p className="text-sm font-medium animate-pulse">Checando sincronização...</p>
          </div>
        )}

        {status === 'conflict' && (
          <div className="w-full text-left bg-orange-50 border border-orange-200 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-orange-700 mb-2 font-bold">
              <AlertTriangle size={20} /> App Aberto em Outro Local!
            </div>
            <p className="text-sm text-orange-800 mb-4">
              O Flow Manager parece estar aberto em outro dispositivo ou aba desde: <br/>
              <strong>{new Date(lockInfo?.lastOpened).toLocaleString()}</strong>
            </p>
            <div className="space-y-2">
              <button onClick={handleTakeover} className="w-full bg-orange-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition flex justify-center items-center gap-2">
                <Unlock size={16} /> Assumir Controle Aqui
              </button>
              <button onClick={onUnlock} className="w-full bg-white border border-orange-200 text-orange-700 py-2 rounded-lg text-sm font-medium hover:bg-orange-100 transition flex justify-center items-center gap-2">
                <Monitor size={16} /> Entrar Localmente (Sem salvar Trava)
              </button>
            </div>
            <p className="text-[10px] text-orange-500 mt-3 text-center leading-tight">
              Se você assumir o controle, lembre-se de salvar os dados antes. O modo local não bloqueia edições, mas evita sobrescrever a trava da nuvem.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full text-center">
            <p className="text-red-500 text-sm mb-4">Falha ao conectar com o Drive. Verifique sua internet ou permissões.</p>
            <button onClick={onUnlock} className="text-blue-600 text-sm font-medium hover:underline flex items-center justify-center gap-1 w-full">
              Continuar Offline <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}