import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VideoTranscode from './pages/VideoTranscode';
import VideoFrames from './pages/VideoFrames';
import ImageConvert from './pages/ImageConvert';
import ImageStitch from './pages/ImageStitch';
import ImageSplit from './pages/ImageSplit';
import Diagnostics from './pages/Diagnostics';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/video/transcode" element={<VideoTranscode />} />
          <Route path="/video/frames" element={<VideoFrames />} />
          <Route path="/image/convert" element={<ImageConvert />} />
          <Route path="/image/stitch" element={<ImageStitch />} />
          <Route path="/image/split" element={<ImageSplit />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
