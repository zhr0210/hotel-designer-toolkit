import { useNavigate } from 'react-router-dom';
import { Film, Scissors, Palette, Layers, ArrowRight, Zap, Cpu, HardDrive } from 'lucide-react';
import './Dashboard.css';

const tools = [
  {
    id: 'transcode',
    title: '视频转码',
    desc: '格式转换、码率压缩、帧率调整、分辨率变换',
    icon: Film,
    path: '/video/transcode',
    accent: 'var(--tool-transcode)',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    tags: ['MP4', 'MOV', 'H.264', 'H.265'],
  },
  {
    id: 'frames',
    title: '序列帧 / GIF',
    desc: '视频拆分为序列帧图片或转换为高质量 GIF 动图',
    icon: Scissors,
    path: '/video/frames',
    accent: 'var(--tool-frames)',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    tags: ['PNG', 'JPG', 'GIF', '调色板优化'],
  },
  {
    id: 'convert',
    title: '图片格式转换',
    desc: '格式转换、分辨率调整、质量压缩、DPI 设置',
    icon: Palette,
    path: '/image/convert',
    accent: 'var(--tool-convert)',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
    tags: ['JPEG', 'PNG', 'WebP', 'AVIF'],
  },
  {
    id: 'stitch',
    title: '图片无缝拼接',
    desc: '支持上下、左右拼接，自定义间距和背景',
    icon: Layers,
    path: '/image/stitch',
    accent: 'var(--tool-stitch)',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    tags: ['上下拼接', '左右拼接', '透明背景'],
  },
  {
    id: 'split',
    title: '图片垂直/水平拆分',
    desc: '根据高度或宽度上限自动切分长图，支持批量导出',
    icon: Scissors,
    path: '/image/split',
    accent: 'var(--tool-split)',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    tags: ['垂直拆分', '水平拆分', '长度控制'],
  },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      {/* Hero */}
      <section className="dashboard-hero animate-fadeInUp">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={14} />
            <span>Media Toolkit v1.0</span>
          </div>
          <h1 className="hero-title">
            专业级<span className="hero-gradient-text">媒体处理</span>工具箱
          </h1>
          <p className="hero-desc">
            集成 FFmpeg 与 Sharp 引擎，支持视频转码、序列帧导出、图片格式转换与拼接
          </p>
        </div>

        {/* Engine status */}
        <div className="engine-cards">
          <div className="engine-card">
            <Cpu size={18} className="engine-icon" />
            <div>
              <span className="engine-name">FFmpeg 8.0</span>
              <span className="engine-status">视频处理引擎</span>
            </div>
            <span className="engine-dot" />
          </div>
          <div className="engine-card">
            <HardDrive size={18} className="engine-icon" />
            <div>
              <span className="engine-name">Sharp</span>
              <span className="engine-status">图片处理引擎</span>
            </div>
            <span className="engine-dot" />
          </div>
        </div>
      </section>

      {/* Tool Cards */}
      <section className="tool-grid">
        {tools.map((tool, idx) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              className="tool-card animate-fadeInUp"
              style={{ animationDelay: `${(idx + 1) * 80}ms` }}
              onClick={() => navigate(tool.path)}
            >
              <div className="tool-card-header">
                <div className="tool-card-icon" style={{ background: tool.gradient }}>
                  <Icon size={22} color="white" />
                </div>
                <ArrowRight size={18} className="tool-card-arrow" />
              </div>
              <h3 className="tool-card-title">{tool.title}</h3>
              <p className="tool-card-desc">{tool.desc}</p>
              <div className="tool-card-tags">
                {tool.tags.map(tag => (
                  <span key={tag} className="tool-tag">{tag}</span>
                ))}
              </div>
              <div className="tool-card-glow" style={{ background: tool.gradient }} />
            </button>
          );
        })}
      </section>
    </div>
  );
}
