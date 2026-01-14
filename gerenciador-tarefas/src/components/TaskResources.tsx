// src/components/TaskResources.tsx
import { useRef } from 'react'; // Removi useState pois não será usado
import { Folder, Link as LinkIcon, FileText, HardDrive, Trash2 } from 'lucide-react';
// CORREÇÃO AQUI: Adicionado 'type' antes de Task e TaskResource
import { db, type Task, type TaskResource } from '../db';

interface Props {
  task: Task;
}

export function TaskResources({ task }: Props) {
  // CORREÇÃO: Removi a linha "const [isDragOver...]" que estava dando erro de não uso.
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
    const url = prompt("Cole a URL do link:");
    if (!url) return;
    
    let title = url;
    try { title = new URL(url).hostname; } catch (e) {}
    
    const name = prompt("Nome do Link:", title);
    if (name) title = name;

    await addResource({ 
        id: crypto.randomUUID(), 
        type: 'link', 
        title, 
        value: url,
        createdAt: new Date()
    });
  };

  const handleAddFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      const path = handle.name; 
      
      await addResource({
        id: crypto.randomUUID(),
        type: 'folder',
        title: handle.name,
        value: path,
        handle: handle,
        createdAt: new Date()
      });
    } catch (err) {
      console.log(err);
      const path = prompt("Caminho da pasta (ex: C:\\Projetos):");
      if (path) {
          await addResource({ 
              id: crypto.randomUUID(), 
              type: 'folder', 
              title: "Pasta", 
              value: path,
              createdAt: new Date()
          });
      }
    }
  };

  const handleAddFile = async () => {
    try {
        // @ts-ignore
        const [handle] = await window.showOpenFilePicker();
        const file = await handle.getFile();
        
        await addResource({
            id: crypto.randomUUID(),
            type: 'file',
            title: file.name,
            value: file.name,
            handle: handle,
            createdAt: new Date()
        });
    } catch (err) {
        fileInputRef.current?.click();
    }
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const path = file.name; 
      
      await addResource({
        id: crypto.randomUUID(),
        type: 'file',
        title: file.name,
        value: path || "Caminho não informado",
        createdAt: new Date()
      });
    }
  };

  const openResource = async (res: TaskResource) => {
      if (res.type === 'link') {
        window.open(res.value, '_blank');
      } else if (res.handle) {
         try {
             // @ts-ignore
            await res.handle.requestPermission({ mode: 'read' });
            alert(`Acesso confirmado: ${res.title}`);
         } catch (e) {
             alert("Erro ao abrir permissão. Tente remover e adicionar novamente.");
         }
      } else {
        navigator.clipboard.writeText(res.value);
        alert(`Caminho copiado: ${res.value}\n\nCole no explorador de arquivos.`);
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
                <div className="flex items-center gap-3 overflow-hidden" onClick={() => openResource(res)}>
                    <div className={`p-2 rounded-lg ${res.type === 'link' ? 'bg-blue-100 text-blue-600' : res.type === 'folder' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}>
                        {res.type === 'link' ? <LinkIcon size={20} /> : (res.type === 'folder' ? <Folder size={20}/> : <FileText size={20}/>)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{res.title}</p>
                        <p className="text-[10px] text-gray-400 truncate max-w-[200px]">
                            {res.handle ? 'Vínculo Direto' : res.value}
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
            <LinkIcon size={16} /> <span className="text-[10px] font-bold">Link</span>
        </button>
        <button onClick={handleAddFolder} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-yellow-300 hover:text-yellow-600 transition-colors gap-1 text-gray-600">
            <Folder size={16} /> <span className="text-[10px] font-bold">Pasta</span>
        </button>
        <button onClick={handleAddFile} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors gap-1 text-gray-600">
            <HardDrive size={16} /> <span className="text-[10px] font-bold">Arquivo</span>
        </button>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" onChange={onFileInputChange} />
    </div>
  );
}