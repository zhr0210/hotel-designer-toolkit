const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const VideoService = require('./services/VideoService');
const ImageService = require('./services/ImageService');

const app = express();
const port = 3001;

// --- Logger Utility ---
// Use dynamic absolute path set by Electron (or fallback for dev)
const ERROR_LOG_PATH = process.env.LOG_DIR 
  ? path.join(process.env.LOG_DIR, 'error.log') 
  : path.resolve(__dirname, 'logs/error.log');

function logError(err, req = null) {
  const timestamp = new Date().toISOString();
  let message = `[${timestamp}] ERROR: ${err.message}\n`;
  if (req) {
    message += `  Path: ${req.method} ${req.originalUrl}\n`;
    message += `  IP: ${req.ip}\n`;
  }
  if (err.stack) {
    message += `  Stack: ${err.stack}\n`;
  }
  message += `${'='.repeat(50)}\n\n`;

  // Always output to console for real-time visibility in tools
  console.error('\n' + '!'.repeat(20) + ' [LOGGED ERROR] ' + '!'.repeat(20));
  console.error(message);
  console.error('!'.repeat(56) + '\n');

  try {
    if (!fs.existsSync(path.dirname(ERROR_LOG_PATH))) {
      fs.mkdirSync(path.dirname(ERROR_LOG_PATH), { recursive: true });
    }
    fs.appendFileSync(ERROR_LOG_PATH, message);
  } catch (logErr) {
    console.error('CRITICAL: Failed to write to log file:', logErr.message);
  }
}

