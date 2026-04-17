import { useState, useCallback } from 'react';
import { Palette, Play, Loader } from 'lucide-react';
import ToolHeader from '../components/ToolHeader';
import FileUploader from '../components/FileUploader';
import OptionGroup, { OptionRow } from '../components/OptionGroup';
import ResultPanel from '../components/ResultPanel';
import { convertImage } from '../services/api';
import './ToolPage.css';

export default function ImageConvert() {
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState({
    format: 'webp',
    quality: 80,
    width: '',
    height: '',
    fit: 'inside',
    dpi: '',
  });
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const updateOption = (key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = useCallback(() => {
    setFiles([]);
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const handleFiles = useCallback((f) => {
    handleReset();
    setFiles(f);
  }, [handleReset]);

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setStatus('processing');
    setResult(null);
    setError(null);

    try {
      const res = await convertImage(files[0], options);
      if (!res.success) throw new Error(res.error || 'Convert failed');
      setStatus('done');
      setResult(res.data);
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  const isProcessing = status === 'processing';

  return (
    <div className="tool-page">
      <ToolHeader
        icon={Palette}
        title="图片格式转换"
        subtitle="格式转换、分辨率调整、质量变换、DPI 设置"
        accent="var(--tool-convert)"
      />

      <div className="tool-layout">
        <div className="tool-main">
          <FileUploader
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp', '.gif', '.heic', '.heif'] }}
            onFiles={handleFiles}
            files={files}
            onRemove={handleReset}
            label="拖拽图片文件到这里"
            hint="支持 JPEG, PNG, WebP, AVIF, TIFF, BMP, HEIC 格式"
          />

          {files.length > 0 && (
            <div className="animate-fadeInUp">
              <OptionGroup title="转换参数">
                <OptionRow label="输出格式">
                  <select className="select" value={options.format} onChange={e => updateOption('format', e.target.value)}>
                    <option value="jpeg">JPEG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP</option>
                    <option value="avif">AVIF</option>
                    <option value="heic">HEIC</option>
                    <option value="tiff">TIFF</option>
                  </select>
                </OptionRow>
                <OptionRow label="质量">
                  <div className="slider-row">
                    <input type="range" min="1" max="100" value={options.quality} onChange={e => updateOption('quality', parseInt(e.target.value))} />
                    <span className="slider-value">{options.quality}</span>
                  </div>
                </OptionRow>
                <OptionRow label="宽度" hint="留空保持原始">
                  <input className="input" type="number" placeholder="像素" value={options.width} onChange={e => updateOption('width', e.target.value)} />
                </OptionRow>
                <OptionRow label="高度" hint="留空保持原始">
                  <input className="input" type="number" placeholder="像素" value={options.height} onChange={e => updateOption('height', e.target.value)} />
                </OptionRow>
                <OptionRow label="缩放模式">
                  <select className="select" value={options.fit} onChange={e => updateOption('fit', e.target.value)}>
                    <option value="inside">等比缩放（适应）</option>
                    <option value="cover">等比裁剪（填满）</option>
                    <option value="fill">拉伸填充</option>
                    <option value="contain">等比包含</option>
                  </select>
                </OptionRow>
                <OptionRow label="DPI" hint="留空保持原始">
                  <input className="input" type="number" placeholder="例: 300" value={options.dpi} onChange={e => updateOption('dpi', e.target.value)} />
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
              <button className="btn btn-primary btn-lg" disabled={files.length === 0 || isProcessing} onClick={handleSubmit}>
                {isProcessing ? <><Loader size={18} className="spinning" /> 转换中…</> : <><Play size={18} /> 开始转换</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
