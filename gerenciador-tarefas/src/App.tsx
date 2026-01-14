// src/App.tsx
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { TaskList } from './components/TaskList';
import { FocusSession } from './components/FocusSession';
import { Dashboard } from './components/Dashboard';
import { About } from './components/About';
import { Brain, LayoutGrid, CheckSquare, Info } from 'lucide-react';

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
      </header>
      
      {/* Área Principal */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    // HashRouter é usado aqui para garantir compatibilidade com GitHub Pages
    <HashRouter>
      <LayoutFrame>
        <Routes>
          <Route path="/" element={<TaskList />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/focus/:taskId" element={<FocusSession />} />
        </Routes>
      </LayoutFrame>
    </HashRouter>
  );
}

export default App;
