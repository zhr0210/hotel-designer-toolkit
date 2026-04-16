import './ProgressBar.css';

export default function ProgressBar({ percent = 0, status = 'idle', label = '' }) {
  const statusText = {
    idle: '等待中',
    uploading: '上传中…',
    processing: '处理中…',
    done: '完成',
    error: '出错',
  };

  return (
    <div className={`progress-wrapper ${status}`}>
      <div className="progress-header">
        <span className="progress-label">{label || statusText[status] || status}</span>
        <span className="progress-percent">{Math.round(percent)}%</span>
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill ${status === 'processing' ? 'striped' : ''}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
