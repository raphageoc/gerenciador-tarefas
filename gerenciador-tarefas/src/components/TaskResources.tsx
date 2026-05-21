// src/components/TaskResources.tsx
import { useRef, useContext, useState } from 'react';
import { Folder, Link as LinkIcon, FileText, HardDrive, Trash2, Copy, ExternalLink } from 'lucide-react';
import { db, type Task, type TaskResource } from '../db';
import { ReadOnlyContext } from '../App';

interface Props {
  task: Task;
}

type ModalType = 'link' | 'folder' | 'file';

export function TaskResources({ task }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isReadOnly = useContext(ReadOnlyContext);

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('link');
  const [inputValue, setInputValue] = useState('');
  const [titleValue, setTitleValue] = useState('');

  const addResource = async (resource: TaskResource) => {
    if (!task.id || isReadOnly) return;
    const newResources = [...(task.resources || []), resource];
    await db.tasks.update(task.id, { resources: newResources });
  };

  const removeResource = async (resId: string) => {
    if (!task.id || isReadOnly) return;
    const newResources = task.resources.filter(r => r.id !== resId);
    await db.tasks.update(task.id, { resources: newResources });
  };

  const openAddModal = (type: ModalType) => {
    if (isReadOnly) return;
    setModalType(type);
    setInputValue('');
    setTitleValue('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setInputValue('');
    setTitleValue('');
  };

  const handleModalSubmit = async () => {
    if (!inputValue.trim() || isReadOnly) return;

    let finalValue = inputValue.trim();
    let finalTitle = titleValue.trim();

    // Tratamento específico por tipo
    if (modalType === 'link') {
      if (!finalValue.startsWith('http://') && !finalValue.startsWith('https://')) {
        finalValue = `https://${finalValue}`;
      }
      if (!finalTitle) {
        try { finalTitle = new URL(finalValue).hostname; } 
        catch (e) { finalTitle = finalValue; }
      }
    } 
    else if (modalType === 'folder') {
      if (!finalTitle) {
        finalTitle = finalValue.split(/[\\/]/).pop() || "Pasta";
      }
    } 
    else if (modalType === 'file') {
      finalValue = finalValue.replace(/"/g, ''); // Remove aspas copiadas do Windows
      if (!finalTitle) {
        finalTitle = finalValue.split(/[\\/]/).pop() || "Arquivo";
      }
    }

    await addResource({
      id: crypto.randomUUID(),
      type: modalType,
      title: finalTitle,
      value: finalValue,
      createdAt: new Date()
    });

    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleModalSubmit();
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

  // Textos e ícones dinâmicos do modal
  const getModalConfig = () => {
    switch (modalType) {
      case 'link': 
        return { 
          icon: <LinkIcon size={24} className="text-blue-600"/>, bg: 'bg-blue-100', 
          title: 'Adicionar Link Web', label: 'URL do Link', 
          placeholder: 'ex: www.google.com', help: 'Cole o endereço da página.' 
        };
      case 'folder': 
        return { 
          icon: <Folder size={24} className="text-yellow-600"/>, bg: 'bg-yellow-100', 
          title: 'Adicionar Pasta Local', label: 'Caminho Completo', 
          placeholder: 'ex: C:\\Meus Projetos\\Imagens', help: 'Navegue até a pasta, clique na barra de endereço, copie e cole aqui.' 
        };
      case 'file': 
        return { 
          icon: <HardDrive size={24} className="text-gray-600"/>, bg: 'bg-gray-100', 
          title: 'Adicionar Arquivo Local', label: 'Caminho do Arquivo', 
          placeholder: 'ex: C:\\Documentos\\relatorio.pdf', help: 'Segure "Shift", clique com o botão direito no arquivo e escolha "Copiar como caminho".' 
        };
    }
  };

  const modalConfig = getModalConfig();

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-xl relative">
      
      {/* Header Fixo */}
      <div className="p-3 border-b border-gray-50 flex justify-between items-center bg-white shrink-0">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recursos & Arquivos</span>
        <span className="text-[10px] text-gray-300 font-mono">{task.resources?.length || 0}</span>
      </div>
      
      {/* Lista com Scroll */}
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
                {!isReadOnly && (
                    <button onClick={() => removeResource(res.id)} className="p-2 text-gray-300 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        ))}
      </div>

      {/* Footer de Ações */}
      {!isReadOnly && (
          <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-3 gap-2 shrink-0 z-10">
            <button onClick={() => openAddModal('link')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-colors gap-1 text-gray-600 shadow-sm">
                <LinkIcon size={16} /> <span className="text-[10px] font-bold">Link Web</span>
            </button>
            <button onClick={() => openAddModal('folder')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-yellow-300 hover:text-yellow-600 transition-colors gap-1 text-gray-600 shadow-sm">
                <Folder size={16} /> <span className="text-[10px] font-bold">Pasta</span>
            </button>
            <button onClick={() => openAddModal('file')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors gap-1 text-gray-600 shadow-sm">
                <HardDrive size={16} /> <span className="text-[10px] font-bold">Arquivo</span>
            </button>
          </div>
      )}

      {/* MODAL PERSONALIZADO DE ADIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${modalConfig.bg}`}>
                 {modalConfig.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{modalConfig.title}</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{modalConfig.label}</label>
                  <input 
                      autoFocus 
                      type="text" 
                      value={inputValue} 
                      onChange={e => setInputValue(e.target.value)} 
                      onKeyDown={handleKeyDown}
                      placeholder={modalConfig.placeholder} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-700"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight">{modalConfig.help}</p>
              </div>
              
              <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Nome de Exibição (Opcional)</label>
                  <input 
                      type="text" 
                      value={titleValue} 
                      onChange={e => setTitleValue(e.target.value)} 
                      onKeyDown={handleKeyDown}
                      placeholder="Deixe em branco para usar o original" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-700"
                  />
              </div>
            </div>

            <div className="flex gap-3 w-full mt-6">
              <button onClick={closeModal} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors">
                  Cancelar
              </button>
              <button onClick={handleModalSubmit} disabled={!inputValue.trim()} className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors disabled:opacity-50">
                  Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}