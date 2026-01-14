// src/components/About.tsx
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Brain, Target, Zap, Layers, 
  GraduationCap, Code, Map, ShieldAlert, Scale 
} from 'lucide-react';

export function About() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] p-4 md:p-8 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto space-y-12 pb-20">
        
        {/* Header com Voltar */}
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Sobre o Flow Manager</h1>
        </div>

        {/* Seção: A Motivação (Hero) */}
        <section className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 relative overflow-hidden">
          {/* Elemento decorativo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">
              <Brain size={14} /> Nossa Filosofia
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 leading-tight">
              Transformando <span className="text-blue-600">ansiedade</span> em <span className="text-purple-600">performance</span>.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
              O Flow Manager não nasceu apenas como código, mas como uma necessidade pessoal. 
              Diante da dificuldade de foco, da desorganização e da ansiedade cotidiana, 
              surgiu a necessidade de criar um sistema que não apenas listasse tarefas, mas que respeitasse 
              o estado mental de quem as executa, buscando performance sem sacrificar a saúde mental.
            </p>
          </div>
        </section>

        {/* Seção: Recursos da Aplicação */}
        <section>
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Zap className="text-yellow-500" /> O Ecossistema
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Target className="text-red-500" />}
              title="Foco Profundo"
              description="Cronômetro integrado com isolamento acústico (Brown Noise) e bloqueio visual para garantir imersão total na tarefa."
            />
            <FeatureCard 
              icon={<Layers className="text-blue-500" />}
              title="Hierarquia Visual"
              description="Quebre grandes projetos em passos pequenos. A visão recursiva permite entender o todo sem se perder nos detalhes."
            />
            <FeatureCard 
              icon={<Brain className="text-purple-500" />}
              title="Gestão de Stress"
              description="Monitoramento emocional integrado. Entenda como seu nível de tensão afeta sua produtividade ao longo do tempo."
            />
          </div>
        </section>

        {/* Seção: O Desenvolvedor */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
           <div className="absolute top-10 right-10 opacity-10 rotate-12">
              <Code size={120} />
           </div>

           <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
              <div className="w-24 h-24 bg-gray-700 rounded-2xl flex items-center justify-center shrink-0 border-2 border-gray-600 shadow-lg text-2xl font-bold">
                 RG
              </div>
              
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-1">Raphael Gonçalves de Campos</h3>
                <p className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-widest flex items-center gap-2">
                   Criador & Engenheiro
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                   <div className="flex items-center gap-3 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                      <Map className="text-green-400 shrink-0" size={20} />
                      <div>
                        <p className="text-xs text-gray-400">Profissão</p>
                        <p className="font-semibold text-sm">Eng. Cartógrafo e Agrimensor</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                      <GraduationCap className="text-yellow-400 shrink-0" size={20} />
                      <div>
                        <p className="text-xs text-gray-400">Título Acadêmico</p>
                        <p className="font-semibold text-sm">Dr. em Ciências Geodésicas</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-4 text-gray-300 leading-relaxed text-sm md:text-base border-l-2 border-gray-600 pl-4">
                  <p>
                    Minha jornada combina a precisão analítica da engenharia com a criatividade do desenvolvimento de software.
                  </p>
                  <p>
                    Sou um entusiasta no desenvolvimento de aplicações desde 2014. Este projeto é a materialização da minha busca pessoal por ferramentas que unam técnica apurada e utilidade real para o dia a dia.
                  </p>
                </div>
              </div>
           </div>
        </section>

        {/* Seção: Licença e Responsabilidade */}
        <section className="border-t border-gray-200 pt-10 mt-10">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Scale className="text-gray-400" /> Termos de Uso e Licença
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-2 text-orange-700 font-bold mb-2">
                        <ShieldAlert size={18} /> Isenção de Responsabilidade
                    </div>
                    <p className="text-sm text-orange-800/80 leading-relaxed text-justify">
                        Este software é fornecido "como está", sem garantias de qualquer tipo, expressas ou implícitas. 
                        O desenvolvedor <strong>não se responsabiliza</strong> por perda de dados, falhas de funcionamento, 
                        ou quaisquer danos diretos ou indiretos resultantes do uso desta aplicação. Use por sua conta e risco.
                    </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-700 font-bold mb-2">
                        <Scale size={18} /> Licença de Uso
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">
                        Este é um projeto pessoal de código aberto para fins educacionais e de uso próprio. 
                        <strong>É estritamente proibido o uso comercial</strong>, venda, redistribuição ou sublicenciamento 
                        deste software ou de partes do seu código sem autorização expressa do autor.
                    </p>
                </div>
            </div>
        </section>

        {/* Footer */}
        <div className="text-center pt-8">
           <p className="text-xs text-gray-300">
             © {new Date().getFullYear()} Raphael Gonçalves de Campos.
           </p>
        </div>

      </div>
    </div>
  );
}

// Componente Auxiliar para os Cards
function FeatureCard({ icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-gray-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-gray-700">
        {icon}
      </div>
      <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
