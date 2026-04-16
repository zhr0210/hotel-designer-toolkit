import './ToolHeader.css';

export default function ToolHeader({ icon: Icon, title, subtitle, accent }) {
  return (
    <div className="tool-header animate-fadeInUp">
      <div className="tool-header-icon" style={accent ? { background: `${accent}15`, color: accent } : undefined}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="tool-header-text">
        <h1 className="tool-header-title">{title}</h1>
        {subtitle && <p className="tool-header-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}
