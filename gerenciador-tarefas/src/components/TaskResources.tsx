// src/components/TaskResources.tsx
import { useRef } from 'react';
import { Folder, Link as LinkIcon, FileText, HardDrive, Trash2, Copy, ExternalLink } from 'lucide-react';
import { db, type Task, type TaskResource } from '../db';

interface Props {
  task: Task;
}

export function TaskResources({ task }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addResource = async (resource: TaskResource) => {
    if (!task.id) return;
    const newResources = [...(task.resources || []), resource];
    await db.tasks.update(task.id, { resources: newResources });
  };

  const removeResource = async (resId: string) => {
    if (!task.id) return;
    const newResources = task.resources.filter(r => r.id !== resId);
    await db.tasks.update(task.id, { resources: newResources });
  };

  const handleAddLink = async () => {
    const url = prompt("Cole a URL do link (ex: google.com):");
    if (!url) return;
    
    // Garante que o link tenha https:// para abrir corretamente
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        finalUrl = `https://${url}`;
    }
    
    let title = url;
    try { title = new URL(finalUrl).hostname; } catch (e) {}
    
    const name = prompt("Nome do Link (opcional):", title);
    
    await addResource({ 
        id: crypto.randomUUID(), 
        type: 'link', 
        title: name || title, 
        value: finalUrl,
        createdAt: new Date()
    });
  };

  const handleAddFolder = async () => {
    // Solicitamos o caminho texto pois o navegador não fornece o path completo
    const path = prompt("Cole o caminho COMPLETO da pasta aqui:\n(Vá na pasta, clique na barra de endereço, copie e cole aqui)");
    
    if (path) {
        // Tenta extrair o nome da última pasta do caminho
        // Ex: C:\Users\Raphael\Projetos -> Projetos
        const folderName = path.split(/[\\/]/).pop() || "Pasta";

        await addResource({ 
            id: crypto.randomUUID(), 
            type: 'folder', 
            title: folderName, 
            value: path, // Guarda o caminho real para copiar depois
            createdAt: new Date()
        });
    }
  };

  const handleAddFile = async () => {
    // Mesma lógica: para ter o caminho útil, precisamos que o usuário informe
    // Usar o input file do navegador só daria o nome, sem o caminho.
    
    const path = prompt("Cole o caminho COMPLETO do arquivo:\n(Shift + Clique Direito no arquivo -> 'Copiar como caminho')");
    
    if (path) {
        // Remove aspas que o Windows as vezes coloca ao "Copiar como caminho"
        const cleanPath = path.replace(/"/g, '');
        const fileName = cleanPath.split(/[\\/]/).pop() || "Arquivo";

        await addResource({
            id: crypto.randomUUID(),
            type: 'file',
            title: fileName,
            value: cleanPath,
            createdAt: new Date()
        });
    }
  };

  const openResource = async (res: TaskResource) => {
      if (res.type === 'link') {
        // Abre em nova aba
        window.open(res.value, '_blank');
      } else {
        // Para arquivos e pastas locais
        try {
            await navigator.clipboard.writeText(res.value);
            alert(`Caminho copiado!\n\n"${res.value}"\n\n1. Pressione Windows + R\n2. Cole (Ctrl+V) e dê Enter`);
        } catch (err) {
            alert(`Caminho: ${res.value}`);
        }
      }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b border-gray-50 flex justify-between items-center">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recursos & Arquivos</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {(!task.resources || task.resources.length === 0) && (
            <div className="text-center py-8 text-gray-400 text-xs">
                Nenhum recurso anexado.
            </div>
        )}
        
        {task.resources?.map(res => (
            <div key={res.id} className="group flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-pointer">
                <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => openResource(res)}>
                    <div className={`p-2 rounded-lg shrink-0 ${res.type === 'link' ? 'bg-blue-100 text-blue-600' : res.type === 'folder' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}>
                        {res.type === 'link' ? <LinkIcon size={20} /> : (res.type === 'folder' ? <Folder size={20}/> : <FileText size={20}/>)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-700 truncate">{res.title}</p>
                        <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                            {res.type === 'link' ? <ExternalLink size={10}/> : <Copy size={10}/>}
                            {res.value}
                        </p>
                    </div>
                </div>
                <button onClick={() => removeResource(res.id)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16} />
                </button>
            </div>
        ))}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-3 gap-2">
        <button onClick={handleAddLink} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-colors gap-1 text-gray-600">
            <LinkIcon size={16} /> <span className="text-[10px] font-bold">Link Web</span>
        </button>
        <button onClick={handleAddFolder} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-yellow-300 hover:text-yellow-600 transition-colors gap-1 text-gray-600">
            <Folder size={16} /> <span className="text-[10px] font-bold">Caminho Pasta</span>
        </button>
        <button onClick={handleAddFile} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors gap-1 text-gray-600">
            <HardDrive size={16} /> <span className="text-[10px] font-bold">Caminho Arq</span>
        </button>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" />
    </div>
  );
}