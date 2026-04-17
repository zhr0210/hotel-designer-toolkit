import { useState } from 'react';
import { Download, ExternalLink, Loader, FolderDown, FolderOpen } from 'lucide-react';
import { getDownloadUrl, openFolder, saveFile } from '../services/api';
import './ResultPanel.css';

export default function ResultPanel({ result, type = 'file' }) {
  const [downloading, setDownloading] = useState(false);

  if (!result) return null;

  const isImage = result.url && /\.(jpg|jpeg|png|webp|gif|avif|tiff)$/i.test(result.url);
  const isVideo = result.url && /\.(mp4|mov|avi|mkv|webm)$/i.test(result.url);
  const isDir = result.isDir === true;

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleOpenFolder() {
    try {
      await openFolder(result.url);
    } catch (err) {
      alert('无法打开文件夹: ' + err);
    }
  }

  async function handleDownload() {
    if (!result.url || downloading) return;
    setDownloading(true);

    try {
      // Use native Tauri save dialog and copy logic
      await saveFile(result.url, result.filename || 'export');
      // Success is implied if no error is thrown
    } catch (err) {
      if (err !== 'CANCELLED') {
        console.error('Save error:', err);
        alert('保存失败: ' + err);
      }
    } finally {
      setDownloading(false);
    }
  }

  const previewUrl = getDownloadUrl(result.url);

  return (
    <div className="result-panel animate-fadeInUp">
      <div className="result-header">
        <h3 className="result-title">✅ 处理完成</h3>
        {result.size > 0 && <span className="badge badge-success">{formatSize(result.size)}</span>}
      </div>

      {/* Preview */}
      {isImage && (
        <div className="result-preview">
          <img src={previewUrl} alt="Result preview" className="result-image" />
        </div>
      )}
      {isVideo && (
        <div className="result-preview">
          <video src={previewUrl} controls className="result-video" />
        </div>
      )}
      {isDir && (
        <div className="result-preview dir-preview">
          <div className="dir-icon-container">
            <FolderOpen size={48} color="var(--primary)" />
          </div>
          <p className="dir-text">序列帧已保存至临时目录</p>
          <p className="dir-path">{result.url}</p>
        </div>
      )}

      {/* Actions */}
      <div className="result-actions">
        {isDir ? (
          <button className="btn btn-primary" onClick={handleOpenFolder}>
            <FolderOpen size={16} /> 打开输出文件夹
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <><Loader size={16} className="spinning" /> 保存中…</>
            ) : (
              <><FolderDown size={16} /> 保存到本地</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
