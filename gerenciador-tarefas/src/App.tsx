// src/App.tsx
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { TaskList } from './components/TaskList';
import { FocusSession } from './components/FocusSession';
import { Dashboard } from './components/Dashboard';
import { About } from './components/About';
import { CloudGate } from './components/CloudGate'; 
import { DataManagementModal } from './components/DataManagementModal'; 
import { Brain, LayoutGrid, CheckSquare, Info, Cloud, Eye } from 'lucide-react';
import { db } from './db'; // <-- Precisamos importar o banco para checar se há tarefas rodando

export const ReadOnlyContext = createContext(false);

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
  const isReadOnly = useContext(ReadOnlyContext);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Se a variável pular checagem for verdadeira, deixa fechar/recarregar direto!
      if ((window as any).skipUnloadCheck) return; 
      
      e.preventDefault();
      e.returnValue = 'Você salvou seus dados na nuvem antes de sair?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFDFD] relative font-sans text-gray-800">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-sm bg-white/80">
        <div className="flex items-center gap-4 md:gap-8">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition group">
                <div className="bg-black text-white p-2 rounded-lg group-hover:scale-105 transition-transform duration-300">
                    <Brain size={20} />
                </div>
                <h1 className="text-lg font-semibold tracking-tight hidden md:block">Flow Manager</h1>
            </Link>
            <nav className="flex items-center gap-2 hidden sm:flex">
                <NavLink to="/" icon={CheckSquare} label="Projetos" />
                <NavLink to="/dashboard" icon={LayoutGrid} label="Dashboard" />
                <NavLink to="/about" icon={Info} label="Sobre" />
            </nav>
        </div>

        <div className="flex items-center gap-3">
          {isReadOnly && (
            <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-orange-200">
              <Eye size={14} /> Somente Leitura
            </div>
          )}

          {!isReadOnly && (
            <button 
              onClick={() => setIsDataModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors font-medium text-sm border border-blue-100"
            >
              <Cloud size={16} />
              <span className="hidden sm:inline">Backup</span>
            </button>
          )}
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8">
        {children}
      </main>

      <DataManagementModal isOpen={isDataModalOpen} onClose={() => setIsDataModalOpen(false)} />
    </div>
  );
}

function App() {
  const [hasPassedGate, setHasPassedGate] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const handleUnlock = (readOnlyMode: boolean) => {
    setIsReadOnly(readOnlyMode);
    setHasPassedGate(true);
  };

  // ====================================================================
  // CONTROLE DE INATIVIDADE (AUTO-LOGOUT)
  // ====================================================================
  const checkIdleLogout = useCallback(async () => {
    // 1. Verifica se não está no modo de leitura (pois leitura não precisa deslogar)
    // 2. E verifica se ele já passou do portão
    if (isReadOnly || !hasPassedGate) return;

    try {
      // Conta quantas tarefas estão rodando o cronômetro
      const activeTasksCount = await db.tasks.where('status').equals('in_progress').count();
      
      // Se NENHUMA tarefa estiver rodando, nós expulsamos o usuário por inatividade
      if (activeTasksCount === 0) {
        console.log("Inatividade detectada. Sessão encerrada.");
        setHasPassedGate(false); // Expulsa para a tela do Google Login
      }
    } catch (e) {
      console.error(e);
    }
  }, [isReadOnly, hasPassedGate]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    
    // Tempo limite: 15 Minutos (15 * 60 * 1000 milissegundos)
    const IDLE_TIMEOUT_MS = 1 * 60 * 1000;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      // Agenda a checagem para daqui a 15 minutos
      idleTimer = setTimeout(checkIdleLogout, IDLE_TIMEOUT_MS);
    };

    // Fica de olho se o usuário mexe o mouse, clica, digita ou rola a tela
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    
    // Inicia a contagem inicial
    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
    };
  }, [checkIdleLogout]);
  // ====================================================================

  return (
    <HashRouter>
      <ReadOnlyContext.Provider value={isReadOnly}>
        {!hasPassedGate ? (
          <CloudGate onUnlock={handleUnlock} />
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
      </ReadOnlyContext.Provider>
    </HashRouter>
  );
}

export default App;