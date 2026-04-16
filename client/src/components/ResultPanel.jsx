import { useState } from 'react';
import { Download, ExternalLink, Loader, FolderDown } from 'lucide-react';
import { getDownloadUrl } from '../services/api';
import './ResultPanel.css';

export default function ResultPanel({ result, type = 'file' }) {
  const [downloading, setDownloading] = useState(false);

  if (!result) return null;

  const isImage = result.url && /\.(jpg|jpeg|png|webp|gif|avif|tiff)$/i.test(result.url);
  const isVideo = result.url && /\.(mp4|mov|avi|mkv|webm)$/i.test(result.url);

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get MIME type from filename extension
   */
  function getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeMap = {
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
      tiff: 'image/tiff', bmp: 'image/bmp',
      heic: 'image/heic', heif: 'image/heif',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  /**
   * Get file type filter for the save dialog
   */
  function getFileTypeFilter(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mime = getMimeType(filename);
    return [{ description: `${ext.toUpperCase()} 文件`, accept: { [mime]: [`.${ext}`] } }];
  }

  /**
   * Download file using the native "Save As" dialog (File System Access API)
   * Falls back to blob download for browsers that don't support it
   */
  async function handleDownload() {
    if (!result.filename || downloading) return;
    setDownloading(true);

    try {
      // 1. Fetch the file as blob
      const url = getDownloadUrl(result.filename);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      // 2. Try native "Save As" dialog (File System Access API)
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: result.filename,
            types: getFileTypeFilter(result.filename),
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setDownloading(false);
          return; // Success — saved to user-chosen location
        } catch (pickerErr) {
          // User cancelled the dialog — that's fine, just stop
          if (pickerErr.name === 'AbortError') {
            setDownloading(false);
            return;
          }
          // Other errors: fall through to legacy download
          console.warn('showSaveFilePicker failed, using fallback:', pickerErr);
        }
      }

      // 3. Fallback: trigger browser download via temporary <a> tag
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = result.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 200);
    } catch (err) {
      console.error('Download error:', err);
      alert('下载失败，请尝试右键"在新标签页打开"后手动保存');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="result-panel animate-fadeInUp">
      <div className="result-header">
        <h3 className="result-title">✅ 处理完成</h3>
        {result.size && <span className="badge badge-success">{formatSize(result.size)}</span>}
      </div>

      {/* Preview */}
      {isImage && (
        <div className="result-preview">
          <img src={result.url} alt="Result preview" className="result-image" />
        </div>
      )}
      {isVideo && (
        <div className="result-preview">
          <video src={result.url} controls className="result-video" />
        </div>
      )}
      {result.frameCount != null && (
        <div className="result-stats">
          <span>共导出 <strong>{result.frameCount}</strong> 帧</span>
        </div>
      )}

      {/* Actions */}
      <div className="result-actions">
        {result.filename && (
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <><Loader size={16} className="spinning" /> 下载中…</>
            ) : (
              <><FolderDown size={16} /> 保存到本地</>
            )}
          </button>
        )}
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <ExternalLink size={16} />
            在新标签页打开
          </a>
        )}
      </div>
    </div>
  );
}
