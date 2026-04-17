import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileVideo, FileImage, X, AlertCircle } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open } from '@tauri-apps/plugin-dialog';
import './FileUploader.css';

export default function FileUploader({
  accept,
  multiple = false,
  maxFiles = 1,
  onFiles,
  label = '拖拽文件到这里，或点击选择',
  hint = '',
  files = [],
  onRemove,
}) {
  const [error, setError] = useState(null);

  // Handle Tauri Native Drag and Drop
  useEffect(() => {
    let unlistenFn = null;
    let cancelled = false;

    async function setupListener() {
      try {
        const window = getCurrentWebviewWindow();
        const unlisten = await window.onDragDropEvent((event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const tauriFiles = paths.slice(0, multiple ? paths.length : maxFiles).map(path => {
                const name = path.split(/[/\\]/).pop();
                return {
                  name,
                  path,
                  size: 0,
                  type: name.toLowerCase().endsWith('.mp4') || name.toLowerCase().endsWith('.mov') ? 'video/mp4' : 'image/jpeg',
                  lastModified: Date.now(),
                  webkitRelativePath: ""
                };
              });
              if (onFiles) onFiles(tauriFiles);
            }
          }
        });
        
        if (cancelled) {
          unlisten();
        } else {
          unlistenFn = unlisten;
        }
      } catch (err) {
        console.error('Failed to setup drag-drop listener:', err);
      }
    }

    setupListener();
    return () => {
      cancelled = true;
      if (unlistenFn) unlistenFn();
    };
  }, [onFiles, multiple, maxFiles]);

  const handleManualClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const selected = await open({
        multiple,
        filters: accept ? Object.entries(accept).map(([title, exts]) => ({
          name: title,
          extensions: exts.map(e => e.replace('.', ''))
        })) : []
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        const tauriFiles = paths.map(path => {
          const name = path.split(/[/\\]/).pop();
          return {
            name,
            path,
            size: 0,
            type: name.toLowerCase().endsWith('.mp4') || name.toLowerCase().endsWith('.mov') ? 'video/mp4' : 'image/jpeg'
          };
        });
        if (onFiles) onFiles(tauriFiles);
      }
    } catch (err) {
      setError('打开对话框失败: ' + err.message);
    }
  };

  // We keep react-dropzone just for the UI state/styling, but we'll override its behavior
  const { getRootProps, isDragActive } = useDropzone({
    noClick: true, // we handle click manually for Tauri Dialog
    noKeyboard: true,
  });

  function formatSize(bytes) {
    if (bytes === 0) return '---'; 
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(file) {
    if (file.type && file.type.startsWith('video/')) return <FileVideo size={20} />;
    return <FileImage size={20} />;
  }

  return (
    <div className="file-uploader-wrapper">
      <div
        {...getRootProps()}
        onClick={handleManualClick}
        className={`file-dropzone ${isDragActive ? 'dragging' : ''} ${files.length > 0 ? 'has-files' : ''}`}
      >
        <div className="dropzone-content">
          <div className={`dropzone-icon ${isDragActive ? 'bounce' : ''}`}>
            <Upload size={28} />
          </div>
          <p className="dropzone-label">{label}</p>
          {hint && <p className="dropzone-hint">{hint}</p>}
        </div>
      </div>

      {error && (
        <div className="upload-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="file-item animate-fadeInUp" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="file-icon">{getFileIcon(file)}</div>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatSize(file.size)}</span>
              </div>
              {onRemove && (
                <button className="file-remove" onClick={(e) => { e.stopPropagation(); onRemove(idx); }} title="移除">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
