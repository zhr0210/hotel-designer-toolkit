import { useState } from 'react';
import { Layers, Play, Loader, GripVertical } from 'lucide-react';
import ToolHeader from '../components/ToolHeader';
import FileUploader from '../components/FileUploader';
import OptionGroup, { OptionRow } from '../components/OptionGroup';
import ResultPanel from '../components/ResultPanel';
import { stitchImages } from '../services/api';
import './ToolPage.css';

export default function ImageStitch() {
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState({
    direction: 'vertical',
    gap: '0',
    backgroundColor: 'transparent',
    align: 'center',
    format: 'png',
    targetWidth: '',
  });
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function updateOption(key, value) {
    setOptions(prev => ({ ...prev, [key]: value }));
  }

  function handleFiles(newFiles) {
    setFiles(prev => [...prev, ...newFiles]);
    setResult(null);
    setError(null);
    setStatus('idle');
  }

  function handleRemove(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (files.length < 2) return;
    setStatus('processing');
    setResult(null);
    setError(null);

    try {
      const res = await stitchImages(files, options);
      if (!res.success) throw new Error(res.error || 'Stitch failed');
      setStatus('done');
      setResult(res.data);
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
        icon={Layers}
        title="图片无缝拼接"
        subtitle="支持上下、左右拼接，自定义间距和背景"
        accent="var(--tool-stitch)"
      />

      <div className="tool-layout">
        <div className="tool-main">
          <FileUploader
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp'] }}
            multiple={true}
            maxFiles={20}
            onFiles={handleFiles}
            files={files}
            onRemove={handleRemove}
            label="拖拽图片文件到这里（至少 2 张）"
            hint="支持多张图片，将按顺序拼接"
          />

          {/* Stitch Preview Indicator */}
          {files.length >= 2 && (
            <div className="stitch-preview animate-fadeInUp">
              <div className={`stitch-diagram ${options.direction}`}>
                {files.map((f, i) => (
                  <div key={i} className="stitch-block">
                    <span className="stitch-index">{i + 1}</span>
                  </div>
                ))}
              </div>
              <span className="stitch-info">
                {files.length} 张图片 · {options.direction === 'vertical' ? '上下' : '左右'}拼接
              </span>
            </div>
          )}

          {files.length >= 2 && (
            <div className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
              <OptionGroup title="拼接参数">
                <OptionRow label="拼接方向">
                  <select className="select" value={options.direction} onChange={e => updateOption('direction', e.target.value)}>
                    <option value="vertical">上下拼接（垂直）</option>
                    <option value="horizontal">左右拼接（水平）</option>
                  </select>
                </OptionRow>
                <OptionRow label="间距">
                  <div className="slider-row">
                    <input type="range" min="0" max="100" value={options.gap} onChange={e => updateOption('gap', e.target.value)} />
                    <span className="slider-value">{options.gap}px</span>
                  </div>
                </OptionRow>
                <OptionRow label="背景色">
                  <select className="select" value={options.backgroundColor} onChange={e => updateOption('backgroundColor', e.target.value)}>
                    <option value="transparent">透明</option>
                    <option value="white">白色</option>
                    <option value="black">黑色</option>
                    <option value="#f5f5f5">浅灰</option>
                  </select>
                </OptionRow>
                <OptionRow label="对齐方式">
                  <select className="select" value={options.align} onChange={e => updateOption('align', e.target.value)}>
                    <option value="center">居中</option>
                    <option value="left">居左/居上</option>
                    <option value="right">居右/居下</option>
                  </select>
                </OptionRow>
                <OptionRow label="统一宽度">
                  <div className="slider-row">
                    <input
                      type="number"
                      className="input"
                      placeholder="留空则保持原尺寸"
                      min="100"
                      max="10000"
                      value={options.targetWidth}
                      onChange={e => updateOption('targetWidth', e.target.value)}
                    />
                    <span className="input-suffix">px</span>
                  </div>
                </OptionRow>
                <OptionRow label="输出格式">
                  <select className="select" value={options.format} onChange={e => updateOption('format', e.target.value)}>
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                  </select>
                </OptionRow>
              </OptionGroup>
            </div>
          )}

          {error && <div className="error-message">❌ {error}</div>}
          {status === 'done' && result && <ResultPanel result={result} />}

          <div className="tool-actions">
            {status === 'done' ? (
              <button className="btn btn-secondary" onClick={handleReset}>处理新文件</button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={files.length < 2 || isProcessing} onClick={handleSubmit}>
                {isProcessing ? <><Loader size={18} className="spinning" /> 拼接中…</> : <><Play size={18} /> 开始拼接</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
