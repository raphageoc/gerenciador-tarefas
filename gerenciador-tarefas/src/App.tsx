// src/App.tsx
import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { TaskList } from './components/TaskList';
import { FocusSession } from './components/FocusSession';
import { Dashboard } from './components/Dashboard';
import { About } from './components/About';
import { CloudGate } from './components/CloudGate'; // <-- IMPORTADO
import { DataManagementModal } from './components/DataManagementModal'; // <-- IMPORTADO
import { Brain, LayoutGrid, CheckSquare, Info, LogOut, Cloud } from 'lucide-react';

function NavLink({ to, icon: Icon, label }: { to: string, icon: any, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
    >
      <Icon size={18} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

function LayoutFrame({ children }: { children: React.ReactNode }) {
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  // Trava para avisar o usuário ao tentar fechar a aba nativamente no navegador
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Você salvou seus dados na nuvem antes de sair?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFDFD] relative font-sans text-gray-800">
      
      {/* Header Fixo no Topo */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-sm bg-white/80">
        <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition group">
            <div className="bg-black text-white p-2 rounded-lg group-hover:scale-105 transition-transform duration-300">
                <Brain size={20} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight hidden md:block">Flow Manager</h1>
            </Link>
            <nav className="flex items-center gap-2">
                <NavLink to="/" icon={CheckSquare} label="Projetos" />
                <NavLink to="/dashboard" icon={LayoutGrid} label="Dashboard" />
                <NavLink to="/about" icon={Info} label="Sobre" />
            </nav>
        </div>

        {/* NOVO: Botão de Sair / Salvar */}
        <div>
          <button 
            onClick={() => setIsDataModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors font-medium text-sm border border-blue-100"
          >
            <Cloud size={16} />
            <span className="hidden sm:inline">Salvar</span>
            <LogOut size={16} className="ml-1 opacity-70" />
          </button>
        </div>
      </header>
      
      {/* Área Principal */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8">
        {children}
      </main>

      {/* MODAL GLOBAL DE DADOS */}
      <DataManagementModal 
        isOpen={isDataModalOpen} 
        onClose={() => setIsDataModalOpen(false)} 
      />
    </div>
  );
}

function App() {
  const [hasPassedGate, setHasPassedGate] = useState(false);

  return (
    // HashRouter é usado aqui para garantir compatibilidade com GitHub Pages
    <HashRouter>
      {!hasPassedGate ? (
        <CloudGate onUnlock={() => setHasPassedGate(true)} />
      ) : (
        <LayoutFrame>
          <Routes>
            <Route path="/" element={<TaskList />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/about" element={<About />} />
            <Route path="/focus/:taskId" element={<FocusSession />} />
          </Routes>
        </LayoutFrame>
      )}
    </HashRouter>
  );
}

export default App;