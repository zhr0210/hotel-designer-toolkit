import './OptionGroup.css';

export default function OptionGroup({ title, children }) {
  return (
    <div className="option-group">
      {title && <h3 className="option-group-title">{title}</h3>}
      <div className="option-group-content">
        {children}
      </div>
    </div>
  );
}

export function OptionRow({ label, hint, children }) {
  return (
    <div className="option-row">
      <div className="option-label-wrap">
        <label className="label">{label}</label>
        {hint && <span className="option-hint">{hint}</span>}
      </div>
      <div className="option-control">
        {children}
      </div>
    </div>
  );
}
