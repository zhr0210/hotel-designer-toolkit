import { useState } from 'react';
import { Scissors, Play, Loader, Smartphone, Monitor } from 'lucide-react';
import ToolHeader from '../components/ToolHeader';
import FileUploader from '../components/FileUploader';
import OptionGroup, { OptionRow } from '../components/OptionGroup';
import ResultPanel from '../components/ResultPanel';
import { splitImage } from '../services/api';
import './ToolPage.css';

export default function ImageSplit() {
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState({
    direction: 'vertical',
    limit: '1000',
    format: 'png',
  });
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function updateOption(key, value) {
    setOptions(prev => ({ ...prev, [key]: value }));
  }

  function handleFiles(newFiles) {
    // Only allow one file for splitting
    setFiles([newFiles[0]]);
    setResult(null);
    setError(null);
    setStatus('idle');
  }

  function handleRemove() {
    setFiles([]);
    setResult(null);
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setStatus('processing');
    setResult(null);
    setError(null);

    try {
      const res = await splitImage(files[0], options);
      if (!res.success) throw new Error(res.error || 'Split failed');
      
      setStatus('done');
      // For split result, we might want to show the folder or the first image
      // Let's assume ResultPanel can handle a list of images or we show the count
      setResult({
        ...res.data,
        // Mock a single URL for preview if needed, or update ResultPanel
        url: res.data.images[0]?.url,
        filename: res.data.images[0]?.filename,
        displayCount: res.data.count
      });
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  function handleReset() {
    setFiles([]);
    setStatus('idle');
    setResult(null);
    setError(null);
  }

  const isProcessing = status === 'processing';

  return (
    <div className="tool-page">
      <ToolHeader
        icon={Scissors}
        title="图片垂直或水平拆分"
        subtitle="根据高度或宽度上限自动切分长图，支持批量导出"
        accent="var(--tool-split)"
      />

      <div className="tool-layout">
        <div className="tool-main">
          <FileUploader
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp'] }}
            multiple={false}
            onFiles={handleFiles}
            files={files}
            onRemove={handleRemove}
            label="拖拽长图到这里进行拆分"
            hint="支持大图拆分，不限制原始比例"
          />

          {files.length > 0 && (
            <div className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
              <OptionGroup title="拆分参数">
                <OptionRow label="拆分方向">
                  <div className="segmented-control">
                    <button 
                      className={`control-btn ${options.direction === 'vertical' ? 'active' : ''}`}
                      onClick={() => updateOption('direction', 'vertical')}
                    >
                      <Smartphone size={16} />
                      垂直拆分 (纵向)
                    </button>
                    <button 
                      className={`control-btn ${options.direction === 'horizontal' ? 'active' : ''}`}
                      onClick={() => updateOption('direction', 'horizontal')}
                    >
                      <Monitor size={16} />
                      水平拆分 (横向)
                    </button>
                  </div>
                </OptionRow>
                
                <OptionRow label={options.direction === 'vertical' ? '单张高度上限' : '单张宽度上限'}>
                  <div className="slider-row">
                    <input 
                      type="number" 
                      className="input"
                      min="100" 
                      max="20000" 
                      step="100"
                      value={options.limit} 
                      onChange={e => updateOption('limit', e.target.value)} 
                    />
                    <span className="input-suffix">px</span>
                  </div>
                </OptionRow>

                <OptionRow label="输出格式">
                  <select className="select" value={options.format} onChange={e => updateOption('format', e.target.value)}>
                    <option value="png">PNG (无损)</option>
                    <option value="jpeg">JPEG (压缩)</option>
                    <option value="webp">WebP (推荐)</option>
                  </select>
                </OptionRow>
              </OptionGroup>
            </div>
          )}

          {error && <div className="error-message">❌ {error}</div>}
          
          {status === 'done' && result && (
            <div className="split-result-info animate-fadeIn">
              <div className="result-stats-card">
                <div className="stat-item">
                  <span className="stat-label">拆分数量</span>
                  <span className="stat-value">{result.count} 张</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">输出目录</span>
                  <span className="stat-value">{result.dir}</span>
                </div>
              </div>
              <ResultPanel result={result} />
            </div>
          )}

          <div className="tool-actions">
            {status === 'done' ? (
              <button className="btn btn-secondary" onClick={handleReset}>处理新图片</button>
            ) : (
              <button 
                className="btn btn-primary btn-lg" 
                disabled={files.length === 0 || isProcessing} 
                onClick={handleSubmit}
                style={{ '--accent-gradient': 'linear-gradient(135deg, var(--tool-split) 0%, #f97316 100%)', '--accent-glow': '0 0 20px rgba(245, 158, 11, 0.3)' }}
              >
                {isProcessing ? (
                  <><Loader size={18} className="spinning" /> 拆分中…</>
                ) : (
                  <><Play size={18} /> 开始拆分</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
