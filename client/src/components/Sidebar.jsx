import { NavLink, useLocation } from 'react-router-dom';
import { Film, Layers, ImageIcon, PanelLeftClose, Zap, Scissors, Palette, LayoutGrid } from 'lucide-react';
import './Sidebar.css';

const navItems = [
  {
    group: '概览',
    items: [
      { path: '/', label: '仪表盘', icon: LayoutGrid },
    ],
  },
  {
    group: '视频工具',
    items: [
      { path: '/video/transcode', label: '视频转码', icon: Film, accent: 'var(--tool-transcode)' },
      { path: '/video/frames', label: '序列帧 / GIF', icon: Scissors, accent: 'var(--tool-frames)' },
    ],
  },
  {
    group: '图片工具',
    items: [
      { path: '/image/convert', label: '图片格式转换', icon: Palette, accent: 'var(--tool-convert)' },
      { path: '/image/stitch', label: '图片无缝拼接', icon: Layers, accent: 'var(--tool-stitch)' },
      { path: '/image/split', label: '图片垂直/水平拆分', icon: Scissors, accent: 'var(--tool-split)' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Zap size={18} />
          </div>
          <div className="logo-text">
            <span className="logo-title">Media Toolkit</span>
            <span className="logo-version">v1.0</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((group) => (
          <div key={group.group} className="nav-group">
            <span className="nav-group-label">{group.group}</span>
            <ul className="nav-list">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      style={isActive && item.accent ? { '--nav-accent': item.accent } : undefined}
                    >
                      <span className="nav-icon" style={item.accent ? { '--icon-color': item.accent } : undefined}>
                        <Icon size={18} />
                      </span>
                      <span className="nav-label">{item.label}</span>
                      {isActive && <span className="nav-indicator" />}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-stats">
          <span className="stats-dot" />
          <span className="stats-text">FFmpeg · Sharp 就绪</span>
        </div>
      </div>
    </aside>
  );
}
