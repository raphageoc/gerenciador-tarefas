import { useState, useRef } from 'react';
import { db, type Task, type TaskResource } from '../db';
import { Folder, Link as LinkIcon, FileText, ExternalLink, HardDrive, Trash2 } from 'lucide-react';

interface Props {
  task: Task;
}

export function TaskResources({ task }: Props) {
  // Referência para o input invisível (fallback para Firefox)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addResource = async (resource: TaskResource) => {
    const currentResources = task.resources || [];
    const newResources = [...currentResources, resource];
    if (task.id) await db.tasks.update(task.id, { resources: newResources });
  };

  // 1. Adicionar Link
  const handleAddLink = async () => {
    const url = prompt("Cole a URL:");
    if (!url) return;
    const title = prompt("Nome do Link:", "Link");
    if (!title) return;

    await addResource({ id: crypto.randomUUID(), type: 'link', title, value: url });
  };

  // 2. Adicionar Pasta
  const handleAddFolder = async () => {
    try {
      // @ts-ignore - Tenta API moderna (Chrome/Edge)
      const handle = await window.showDirectoryPicker();
      const title = prompt("Nome da Pasta:", handle.name);
      if (!title) return;

      await addResource({
        id: crypto.randomUUID(),
        type: 'folder',
        title,
        value: "", // API moderna não precisa de string de caminho
        handle: handle
      });
    } catch (e) {
      // Fallback manual
      const path = prompt("Seu navegador não suporta vínculo direto.\nCole o caminho da pasta:");
      if (path) {
        await addResource({ id: crypto.randomUUID(), type: 'folder', title: "Pasta", value: path });
      }
    }
  };

  // 3. Adicionar Arquivo (Lógica Híbrida Inteligente)
  const handleAddFileClick = async () => {
    // TENTATIVA 1: API Moderna (Chrome/Edge)
    // Permite salvar a referência para abrir depois
    if ('showOpenFilePicker' in window) {
      try {
        // @ts-ignore
        const [handle] = await window.showOpenFilePicker();
        const title = prompt("Descrição do Arquivo:", handle.name);
        if (!title) return;

        await addResource({
          id: crypto.randomUUID(),
          type: 'file',
          title,
          value: "",
          handle: handle
        });
        return; // Sucesso, para por aqui
      } catch (err) {
        // Se o usuário cancelar, não faz nada
        return;
      }
    }

    // TENTATIVA 2: Input Padrão (Firefox/Outros)
    // Abre a janela do sistema, mas só conseguimos pegar o NOME, não o caminho completo
    fileInputRef.current?.click();
  };

  // Processa o arquivo selecionado pelo método "antigo" (Firefox)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Como o navegador esconde o caminho real (C:\fakepath\...), 
    // pegamos o nome e pedimos o caminho para o usuário colar se ele quiser guardar a referência.
    const path = prompt(
      `Arquivo selecionado: "${file.name}"\n\nPor segurança, o navegador não me dá o caminho completo.\nCole o local aqui para referência futura (opcional):`, 
      `/home/raphael/.../${file.name}`
    );

    await addResource({
      id: crypto.randomUUID(),
      type: 'file',
      title: file.name,
      value: path || "Caminho não informado"
    });
    
    // Limpa o input para poder selecionar o mesmo arquivo de novo se quiser
    e.target.value = "";
  };

  const openResource = async (res: TaskResource) => {
    if (res.type === 'link') {
      window.open(res.value, '_blank');
    } else if (res.handle) {
      // Lógica para Chrome/Edge
      try {
        // @ts-ignore
        await res.handle.requestPermission({ mode: 'read' });
        alert(`Acesso confirmado: ${res.title}`);
      } catch { alert("Erro de permissão"); }
    } else {
      // Lógica para Caminho Manual
      navigator.clipboard.writeText(res.value);
      alert(`Caminho copiado: ${res.value}`);
    }
  };

  const removeResource = async (id: string) => {
    if (!confirm("Remover?")) return;
    const newResources = task.resources.filter(r => r.id !== id);
    if (task.id) await db.tasks.update(task.id, { resources: newResources });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4 h-full">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <HardDrive size={16} /> Recursos
      </h3>

      {/* Input invisível para compatibilidade Firefox */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="flex-1 space-y-3 overflow-y-auto">
        {task.resources?.map((res) => (
          <div key={res.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg group">
            <div className={`p-2 rounded ${res.type === 'link' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>
              {res.type === 'link' ? <LinkIcon size={20} /> : (res.type === 'folder' ? <Folder size={20}/> : <FileText size={20}/>)}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openResource(res)}>
              <p className="text-sm font-bold text-gray-700 truncate">{res.title}</p>
              <p className="text-xs text-gray-500 truncate font-mono">
                {res.handle ? 'Vínculo Direto' : res.value}
              </p>
            </div>
            <button onClick={() => removeResource(res.id)} className="p-2 text-gray-400 hover:text-red-600 rounded">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-auto">
        <button onClick={handleAddFolder} className="btn-resource bg-gray-100 hover:bg-gray-200 p-2 rounded text-xs">Pasta</button>
        <button onClick={handleAddFileClick} className="btn-resource bg-gray-100 hover:bg-gray-200 p-2 rounded text-xs">Arquivo</button>
        <button onClick={handleAddLink} className="btn-resource bg-gray-100 hover:bg-gray-200 p-2 rounded text-xs">Link</button>
      </div>
    </div>
  );
}
