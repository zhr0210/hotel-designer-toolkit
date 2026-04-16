import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileVideo, FileImage, X, AlertCircle } from 'lucide-react';
import './FileUploader.css';

export default function FileUploader({
  accept,
  multiple = false,
  maxFiles = 1,
  maxSize = 500 * 1024 * 1024,
  onFiles,
  label = '拖拽文件到这里，或点击选择',
  hint = '',
  files = [],
  onRemove,
}) {
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError(null);
    if (rejectedFiles.length > 0) {
      const err = rejectedFiles[0].errors[0];
      if (err.code === 'file-too-large') {
        setError('文件过大，最大支持 500MB');
      } else if (err.code === 'file-invalid-type') {
        setError('不支持的文件格式');
      } else {
        setError(err.message);
      }
      return;
    }
    if (onFiles) onFiles(acceptedFiles);
  }, [onFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxFiles,
    maxSize,
  });

  function formatSize(bytes) {
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
        className={`file-dropzone ${isDragActive ? 'dragging' : ''} ${files.length > 0 ? 'has-files' : ''}`}
      >
        <input {...getInputProps()} />
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