// Startup log check
try {
  fs.appendFileSync(ERROR_LOG_PATH, `[${new Date().toISOString()}] Server logging system initialized.\n`);
  console.log('  → Logger: OK (Logs at ' + ERROR_LOG_PATH + ')');
} catch (e) {
  console.error('  → Logger: FAILED (' + e.message + ')');
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- File Upload Config ---
// In Electron production, use the appData path passed via process.env.UPLOAD_DIR
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    let safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Truncate to avoid ENAMETOOLONG if original filename was very long or contained many multibyte chars
    if (safeName.length > 100) {
      const ext = path.extname(safeName);
      const name = path.basename(safeName, ext);
      safeName = name.slice(0, 100 - ext.length) + ext;
    }
    cb(null, `${uuidv4()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// --- Progress Tracking ---
const taskProgress = new Map();

function setProgress(taskId, percent, status = 'processing') {
  taskProgress.set(taskId, { percent, status, updatedAt: Date.now() });
}

// Clean stale tasks every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, task] of taskProgress) {
    if (now - task.updatedAt > 30 * 60 * 1000) {
      taskProgress.delete(id);
    }
  }
}, 10 * 60 * 1000);

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Progress Endpoint ---
app.get('/api/progress/:taskId', (req, res) => {
  const task = taskProgress.get(req.params.taskId);
  if (!task) {
    return res.json({ percent: 0, status: 'unknown' });
  }
  res.json(task);
});

// ==========================================
// VIDEO ROUTES
// ==========================================

/**
 * POST /api/video/probe
 * Get video metadata
 */
app.post('/api/video/probe', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }
    const metadata = await VideoService.probe(req.file.path);
    res.json({ success: true, data: metadata, filename: req.file.originalname });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/video/transcode
 * Transcode video with options: format, videoCodec, videoBitrate, audioCodec, fps, resolution, width, height
 */
app.post('/api/video/transcode', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const taskId = uuidv4();
    const options = JSON.parse(req.body.options || '{}');
    const ext = options.format || 'mp4';
    const outputName = `transcoded-${taskId}.${ext}`;
    const outputPath = path.join(UPLOAD_DIR, outputName);

    setProgress(taskId, 0, 'processing');

    // Don't await — respond immediately with taskId
    VideoService.transcode(req.file.path, outputPath, options, (percent) => {
      setProgress(taskId, percent, 'processing');
    })
      .then((finalPath) => {
        const stats = fs.statSync(finalPath);
        setProgress(taskId, 100, 'done');
        taskProgress.set(taskId, {
          ...taskProgress.get(taskId),
          result: {
            url: `/uploads/${path.basename(finalPath)}`,
            filename: path.basename(finalPath),
            size: stats.size,
          },
        });
      })
      .catch((err) => {
        logError(err, req);
        setProgress(taskId, 0, 'error');
        taskProgress.set(taskId, {
          ...taskProgress.get(taskId),
          error: err.message,
        });
      });

    res.json({ success: true, taskId });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/video/extract-frames
 * Extract frames: fps, format (png/jpg), quality, startTime, duration, width
 */
app.post('/api/video/extract-frames', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const taskId = uuidv4();
    const options = JSON.parse(req.body.options || '{}');
    const outputDirName = `frames-${taskId}`;
    const outputDir = path.join(UPLOAD_DIR, outputDirName);

    setProgress(taskId, 0, 'processing');

    VideoService.extractFrames(req.file.path, outputDir, options, (percent) => {
      setProgress(taskId, percent, 'processing');
    })
      .then((result) => {
        setProgress(taskId, 100, 'done');
        taskProgress.set(taskId, {
          ...taskProgress.get(taskId),
          result: {
            dir: `/uploads/${outputDirName}`,
            frameCount: result.frameCount,
          },
        });
      })
      .catch((err) => {
        logError(err, req);
        setProgress(taskId, 0, 'error');
        taskProgress.set(taskId, {
          ...taskProgress.get(taskId),
          error: err.message,
        });
      });

    res.json({ success: true, taskId });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/video/to-gif
 * Convert to GIF: width, fps, startTime, duration, colors, loop
 */
app.post('/api/video/to-gif', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const taskId = uuidv4();
    const options = JSON.parse(req.body.options || '{}');
    const outputName = `gif-${taskId}.gif`;
    const outputPath = path.join(UPLOAD_DIR, outputName);

    setProgress(taskId, 0, 'processing');

    VideoService.toGif(req.file.path, outputPath, options, (percent) => {
      setProgress(taskId, percent, 'processing');
    })
      .then(() => {
        const stats = fs.statSync(outputPath);
        setProgress(taskId, 100, 'done');
        taskProgress.set(taskId, {
          ...taskProgress.get(taskId),
          result: {
            url: `/uploads/${outputName}`,
            filename: outputName,
            size: stats.size,
          },
        });
      })
      .catch((err) => {
        logError(err, req);
        setProgress(taskId, 0, 'error');
        taskProgress.set(taskId, {
          ...taskProgress.get(taskId),
          error: err.message,
        });
      });

    res.json({ success: true, taskId });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// IMAGE ROUTES
// ==========================================

/**
 * POST /api/image/metadata
 * Get image metadata
 */
app.post('/api/image/metadata', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }
    const metadata = await ImageService.getMetadata(req.file.path);
    res.json({ success: true, data: metadata, filename: req.file.originalname });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image/convert
 * Convert image: format, width, height, quality, fit, dpi
 */
app.post('/api/image/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const options = JSON.parse(req.body.options || '{}');
    const ext = options.format || 'jpg';
    const outputName = `converted-${uuidv4()}.${ext}`;
    const outputPath = path.join(UPLOAD_DIR, outputName);

    const finalPath = await ImageService.processImage(req.file.path, outputPath, options);
    const stats = fs.statSync(finalPath);

    res.json({
      success: true,
      data: {
        url: `/uploads/${path.basename(finalPath)}`,
        filename: path.basename(finalPath),
        size: stats.size,
      },
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image/stitch
 * Stitch images: direction, gap, backgroundColor, align, format
 */
app.post('/api/image/stitch', upload.array('images', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ success: false, error: 'At least 2 images are required' });
    }

    const inputPaths = req.files.map(f => f.path);
    const options = {
      direction: req.body.direction || 'vertical',
      gap: req.body.gap || 0,
      backgroundColor: req.body.backgroundColor || 'transparent',
      align: req.body.align || 'center',
      format: req.body.format || 'png',
      targetWidth: req.body.targetWidth || 0,
    };
    const outputName = `stitched-${uuidv4()}.${options.format}`;
    const outputPath = path.join(UPLOAD_DIR, outputName);

    const finalPath = await ImageService.stitchImages(inputPaths, outputPath, options);
    const stats = fs.statSync(finalPath);

    res.json({
      success: true,
      data: {
        url: `/uploads/${path.basename(finalPath)}`,
        filename: path.basename(finalPath),
        size: stats.size,
      },
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image/split
 * Split image: direction, limit, format
 */
app.post('/api/image/split', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const options = {
      direction: req.body.direction || 'vertical',
      limit: parseInt(req.body.limit) || 1000,
      format: req.body.format || 'png',
    };

    const outputDirName = `split-${path.basename(req.file.path, path.extname(req.file.path))}`;
    const outputDir = path.join(UPLOAD_DIR, outputDirName);

    const splitResults = await ImageService.splitImage(req.file.path, outputDir, {
      ...options,
      baseUrl: `/uploads/${outputDirName}`,
    });

    res.json({
      success: true,
      data: {
        images: splitResults,
        count: splitResults.length,
        dir: `/uploads/${outputDirName}`,
      },
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// FILE MANAGEMENT
// ==========================================

/**
 * GET /api/download/:filename
 * Download a processed file
 */
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  res.download(filePath);
});

// Serve static uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// --- Global Error Handler ---
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  logError(err, req);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large, maximum 500MB' });
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`\n  ⚡ Media Toolkit API Server`);
  console.log(`  → http://localhost:${port}`);
  console.log(`  → Health: http://localhost:${port}/api/health\n`);
});
