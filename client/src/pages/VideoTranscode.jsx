import { useState, useEffect, useRef } from 'react';
import { Film, Play, Loader } from 'lucide-react';
import ToolHeader from '../components/ToolHeader';
import FileUploader from '../components/FileUploader';
import OptionGroup, { OptionRow } from '../components/OptionGroup';
import ProgressBar from '../components/ProgressBar';
import ResultPanel from '../components/ResultPanel';
import { probeVideo, transcodeVideo, getTaskProgress } from '../services/api';
import './ToolPage.css';

export default function VideoTranscode() {
  const [files, setFiles] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [options, setOptions] = useState({
    format: 'mp4',
    videoCodec: 'libx264',
    videoBitrate: '',
    audioCodec: 'aac',
    fps: '',
    resolution: '',
    width: '',
    height: '',
  });
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, done, error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Probe video metadata on file select
  useEffect(() => {
    if (files.length === 0) {
      setMetadata(null);
      return;
    }
    probeVideo(files[0])
      .then(res => {
        if (res.success) setMetadata(res.data);
      })
      .catch(() => {});
  }, [files]);

  // Cleanup polling on unmount
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
      const res = await transcodeVideo(files[0], options, (e) => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 50));
      });

      if (!res.success) throw new Error(res.error || 'Transcode failed');
      const taskId = res.taskId;
      setStatus('processing');
      setProgress(50);

      // Poll for progress
      pollRef.current = setInterval(async () => {
        try {
          const p = await getTaskProgress(taskId);
          const total = 50 + (p.percent / 2);
          setProgress(total);

          if (p.status === 'done') {
            clearInterval(pollRef.current);
            setStatus('done');
            setProgress(100);
            setResult(p.result);
          } else if (p.status === 'error') {
            clearInterval(pollRef.current);
            setStatus('error');
            setError(p.error || 'Processing failed');
          }
        } catch {
          // Ignore poll errors
        }
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
        icon={Film}
        title="视频转码"
        subtitle="格式转换、码率压缩、帧率调整、分辨率变换"
        accent="var(--tool-transcode)"
      />

      <div className="tool-layout">
        {/* Left: Upload + Options */}
        <div className="tool-main">
          <FileUploader
            accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'] }}
            onFiles={(f) => { setFiles(f); handleReset(); setFiles(f); }}
            files={files}
            onRemove={() => handleReset()}
            label="拖拽视频文件到这里"
            hint="支持 MP4, MOV, AVI, MKV, WebM 格式，最大 500MB"
          />

          {/* Video Metadata */}
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
                      <span className="meta-label">编码</span>
                      <span className="meta-value">{metadata.video.codec}</span>
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
                <div className="meta-item">
                  <span className="meta-label">码率</span>
                  <span className="meta-value">{metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps` : '-'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">格式</span>
                  <span className="meta-value">{metadata.format}</span>
                </div>
              </div>
            </div>
          )}

          {/* Options */}
          {files.length > 0 && (
            <div className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
              <OptionGroup title="输出参数">
                <OptionRow label="输出格式">
                  <select className="select" value={options.format} onChange={e => updateOption('format', e.target.value)}>
                    <option value="mp4">MP4</option>
                    <option value="mov">MOV</option>
                    <option value="avi">AVI</option>
                    <option value="mkv">MKV</option>
                    <option value="webm">WebM</option>
                  </select>
                </OptionRow>
                <OptionRow label="视频编码">
                  <select className="select" value={options.videoCodec} onChange={e => updateOption('videoCodec', e.target.value)}>
                    <option value="libx264">H.264</option>
                    <option value="libx265">H.265 (HEVC)</option>
                    <option value="libvpx-vp9">VP9</option>
                    <option value="copy">复制（不转码）</option>
                  </select>
                </OptionRow>
                <OptionRow label="视频码率" hint="留空使用默认">
                  <input className="input" type="text" placeholder="例: 2000k" value={options.videoBitrate} onChange={e => updateOption('videoBitrate', e.target.value)} />
                </OptionRow>
                <OptionRow label="音频编码">
                  <select className="select" value={options.audioCodec} onChange={e => updateOption('audioCodec', e.target.value)}>
                    <option value="aac">AAC</option>
                    <option value="libmp3lame">MP3</option>
                    <option value="copy">复制原始</option>
                  </select>
                </OptionRow>
                <OptionRow label="帧率" hint="留空保持原始">
                  <select className="select" value={options.fps} onChange={e => updateOption('fps', e.target.value)}>
                    <option value="">保持原始</option>
                    <option value="24">24 fps</option>
                    <option value="25">25 fps</option>
                    <option value="30">30 fps</option>
                    <option value="50">50 fps</option>
                    <option value="60">60 fps</option>
                  </select>
                </OptionRow>
                <OptionRow label="分辨率" hint="留空保持原始">
                  <select className="select" value={options.resolution} onChange={e => updateOption('resolution', e.target.value)}>
                    <option value="">保持原始</option>
                    <option value="4k">4K (3840×2160)</option>
                    <option value="1080p">1080p (1920×1080)</option>
                    <option value="720p">720p (1280×720)</option>
                    <option value="480p">480p (854×480)</option>
                  </select>
                </OptionRow>
              </OptionGroup>
            </div>
          )}

          {/* Progress */}
          {isProcessing && (
            <ProgressBar
              percent={progress}
              status={status}
              label={status === 'uploading' ? '上传中…' : '转码处理中…'}
            />
          )}

          {/* Error */}
          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          {/* Result */}
          {status === 'done' && result && (
            <ResultPanel result={result} />
          )}

          {/* Actions */}
          <div className="tool-actions">
            {status === 'done' ? (
              <button className="btn btn-secondary" onClick={handleReset}>处理新文件</button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                disabled={files.length === 0 || isProcessing}
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <><Loader size={18} className="spinning" /> 处理中…</>
                ) : (
                  <><Play size={18} /> 开始转码</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
