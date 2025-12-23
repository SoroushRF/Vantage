import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Shield, 
  Database, 
  Lock, 
  MessageSquare, 
  AlertTriangle, 
  User, 
  TrendingUp,
  Cpu,
  Eye,
  Settings,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'playground' | 'settings'>('dashboard');
  const [redactionEnabled, setRedactionEnabled] = useState(true);
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
      console.error('Failed to fetch logs', err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage) return;
    setChatLoading(true);
    setChatResponse(null);
    try {
      const res = await fetch('/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'demo-user-1'
        },
        body: JSON.stringify({ message: chatMessage })
      });
      const data = await res.json();
      setChatResponse({
        status: res.status,
        data: data,
        receipt: {
          tokens: 120, // In real app, we'd get this from response or wait for audit
          latency: '450ms',
          safety: 'Safe'
        }
      });
      fetchLogs();
    } catch (err) {
      console.error('Chat failed', err);
    } finally {
      setChatLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalTokens = logs.reduce((acc, log) => acc + log.tokens, 0);
    const blockedCount = logs.filter(l => l.is_blocked || l.status_code === 403).length;
    const redactedCount = logs.filter(l => l.is_redacted).length;
    const avgSafety = logs.length > 0 ? (logs.reduce((acc, l) => acc + l.safety_score, 0) / logs.length) * 100 : 0;

    const userUsageMap: Record<string, number> = {};
    logs.forEach(l => {
      userUsageMap[l.user_id] = (userUsageMap[l.user_id] || 0) + l.tokens;
    });
    const userUsageData = Object.entries(userUsageMap).map(([name, value]) => ({ name, value }));

    return { totalTokens, blockedCount, redactedCount, avgSafety, userUsageData };
  }, [logs]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-dark text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 glass flex flex-col items-center py-8 px-4 gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
            <Shield className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-white">Vantage</h1>
        </div>

        <nav className="flex flex-col w-full gap-2">
          {[
            { id: 'dashboard', icon: Activity, label: 'Control Center' },
            { id: 'logs', icon: Database, label: 'Audit Vault' },
            { id: 'playground', icon: MessageSquare, label: 'AI Playground' },
            { id: 'settings', icon: Settings, label: 'Governance' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-brand/10 text-brand font-medium' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto w-full p-4 glass rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-slate-400 font-medium">Auto-Redact</span>
            <button 
              onClick={() => setRedactionEnabled(!redactionEnabled)}
              className={`w-10 h-5 rounded-full relative transition-colors ${redactionEnabled ? 'bg-brand' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${redactionEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Proxy Pipeline Active
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex justify-between items-end">
              <div>
                <p className="text-slate-400 font-medium">Enterprise Intelligence</p>
                <h2 className="text-3xl font-display font-bold text-white">System Observability</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Node: Vantage-US-East-1</p>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Tokens', value: stats.totalTokens.toLocaleString(), icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                { label: 'Blocked Threats', value: stats.blockedCount, icon: Lock, color: 'text-red-400', bg: 'bg-red-400/10' },
                { label: 'PII Redactions', value: stats.redactedCount, icon: Eye, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                { label: 'Safety Index', value: `${stats.avgSafety.toFixed(1)}%`, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
              ].map((kpi, i) => (
                <div key={i} className="glass p-6 rounded-3xl flex flex-col gap-4">
                  <div className={`w-12 h-12 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center`}>
                    <kpi.icon size={24} />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm font-medium">{kpi.label}</p>
                    <p className="text-2xl font-display font-bold text-white">{kpi.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
              <div className="glass p-8 rounded-3xl flex flex-col gap-6">
                <h3 className="text-lg font-bold font-display">Token Usage by UserID</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.userUsageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}
                        cursor={{ fill: '#334155', opacity: 0.4 }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                        {stats.userUsageData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass p-8 rounded-3xl flex flex-col gap-6 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold font-display">Recent Audit Trail</h3>
                  <button onClick={() => setActiveTab('logs')} className="text-brand text-sm font-medium hover:underline">View All</button>
                </div>
                <div className="flex flex-col gap-3 overflow-y-auto">
                  {logs.slice(0, 5).map(log => (
                    <div key={log.id} className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${log.is_blocked ? 'bg-red-500' : 'bg-green-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-slate-200">{log.path}</p>
                          <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-slate-400">ID: {log.user_id}</p>
                        <p className="text-xs text-slate-500">{log.tokens} tokens</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <h2 className="text-3xl font-display font-bold text-white">Audit Vault</h2>
            <div className="glass rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/50 border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Timestamp</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">User ID</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Safety</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Tokens</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {logs.map(log => (
                      <tr 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className={`hover:bg-slate-800/30 cursor-pointer transition-colors ${log.safety_score < 0.5 ? 'bg-red-500/5' : ''}`}
                      >
                        <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-300 whitespace-nowrap">{log.user_id}</td>
                        <td className="px-6 py-4 font-medium text-slate-200 whitespace-nowrap">{log.method} {log.path}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.status_code < 300 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {log.status_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${log.safety_score > 0.8 ? 'bg-green-500' : log.safety_score > 0.4 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${log.safety_score * 100}%` }} />
                            </div>
                            <span className="text-xs font-medium text-slate-400">{(log.safety_score * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300 font-mono">{log.tokens}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {log.is_redacted && <Lock size={14} className="text-purple-400" title="PII Redacted" />}
                            {log.is_blocked && <AlertTriangle size={14} className="text-red-400" title="Security Block" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'playground' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6 h-full animate-in fade-in slide-in-from-right-4">
            <h2 className="text-3xl font-display font-bold text-white">Vantage AI Playground</h2>
            <div className="flex-1 flex flex-col glass rounded-3xl overflow-hidden min-h-[500px]">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="text-brand w-5 h-5" />
                  <span className="font-bold">Model Path: /v1/chat</span>
                </div>
                <div className="px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-bold border border-brand/20">
                  Proxied & Audited
                </div>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
                {!chatResponse && !chatLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 opacity-50">
                    <MessageSquare size={64} />
                    <p className="text-lg">Enter a prompt to test your security rules</p>
                  </div>
                )}
                
                {chatMessage && chatLoading && (
                  <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 border-dashed animate-pulse">
                    Thinking... (Vantage is intercepting)
                  </div>
                )}

                {chatResponse && (
                  <>
                    <div className="bg-slate-700/30 p-6 rounded-3xl self-end max-w-[80%]">
                      <p className="text-slate-200">{chatMessage}</p>
                    </div>
                    {chatResponse.data.error ? (
                       <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl self-start max-w-[80%] flex items-start gap-4">
                        <AlertCircle className="text-red-500 shrink-0 mt-1" />
                        <div>
                          <p className="text-red-400 font-bold mb-1">Vantage Blocked Request</p>
                          <p className="text-red-300 font-medium">{chatResponse.data.error}</p>
                          <p className="text-xs text-red-500/70 mt-4 uppercase font-bold tracking-widest">Code: {chatResponse.data.code}</p>
                        </div>
                       </div>
                    ) : (
                      <div className="bg-brand/10 border border-brand/20 p-6 rounded-3xl self-start max-w-[80%] flex flex-col gap-4">
                        <CheckCircle2 className="text-brand w-6 h-6" />
                        <p className="text-slate-200">{chatResponse.data.text || JSON.stringify(chatResponse.data)}</p>
                        
                        <div className="mt-4 pt-4 border-t border-brand/20 grid grid-cols-3 gap-4">
                           <div>
                             <p className="text-[10px] uppercase text-brand/60 font-black">Tokens</p>
                             <p className="text-sm font-bold">{chatResponse.receipt.tokens}</p>
                           </div>
                           <div>
                             <p className="text-[10px] uppercase text-brand/60 font-black">Latency</p>
                             <p className="text-sm font-bold">{chatResponse.receipt.latency}</p>
                           </div>
                           <div>
                             <p className="text-[10px] uppercase text-brand/60 font-black">Safety</p>
                             <p className="text-sm font-bold text-green-400">{chatResponse.receipt.safety}</p>
                           </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-6 bg-slate-800/30">
                <div className="relative group">
                   <div className="absolute -inset-0.5 bg-gradient-to-r from-brand to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                  <div className="relative flex gap-4">
                    <input 
                      type="text" 
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Try a forbidden keyword like 'password'..."
                      className="flex-1 bg-card border border-slate-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-brand transition-all font-medium text-white"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={chatLoading}
                      className="bg-brand text-white px-8 py-4 rounded-2xl hover:bg-brand/90 transition-all font-bold shadow-lg shadow-brand/20 disabled:opacity-50"
                    >
                      Process
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-top-4">
            <div>
              <h2 className="text-3xl font-display font-bold text-white">Governance Policies</h2>
              <p className="text-slate-400">Configure real-time security and privacy rules.</p>
            </div>

            <div className="grid gap-6">
              <div className="glass p-8 rounded-3xl flex items-center justify-between">
                <div className="flex gap-6">
                  <div className="w-16 h-16 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center">
                    <Lock size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-display">PII Redaction Engine</h3>
                    <p className="text-slate-400">Automatically scrub Emails, Phone Numbers, and UUIDs across all traffic.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setRedactionEnabled(!redactionEnabled)}
                  className={`px-6 py-2 rounded-xl font-bold transition-all ${redactionEnabled ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-400'}`}
                >
                  {redactionEnabled ? 'ACTIVE' : 'DISABLED'}
                </button>
              </div>

              <div className="glass p-8 rounded-3xl flex flex-col gap-6">
                <div className="flex justify-between items-center">
                   <div className="flex gap-6">
                    <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center">
                      <AlertTriangle size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold font-display">Keyword Rule Engine</h3>
                      <p className="text-slate-400">Instantly block prompts containing internal secrets or proprietary terms.</p>
                    </div>
                  </div>
                  <button className="text-brand text-sm font-bold uppercase tracking-widest hover:underline">Edit config.yaml</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['password', 'secret_key', 'internal_db', 'proprietary_algorithm', 'SSN'].map(kw => (
                    <span key={kw} className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-bold border border-red-500/20">{kw}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 animate-in fade-in duration-300">
           <div className="glass w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b border-slate-700 flex justify-between items-center">
               <h3 className="text-2xl font-bold font-display">Transaction Audit</h3>
               <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-800 rounded-full transition-all">
                 <X />
               </button>
             </div>
             <div className="p-8 overflow-y-auto flex flex-col gap-6">
               <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-800/50 rounded-2xl">
                   <p className="text-[10px] uppercase text-slate-500 font-black">User Identity</p>
                   <p className="font-mono text-brand font-bold">{selectedLog.user_id}</p>
                 </div>
                 <div className="p-4 bg-slate-800/50 rounded-2xl">
                   <p className="text-[10px] uppercase text-slate-500 font-black">Latency</p>
                   <p className="font-bold">{selectedLog.latency_ms}ms</p>
                 </div>
               </div>

               <div>
                 <p className="text-[10px] uppercase text-slate-500 font-black mb-2">Request Body</p>
                 <pre className="p-4 bg-black/40 rounded-2xl text-xs font-mono text-slate-300 whitespace-pre-wrap border border-slate-800">
                   {selectedLog.request_body}
                 </pre>
               </div>

               <div>
                 <p className="text-[10px] uppercase text-slate-500 font-black mb-2">Response Body</p>
                 <pre className="p-4 bg-black/40 rounded-2xl text-xs font-mono text-slate-200 whitespace-pre-wrap border border-slate-800 max-h-40 overflow-y-auto">
                   {selectedLog.response_body}
                 </pre>
               </div>

               <div className="flex gap-4">
                 {selectedLog.is_redacted && (
                   <div className="px-4 py-2 bg-purple-500/10 text-purple-400 rounded-xl text-xs font-bold border border-purple-500/20 flex items-center gap-2">
                     <Lock size={14} /> PII Scrubbed
                   </div>
                 )}
                 {selectedLog.is_blocked && (
                    <div className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-xs font-bold border border-red-500/20 flex items-center gap-2">
                      <AlertTriangle size={14} /> Policy Block
                    </div>
                 )}
                 <div className="ml-auto px-4 py-2 bg-green-500/10 text-green-400 rounded-xl text-xs font-bold border border-green-500/20">
                    Safety: {(selectedLog.safety_score * 100).toFixed(0)}%
                 </div>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
