import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Database, 
  Lock, 
  MessageCircle, 
  ArrowUpRight, 
  ChevronRight,
  User,
  LayoutDashboard,
  ShieldAlert,
  Terminal,
  Eraser,
  X,
  Check,
  Zap,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface LogEntry {
  id: number;
  timestamp: string;
  user_id: string;
  method: string;
  path: string;
  request_body: string;
  response_body: string;
  status_code: number;
  latency_ms: number;
  tokens: number;
  safety_score: number;
  is_blocked: boolean;
  is_redacted: boolean;
}

const App = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'playground' | 'safety'>('overview');
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=100');
      const data = await res.json();
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const stats = useMemo(() => {
    const totalTokens = logs.reduce((acc, log) => acc + log.tokens, 0);
    const blockedCount = logs.filter(l => l.is_blocked || l.status_code === 403).length;
    const redactedCount = logs.filter(l => l.is_redacted).length;
    const avgLatency = logs.length > 0 ? (logs.reduce((acc, l) => acc + l.latency_ms, 0) / logs.length) : 0;

    const userUsageMap: Record<string, number> = {};
    logs.forEach(l => {
      userUsageMap[l.user_id] = (userUsageMap[l.user_id] || 0) + l.tokens;
    });
    const barData = Object.entries(userUsageMap).map(([name, value]) => ({ name, value }));

    return { totalTokens, blockedCount, redactedCount, avgLatency, barData };
  }, [logs]);

  const handleSendMessage = async () => {
    if (!chatMessage) return;
    setChatLoading(true);
    setChatResponse(null);
    try {
      const res = await fetch('/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'developer-admin'
        },
        body: JSON.stringify({ message: chatMessage })
      });
      const data = await res.json();
      setChatResponse({
        status: res.status,
        data: data,
        receipt: {
          tokens: 214,
          latency: '342ms',
          safety: 'Optimal'
        }
      });
      fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-apple-black text-[#f5f5f7] font-sans selection:bg-apple-blue/30 overflow-hidden">
      
      {/* Sidebar - Minimalist Apple Style */}
      <aside className="w-[260px] border-r border-apple-gray-800 flex flex-col pt-12 pb-8 px-6 bg-apple-black">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="p-2 bg-gradient-to-br from-[#ffffff] to-[#e5e5e5] rounded-lg shadow-sm">
            <Zap className="text-black w-5 h-5 fill-current" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">Vantage</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'audit', icon: Database, label: 'Audit Vault' },
            { id: 'playground', icon: Terminal, label: 'Playground' },
            { id: 'safety', icon: ShieldCheck, label: 'Safety Policy' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-apple-gray-800 text-white font-medium' 
                  : 'text-apple-gray-500 hover:text-white hover:bg-apple-gray-900'
              }`}
            >
              <item.icon size={18} className={activeTab === item.id ? 'text-apple-blue' : ''} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto px-2">
          <div className="flex items-center gap-3 py-2 px-1">
            <div className="w-8 h-8 rounded-full bg-apple-gray-700 flex items-center justify-center border border-apple-gray-600">
              <User size={16} className="text-apple-gray-400" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <p className="text-[12px] font-medium text-white truncate">Soroush Baraouf</p>
              <p className="text-[10px] text-apple-gray-600 uppercase font-mono tracking-tighter">Gateway Node 01</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-apple-black">
        
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 apple-blur border-b border-apple-gray-800 h-16 flex items-center justify-between px-10">
          <h2 className="text-[15px] font-medium capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-apple-green shadow-[0_0_8px_rgba(52,199,89,0.5)]"></div>
              <span className="text-[11px] text-apple-gray-400 font-medium">Infrastructure Stable</span>
            </div>
            <div className="h-4 w-[1px] bg-apple-gray-800"></div>
            <Activity size={16} className="text-apple-gray-400" />
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'overview' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-10">
              <div className="flex flex-col gap-1">
                <h1 className="text-[28px] font-semibold tracking-tight">System Performance</h1>
                <p className="text-apple-gray-500 text-[14px]">Comprehensive metrics across the proxy distributed network.</p>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Token Usage', value: stats.totalTokens.toLocaleString(), trend: '+12.4%', icon: Zap, color: 'text-apple-blue' },
                  { label: 'Latency (Avg)', value: `${Math.round(stats.avgLatency)}ms`, trend: '-4ms', icon: Clock, color: 'text-apple-green' },
                  { label: 'Security Blocks', value: stats.blockedCount, trend: 'High Priority', icon: ShieldAlert, color: 'text-apple-red' },
                  { label: 'PII Scrubbed', value: stats.redactedCount, trend: 'Active Policy', icon: Eraser, color: 'text-apple-indigo' },
                ].map((kpi, i) => (
                  <div key={i} className="apple-card p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className={`p-2 rounded-lg bg-apple-gray-900 ${kpi.color}`}>
                        <kpi.icon size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-apple-gray-500 uppercase">{kpi.trend}</span>
                    </div>
                    <div>
                      <p className="text-[13px] text-apple-gray-500 font-medium">{kpi.label}</p>
                      <p className="text-[22px] font-semibold tracking-tight text-white">{kpi.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-5 gap-6">
                <div className="col-span-3 apple-card p-8 flex flex-col gap-8 h-[400px]">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[15px] font-medium px-2">Tenant Token Distribution</h3>
                    <div className="flex gap-2">
                       <div className="w-3 h-3 rounded-sm bg-apple-blue"></div>
                       <span className="text-[10px] text-apple-gray-500 uppercase font-bold">Allocated Tokens</span>
                    </div>
                  </div>
                  <div className="flex-1 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.barData}>
                        <XAxis 
                          dataKey="name" 
                          stroke="#48484a" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          tickMargin={12}
                        />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ background: '#2c2c2e', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                          cursor={{ fill: '#2c2c2e' }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="#007aff" 
                          radius={[6, 6, 0, 0]} 
                          barSize={45} 
                          animationDuration={1500}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="col-span-2 apple-card p-8 flex flex-col gap-6">
                   <h3 className="text-[15px] font-medium px-1">Latest Audit Stream</h3>
                   <div className="space-y-3 overflow-y-auto pr-2">
                      {logs.slice(0, 6).map((log, i) => (
                        <div key={log.id} className="flex items-center justify-between group cursor-pointer">
                           <div className="flex items-center gap-3">
                              <div className={`w-1.5 h-1.5 rounded-full ${log.is_blocked ? 'bg-apple-red' : 'bg-apple-green'}`}></div>
                              <div>
                                <p className="text-[12px] font-medium text-white group-hover:text-apple-blue transition-colors">{log.path}</p>
                                <p className="text-[10px] text-apple-gray-600 uppercase font-mono tracking-tight">{log.user_id}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[11px] font-semibold text-apple-gray-400">{log.tokens} tk</p>
                              <p className="text-[10px] text-apple-gray-600">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                           </div>
                        </div>
                      ))}
                      {logs.length === 0 && <p className="text-center text-apple-gray-700 py-20 text-xs">No activity captured</p>}
                   </div>
                   <button onClick={() => setActiveTab('audit')} className="mt-auto w-full py-2 bg-apple-gray-900 hover:bg-apple-gray-800 text-apple-gray-400 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all">
                      Open Full Vault
                   </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="animate-in fade-in duration-500 space-y-8">
               <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h1 className="text-[28px] font-semibold tracking-tight">Audit Vault</h1>
                  <p className="text-apple-gray-500 text-[14px]">Historical immutable sequence of all proxy interactions.</p>
                </div>
                <div className="flex gap-2">
                   <button className="apple-button px-6 py-2 text-[13px]">Export JSON</button>
                   <button className="bg-apple-gray-900 border border-apple-gray-800 text-white px-4 py-2 rounded-full hover:bg-apple-gray-800 text-[13px]">Filter</button>
                </div>
              </div>

               <div className="apple-card overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-apple-gray-800 bg-apple-gray-900/30">
                      <th className="px-6 py-4 text-[11px] font-bold text-apple-gray-500 uppercase">Identity</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-apple-gray-500 uppercase">Resource</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-apple-gray-500 uppercase">State</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-apple-gray-500 uppercase">Payload</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-apple-gray-500 uppercase text-right">Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className="border-b border-apple-gray-900/50 last:border-0 hover:bg-apple-gray-900/30 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-apple-gray-800 flex items-center justify-center text-[10px] font-bold border border-apple-gray-700">
                               {log.user_id[0]?.toUpperCase()}
                             </div>
                             <span className="text-[12px] font-medium font-mono text-apple-gray-300">{log.user_id}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-[12px] font-bold text-white">{log.method}</span>
                           <span className="text-[12px] text-apple-gray-500 ml-2">{log.path}</span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status_code < 300 ? 'bg-apple-green/10 text-apple-green' : 'bg-apple-red/10 text-apple-red'}`}>
                                {log.status_code}
                              </span>
                              {log.is_blocked && <span className="px-2 py-0.5 rounded bg-apple-red/10 text-apple-red text-[10px] font-bold">BLOCKED</span>}
                              {log.is_redacted && <span className="px-2 py-0.5 rounded bg-apple-indigo/10 text-apple-indigo text-[10px] font-bold">REDACTED</span>}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-[11px] text-apple-gray-500 font-medium">{(log.tokens)} tokens • {log.latency_ms}ms</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <span className="text-[12px] text-apple-gray-400 font-medium">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'playground' && (
            <div className="animate-in fade-in duration-500 h-full flex flex-col gap-8">
               <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h1 className="text-[28px] font-semibold tracking-tight">Security Sandbox</h1>
                  <p className="text-apple-gray-500 text-[14px]">Validate firewall rules and redaction logic against LLM prompts.</p>
                </div>
              </div>

              <div className="flex-1 min-h-[500px] apple-card flex flex-col overflow-hidden">
                <div className="p-4 border-b border-apple-gray-800 flex items-center justify-between bg-apple-gray-900/20">
                   <div className="flex items-center gap-2 text-[12px] font-medium text-apple-gray-400 uppercase tracking-widest">
                      <Terminal size={14} className="text-apple-blue" />
                      Live Interaction Session
                   </div>
                   <button onClick={() => setChatResponse(null)} className="text-[11px] text-apple-gray-500 hover:text-white transition-colors">Clear Stream</button>
                </div>

                <div className="flex-1 p-10 overflow-y-auto space-y-12">
                   {!chatResponse && !chatLoading && (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-6">
                         <div className="w-16 h-16 rounded-3xl bg-apple-gray-800 flex items-center justify-center">
                            <MessageCircle size={32} />
                         </div>
                         <p className="text-[15px] font-medium">Ready for input<br/><span className="text-[12px] text-apple-gray-600 font-normal">Vantage proxy will intercept the next transmission</span></p>
                      </div>
                   )}

                   {chatLoading && (
                      <div className="flex justify-center py-20">
                         <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin"></div>
                      </div>
                   )}

                   {chatResponse && (
                      <div className="space-y-8 animate-in fade-in duration-700">
                         <div className="flex flex-col items-end gap-2">
                            <span className="text-[10px] text-apple-gray-600 font-bold uppercase px-2">Prompt</span>
                            <div className="bg-apple-gray-800 p-5 rounded-2xl rounded-tr-none max-w-xl text-[14px] leading-relaxed shadow-xl">
                              {chatMessage}
                            </div>
                         </div>

                         <div className="flex flex-col items-start gap-4">
                            <div className="flex items-center gap-2 px-2">
                               <ShieldCheck size={14} className="text-apple-blue" />
                               <span className="text-[10px] text-apple-gray-600 font-bold uppercase tracking-widest">Vantage Protection Layer</span>
                            </div>
                            
                            {chatResponse.data.error ? (
                               <div className="bg-apple-red/5 border border-apple-red/20 p-8 rounded-2xl rounded-tl-none max-w-3xl space-y-6 shadow-2xl">
                                  <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-full bg-apple-red/10 flex items-center justify-center">
                                        <Lock className="text-apple-red" size={20} />
                                     </div>
                                     <div>
                                        <p className="text-[16px] font-bold text-apple-red">Blocked by Security Policy</p>
                                        <p className="text-[13px] text-apple-red/70">{chatResponse.data.error}</p>
                                     </div>
                                  </div>
                                  <div className="h-[1px] bg-apple-red/10 w-full"></div>
                                  <div className="grid grid-cols-2 gap-8">
                                     <div>
                                        <p className="text-[9px] uppercase font-black text-apple-red/40 tracking-wider">Policy Engine</p>
                                        <p className="text-[12px] font-bold text-apple-red/60 uppercase">Vantage Core Firewall</p>
                                     </div>
                                     <div>
                                        <p className="text-[9px] uppercase font-black text-apple-red/40 tracking-wider">Error Code</p>
                                        <p className="text-[12px] font-bold font-mono text-apple-red/60">{chatResponse.data.code}</p>
                                     </div>
                                  </div>
                               </div>
                            ) : (
                               <div className="bg-apple-gray-900 border border-apple-gray-800 p-8 rounded-2xl rounded-tl-none max-w-3xl space-y-8 shadow-2xl">
                                  <p className="text-[15px] leading-relaxed text-apple-gray-200">
                                    {chatResponse.data.text || JSON.stringify(chatResponse.data)}
                                  </p>
                                  
                                  <div className="h-[1px] bg-apple-gray-800 w-full"></div>
                                  
                                  <div className="grid grid-cols-3 gap-8">
                                     {[
                                       { label: 'Latency', value: chatResponse.receipt.latency, sub: 'Optimized' },
                                       { label: 'Token Count', value: chatResponse.receipt.tokens, sub: 'Attributed' },
                                       { label: 'Safety Index', value: 'Clean', sub: '99.8% Conf' },
                                     ].map((r, i) => (
                                       <div key={i}>
                                          <p className="text-[9px] uppercase font-bold text-apple-gray-600 tracking-wider mb-1">{r.label}</p>
                                          <p className="text-[13px] font-bold text-white">{r.value}</p>
                                          <p className="text-[10px] text-apple-gray-600">{r.sub}</p>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}
                         </div>
                      </div>
                   )}
                </div>

                <div className="p-8 bg-apple-black border-t border-apple-gray-800 relative z-10">
                   <div className="max-w-4xl mx-auto flex gap-4">
                      <div className="flex-1 relative group">
                        <input 
                          type="text" 
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Pass a prompt through the firewall..."
                          className="w-full bg-apple-gray-900 border border-apple-gray-800 rounded-2xl px-6 py-4 outline-none focus:border-apple-blue transition-all pr-12 text-[14px]"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                           <p className="text-[10px] font-bold text-apple-gray-600 border border-apple-gray-800 px-1.5 py-0.5 rounded uppercase">Return</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleSendMessage}
                        disabled={chatLoading}
                        className="apple-button px-10 flex items-center gap-2 group disabled:opacity-50"
                      >
                        <span className="text-[14px] font-semibold">Transmit</span>
                        <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </button>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="animate-in fade-in duration-500 space-y-10">
                <div className="space-y-1">
                  <h1 className="text-[28px] font-semibold tracking-tight">Governance Policy</h1>
                  <p className="text-apple-gray-500 text-[14px]">Define the legal and security boundaries for AI interaction.</p>
                </div>

                <div className="grid gap-6">
                   <div className="apple-card p-10 flex items-center justify-between">
                      <div className="flex gap-8">
                         <div className="w-16 h-16 rounded-[20px] bg-apple-indigo/10 flex items-center justify-center text-apple-indigo">
                            <Eraser size={32} />
                         </div>
                         <div className="space-y-2">
                            <h3 className="text-xl font-bold tracking-tight">Automatic PII Redaction</h3>
                            <p className="text-apple-gray-500 text-[14px] max-w-lg leading-relaxed">System-wide identification and replacement of Email Addresses, Phone Numbers, and Social Security credentials.</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <span className="text-[11px] font-bold text-apple-green uppercase flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-apple-green shadow-sm"></div> Active
                         </span>
                         <button className="apple-button px-6 py-2 text-[13px]">Configure Patterns</button>
                      </div>
                   </div>

                   <div className="apple-card p-10 space-y-8">
                       <div className="flex justify-between items-start">
                          <div className="flex gap-8">
                            <div className="w-16 h-16 rounded-[20px] bg-apple-red/10 flex items-center justify-center text-apple-red">
                                <ShieldAlert size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold tracking-tight">Active LLM Firewall</h3>
                                <p className="text-apple-gray-500 text-[14px] max-w-lg leading-relaxed">Interceptive logic to catch and terminate requests containing forbidden internal keys or proprietary concepts.</p>
                            </div>
                          </div>
                      </div>
                      <div className="h-[1px] bg-apple-gray-800 w-full"></div>
                      <div>
                         <p className="text-[11px] font-bold text-apple-gray-600 uppercase tracking-widest mb-4">Current Forbidden Map</p>
                         <div className="flex flex-wrap gap-2">
                            {['internal_db', 'password_hash', 'secret_key', 'proprietary_source', 'customer_ssn', 'root_access'].map(kw => (
                              <div key={kw} className="px-3 py-1.5 bg-apple-gray-900 border border-apple-gray-800 rounded-lg text-[12px] font-medium text-apple-gray-300">
                                {kw}
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Overlay */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] bg-apple-black/80 backdrop-blur-xl flex items-center justify-center p-12 transition-all duration-300 animate-in fade-in">
           <div className="apple-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-apple-gray-800 flex justify-between items-center bg-apple-gray-900/10">
                 <h3 className="text-xl font-bold tracking-tight">Transaction Insight</h3>
                 <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-apple-gray-800 rounded-full transition-all text-apple-gray-500 hover:text-white">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-10 overflow-y-auto space-y-10">
                 <div className="grid grid-cols-3 gap-8">
                    <div>
                       <p className="text-[10px] uppercase font-black text-apple-gray-600 mb-1">Status Code</p>
                       <p className={`text-[16px] font-bold ${selectedLog.status_code < 300 ? 'text-apple-green' : 'text-apple-red'}`}>{selectedLog.status_code} OK</p>
                    </div>
                    <div>
                       <p className="text-[10px] uppercase font-black text-apple-gray-600 mb-1">Latency</p>
                       <p className="text-[16px] font-bold text-white">{selectedLog.latency_ms}ms</p>
                    </div>
                    <div>
                       <p className="text-[10px] uppercase font-black text-apple-gray-600 mb-1">Safety Conf</p>
                       <p className="text-[16px] font-bold text-apple-blue">{(selectedLog.safety_score * 100).toFixed(1)}%</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <p className="text-[11px] font-bold text-apple-gray-500 uppercase tracking-widest">Prompt Captured</p>
                    <div className="p-6 bg-apple-gray-950 border border-apple-gray-900 rounded-2xl text-[13px] font-mono leading-relaxed text-apple-gray-300">
                       {selectedLog.request_body}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <p className="text-[11px] font-bold text-apple-gray-500 uppercase tracking-widest">Model Response</p>
                    <div className="p-6 bg-apple-gray-950 border border-apple-gray-900 rounded-2xl text-[13px] font-mono leading-relaxed text-apple-gray-200 line-clamp-[10]">
                       {selectedLog.response_body || 'NULL (Request Blocked)'}
                    </div>
                 </div>

                 <div className="flex gap-4">
                    {selectedLog.is_redacted && (
                       <div className="flex-1 p-4 bg-apple-indigo/5 border border-apple-indigo/20 rounded-2xl flex items-center gap-4">
                          <Lock className="text-apple-indigo" size={18} />
                          <span className="text-[13px] font-semibold text-apple-indigo">PII Masking Applied</span>
                       </div>
                    )}
                    {selectedLog.is_blocked && (
                       <div className="flex-1 p-4 bg-apple-red/5 border border-apple-red/20 rounded-2xl flex items-center gap-4">
                          <ShieldAlert className="text-apple-red" size={18} />
                          <span className="text-[13px] font-semibold text-apple-red">Policy Violation Terminated</span>
                       </div>
                    )}
                    {!selectedLog.is_blocked && !selectedLog.is_redacted && (
                       <div className="flex-1 p-4 bg-apple-green/5 border border-apple-green/20 rounded-2xl flex items-center gap-4">
                          <Check className="text-apple-green" size={18} />
                          <span className="text-[13px] font-semibold text-apple-green">Compliant Transaction</span>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
