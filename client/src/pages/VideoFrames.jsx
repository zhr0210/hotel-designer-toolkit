import { useState, useEffect, useRef } from 'react';
import { Scissors, Play, Loader } from 'lucide-react';
import ToolHeader from '../components/ToolHeader';
import FileUploader from '../components/FileUploader';
import OptionGroup, { OptionRow } from '../components/OptionGroup';
import ProgressBar from '../components/ProgressBar';
import ResultPanel from '../components/ResultPanel';
import { probeVideo, extractFrames, videoToGif, getTaskProgress } from '../services/api';
import './ToolPage.css';

export default function VideoFrames() {
  const [files, setFiles] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [mode, setMode] = useState('frames'); // frames | gif
  const [options, setOptions] = useState({
    fps: '24',
    format: 'png',
    quality: '90',
    width: '',
    startTime: '',
    duration: '',
    colors: '256',
    loop: '0',
  });
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (files.length === 0) { setMetadata(null); return; }
    probeVideo(files[0]).then(res => { if (res.success) setMetadata(res.data); }).catch(() => {});
  }, [files]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function updateOption(key, value) {
    setOptions(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setStatus('uploading');
    setProgress(0);
    setResult(null);
    setError(null);

    try {
      const apiCall = mode === 'gif' ? videoToGif : extractFrames;
      const res = await apiCall(files[0], options, (e) => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 50));
      });

      if (!res.success) throw new Error(res.error || 'Failed');
      setStatus('processing');
      setProgress(50);

      pollRef.current = setInterval(async () => {
        try {
          const p = await getTaskProgress(res.taskId);
          setProgress(50 + (p.percent / 2));
          if (p.status === 'done') {
            clearInterval(pollRef.current);
            setStatus('done');
            setProgress(100);
            setResult(p.result);
          } else if (p.status === 'error') {
            clearInterval(pollRef.current);
            setStatus('error');
            setError(p.error);
          }
        } catch {}
      }, 1000);
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  function handleReset() {
    setFiles([]);
    setMetadata(null);
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  const isProcessing = status === 'uploading' || status === 'processing';

  return (
    <div className="tool-page">
      <ToolHeader
        icon={Scissors}
        title="序列帧 / GIF"
        subtitle="视频拆分为序列帧图片或转换为高质量 GIF 动图"
        accent="var(--tool-frames)"
      />

      <div className="tool-layout">
        <div className="tool-main">
          <FileUploader
            accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }}
            onFiles={(f) => { handleReset(); setFiles(f); }}
            files={files}
            onRemove={() => handleReset()}
            label="拖拽视频文件到这里"
            hint="支持 MP4, MOV, AVI, MKV, WebM 格式"
          />

          {metadata && (
            <div className="metadata-card animate-fadeInUp">
              <h4 className="metadata-title">📋 源文件信息</h4>
              <div className="metadata-grid">
                {metadata.video && (
                  <>
                    <div className="meta-item">
                      <span className="meta-label">分辨率</span>
                      <span className="meta-value">{metadata.video.width}×{metadata.video.height}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">帧率</span>
                      <span className="meta-value">{Math.round(metadata.video.fps)} fps</span>
                    </div>
                  </>
                )}
                <div className="meta-item">
                  <span className="meta-label">时长</span>
                  <span className="meta-value">{Math.round(metadata.duration)}s</span>
                </div>
              </div>
            </div>
          )}

          {files.length > 0 && (
            <>
              {/* Mode Switcher */}
              <div className="mode-switcher animate-fadeInUp">
                <button className={`mode-btn ${mode === 'frames' ? 'active' : ''}`} onClick={() => setMode('frames')}>
                  序列帧
                </button>
                <button className={`mode-btn ${mode === 'gif' ? 'active' : ''}`} onClick={() => setMode('gif')}>
                  GIF 动图
                </button>
              </div>

              <div className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
                <OptionGroup title={mode === 'frames' ? '序列帧参数' : 'GIF 参数'}>
                  <OptionRow label="帧率">
                    <input className="input" type="number" min="1" max="60" value={options.fps} onChange={e => updateOption('fps', e.target.value)} />
                    <span className="input-suffix">fps</span>
                  </OptionRow>

                  {mode === 'frames' && (
                    <OptionRow label="输出格式">
                      <select className="select" value={options.format} onChange={e => updateOption('format', e.target.value)}>
                        <option value="png">PNG（无损）</option>
                        <option value="jpg">JPG（有损）</option>
                      </select>
                    </OptionRow>
                  )}

                  <OptionRow label="宽度" hint="留空保持原始">
                    <input className="input" type="number" placeholder="例: 1280" value={options.width} onChange={e => updateOption('width', e.target.value)} />
                    <span className="input-suffix">px</span>
                  </OptionRow>

                  <OptionRow label="开始时间" hint="留空从头开始">
                    <input className="input" type="text" placeholder="例: 00:00:05" value={options.startTime} onChange={e => updateOption('startTime', e.target.value)} />
                  </OptionRow>
                  <OptionRow label="持续时间" hint="留空到结尾">
                    <input className="input" type="text" placeholder="例: 00:00:10" value={options.duration} onChange={e => updateOption('duration', e.target.value)} />
                  </OptionRow>

                  {mode === 'gif' && (
                    <>
                      <OptionRow label="色彩数">
                        <select className="select" value={options.colors} onChange={e => updateOption('colors', e.target.value)}>
                          <option value="256">256 色（高质量）</option>
                          <option value="128">128 色</option>
                          <option value="64">64 色（小体积）</option>
                        </select>
                      </OptionRow>
                      <OptionRow label="循环">
                        <select className="select" value={options.loop} onChange={e => updateOption('loop', e.target.value)}>
                          <option value="0">无限循环</option>
                          <option value="1">播放一次</option>
                          <option value="-1">不循环</option>
                        </select>
                      </OptionRow>
                    </>
                  )}
                </OptionGroup>
              </div>
            </>
          )}

          {isProcessing && (
            <ProgressBar percent={progress} status={status} label={status === 'uploading' ? '上传中…' : '处理中…'} />
          )}

          {error && <div className="error-message">❌ {error}</div>}
          {status === 'done' && result && <ResultPanel result={result} />}

          <div className="tool-actions">
            {status === 'done' ? (
              <button className="btn btn-secondary" onClick={handleReset}>处理新文件</button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={files.length === 0 || isProcessing} onClick={handleSubmit}>
                {isProcessing ? <><Loader size={18} className="spinning" /> 处理中…</> : <><Play size={18} /> 开始导出</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
