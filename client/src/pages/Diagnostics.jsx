import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Activity, ExternalLink, Info } from 'lucide-react';
import { runDiagnostics } from '../services/api';
import ToolHeader from '../components/ToolHeader';
import './ToolPage.css';

export default function Diagnostics() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [complete, setComplete] = useState(false);
  const [summary, setSummary] = useState({ ok: 0, warning: 0, error: 0 });

  async function startDiagnostics() {
    setLoading(true);
    setComplete(false);
    setItems([]);
    
    try {
      // Small artificial delay for nice UI animation feel
      await new Promise(r => setTimeout(r, 800));
      const res = await runDiagnostics();
      
      if (res.success) {
        setItems(res.data.items);
        
        const stats = res.data.items.reduce((acc, item) => {
          acc[item.status]++;
          return acc;
        }, { ok: 0, warning: 0, error: 0 });
        
        setSummary(stats);
      }
    } catch (err) {
      console.error("Diagnostics failed", err);
    } finally {
      setLoading(false);
      setComplete(true);
    }
  }

  useEffect(() => {
    startDiagnostics();
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': return <ShieldCheck className="status-icon-ok" size={20} />;
      case 'warning': return <ShieldAlert className="status-icon-warning" size={20} />;
      case 'error': return <ShieldX className="status-icon-error" size={20} />;
      default: return <RefreshCw className="status-icon-loading spinning" size={20} />;
    }
  };

  return (
    <div className="tool-page animate-fadeIn">
      <ToolHeader
        icon={Activity}
        title="系统服务自检"
        subtitle="自动检测运行环境、底层引擎及核心组件状态"
        accent="var(--accent-1)"
      />

      <div className="tool-layout">
        <div className="tool-main">
          <div className="diagnostics-header">
            <div className="diag-summary">
              <div className="diag-stat">
                <span className="stat-val">{summary.ok}</span>
                <span className="stat-lab">正常</span>
              </div>
              <div className="diag-stat warning">
                <span className="stat-val">{summary.warning}</span>
                <span className="stat-lab">注意</span>
              </div>
              <div className="diag-stat error">
                <span className="stat-val">{summary.error}</span>
                <span className="stat-lab">异常</span>
              </div>
            </div>
            
            <button 
              className={`btn btn-secondary ${loading ? 'disabled' : ''}`}
              onClick={startDiagnostics}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              {loading ? '检测中...' : '重新检测'}
            </button>
          </div>

          <div className="diagnostics-list">
            {loading && items.length === 0 ? (
              <div className="diag-loading-state">
                <div className="loading-pulser" />
                <p>正在扫描核心服务组件...</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`diag-item animate-fadeInUp status-${item.status}`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="diag-item-header">
                    <div className="diag-item-title">
                      {getStatusIcon(item.status)}
                      <h3>{item.name}</h3>
                    </div>
                    <span className={`badge badge-${item.status === 'ok' ? 'success' : item.status}`}>
                      {item.status === 'ok' ? '就绪' : item.status === 'warning' ? '警告' : '缺失'}
                    </span>
                  </div>
                  
                  <div className="diag-item-content">
                    <p className="diag-msg">{item.message}</p>
                    {item.recommendation && (
                      <div className="diag-recommendation">
                        <Info size={14} />
                        <span>建议: {item.recommendation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {complete && summary.error > 0 && (
            <div className="diag-troubleshoot animate-fadeIn">
              <div className="troubleshoot-icon">
                <ShieldAlert size={24} />
              </div>
              <div className="troubleshoot-text">
                <h4>发现了潜在问题</h4>
                <p>某些核心引擎未正确配置，这可能会导致媒体处理功能受限。请参考上述建议进行环境修复。</p>
              </div>
              <a href="https://github.com/zhr0210/hotel-designer-toolkit" target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                查看安装文档 <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
