// src/components/TaskResources.tsx
// src/components/TaskResources.tsx
import { useRef, useContext } from 'react';
import { Folder, Link as LinkIcon, FileText, HardDrive, Trash2, Copy, ExternalLink } from 'lucide-react';
import { db, type Task, type TaskResource } from '../db';
import { ReadOnlyContext } from '../App'; // <-- IMPORTADO O CONTEXTO DE TRAVA

interface Props {
  task: Task;
}

export function TaskResources({ task }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isReadOnly = useContext(ReadOnlyContext); // <-- LENDO O MODO LEITURA AQUI

  const addResource = async (resource: TaskResource) => {
    if (!task.id || isReadOnly) return; // <-- TRAVA DE EDIÇÃO AQUI
    const newResources = [...(task.resources || []), resource];
    await db.tasks.update(task.id, { resources: newResources });
  };

  const removeResource = async (resId: string) => {
    if (!task.id || isReadOnly) return; // <-- TRAVA DE EDIÇÃO AQUI
    const newResources = task.resources.filter(r => r.id !== resId);
    await db.tasks.update(task.id, { resources: newResources });
  };

  const handleAddLink = async () => {
    if (isReadOnly) return;
    const url = prompt("Cole a URL do link (ex: google.com):");
    if (!url) return;
    
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        finalUrl = `https://${url}`;
    }
    
    let defaultTitle = url;
    try { defaultTitle = new URL(finalUrl).hostname; } catch (e) {}
    
    const name = prompt("Nome do Link (opcional):", defaultTitle);
    if (name === null) return;

    await addResource({ 
        id: crypto.randomUUID(), 
        type: 'link', 
        title: name.trim() || defaultTitle, 
        value: finalUrl,
        createdAt: new Date()
    });
  };

  const handleAddFolder = async () => {
    if (isReadOnly) return;
    const path = prompt("Cole o caminho COMPLETO da pasta aqui:\n(Vá na pasta, clique na barra de endereço, copie e cole aqui)");
    
    if (path) {
        const defaultName = path.split(/[\\/]/).pop() || "Pasta";
        const title = prompt("Qual nome deseja dar para esta pasta?", defaultName);
        if (title === null) return;

        await addResource({ 
            id: crypto.randomUUID(), 
            type: 'folder', 
            title: title.trim() || defaultName, 
            value: path, 
            createdAt: new Date()
        });
    }
  };

  const handleAddFile = async () => {
    if (isReadOnly) return;
    const path = prompt("Cole o caminho COMPLETO do arquivo:\n(Shift + Clique Direito no arquivo -> 'Copiar como caminho')");
    
    if (path) {
        const cleanPath = path.replace(/"/g, '');
        const defaultName = cleanPath.split(/[\\/]/).pop() || "Arquivo";
        const title = prompt("Qual nome deseja dar para este arquivo?", defaultName);
        if (title === null) return;

        await addResource({
            id: crypto.randomUUID(),
            type: 'file',
            title: title.trim() || defaultName,
            value: cleanPath,
            createdAt: new Date()
        });
    }
  };

  const openResource = async (res: TaskResource) => {
      if (res.type === 'link') {
        window.open(res.value, '_blank');
      } else {
        try {
            await navigator.clipboard.writeText(res.value);
            alert(`Caminho copiado!\n\n"${res.value}"\n\n1. Pressione Windows + R\n2. Cole (Ctrl+V) e dê Enter`);
        } catch (err) {
            alert(`Caminho: ${res.value}`);
        }
      }
  };

  return (
    // CORREÇÃO: h-full e overflow-hidden no pai principal
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-xl">
      
      {/* Header Fixo */}
      <div className="p-3 border-b border-gray-50 flex justify-between items-center bg-white shrink-0">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recursos & Arquivos</span>
        <span className="text-[10px] text-gray-300 font-mono">{task.resources?.length || 0}</span>
      </div>
      
      {/* Lista com Scroll (flex-1 + min-h-0 é essencial) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {(!task.resources || task.resources.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs">
                Nenhum recurso anexado.
            </div>
        )}
        
        {task.resources?.map(res => (
            <div key={res.id} className="group flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-pointer bg-white shadow-sm border-gray-50">
                <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => openResource(res)}>
                    <div className={`p-2 rounded-lg shrink-0 ${res.type === 'link' ? 'bg-blue-100 text-blue-600' : res.type === 'folder' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}>
                        {res.type === 'link' ? <LinkIcon size={18} /> : (res.type === 'folder' ? <Folder size={18}/> : <FileText size={18}/>)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-700 truncate">{res.title}</p>
                        <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                            {res.type === 'link' ? <ExternalLink size={10}/> : <Copy size={10}/>}
                            {res.value}
                        </p>
                    </div>
                </div>
                {/* SÓ MOSTRA O BOTÃO DE DELETAR SE NÃO FOR READONLY */}
                {!isReadOnly && (
                    <button onClick={() => removeResource(res.id)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        ))}
      </div>

      {/* SÓ MOSTRA O FOOTER DE ADICIONAR SE NÃO FOR READONLY */}
      {!isReadOnly && (
          <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-3 gap-2 shrink-0 z-10">
            <button onClick={handleAddLink} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-colors gap-1 text-gray-600 shadow-sm">
                <LinkIcon size={16} /> <span className="text-[10px] font-bold">Link Web</span>
            </button>
            <button onClick={handleAddFolder} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-yellow-300 hover:text-yellow-600 transition-colors gap-1 text-gray-600 shadow-sm">
                <Folder size={16} /> <span className="text-[10px] font-bold">Pasta</span>
            </button>
            <button onClick={handleAddFile} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors gap-1 text-gray-600 shadow-sm">
                <HardDrive size={16} /> <span className="text-[10px] font-bold">Arquivo</span>
            </button>
          </div>
      )}

      <input type="file" ref={fileInputRef} className="hidden" />
    </div>
  );
}