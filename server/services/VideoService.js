const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs');

// Configure fluent-ffmpeg to use the bundled static binaries
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

class VideoService {
  /**
   * Probe video metadata
   * @param {string} inputPath
   * @returns {Promise<object>} video metadata
   */
  static probe(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate),
            bitrate: videoStream.bit_rate,
            pixelFormat: videoStream.pix_fmt,
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            sampleRate: audioStream.sample_rate,
            channels: audioStream.channels,
            bitrate: audioStream.bit_rate,
          } : null,
        });
      });
    });
  }

  /**
   * Transcode video with full parameter control
   * @param {string} inputPath
   * @param {string} outputPath
   * @param {object} options
   * @param {function} onProgress - progress callback (0-100)
   */
  static transcode(inputPath, outputPath, options = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Output format
      if (options.format) {
        const ext = options.format;
        // Update output path extension
        const dir = path.dirname(outputPath);
        const base = path.basename(outputPath, path.extname(outputPath));
        outputPath = path.join(dir, `${base}.${ext}`);
        command = command.format(ext);
      }

      // Video codec
      if (options.videoCodec) {
        command = command.videoCodec(options.videoCodec);
      }

      // Audio codec
      if (options.audioCodec) {
        if (options.audioCodec === 'copy') {
          command = command.audioCodec('copy');
        } else {
          command = command.audioCodec(options.audioCodec);
        }
      }

      // Video bitrate
      if (options.videoBitrate) {
        command = command.videoBitrate(options.videoBitrate);
      }

      // Audio bitrate
      if (options.audioBitrate) {
        command = command.audioBitrate(options.audioBitrate);
      }

      // Frame rate
      if (options.fps) {
        command = command.fps(options.fps);
      }

      // Resolution
      if (options.width && options.height) {
        command = command.size(`${options.width}x${options.height}`);
      } else if (options.resolution) {
        // Preset resolutions
        const presets = {
          '4k': '3840x2160',
          '1080p': '1920x1080',
          '720p': '1280x720',
          '480p': '854x480',
        };
        if (presets[options.resolution]) {
          command = command.size(presets[options.resolution]);
        }
      }

      // Progress tracking
      command
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  /**
   * Extract frames from video as image sequence
   * @param {string} inputPath
   * @param {string} outputDir
   * @param {object} options - fps, format (png/jpg), quality, startTime, duration, width
   * @param {function} onProgress
   */
  static extractFrames(inputPath, outputDir, options = {}, onProgress = null) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const format = options.format || 'png';
    const outputPattern = path.join(outputDir, `frame-%04d.${format}`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Time range
      if (options.startTime) {
        command = command.setStartTime(options.startTime);
      }
      if (options.duration) {
        command = command.setDuration(options.duration);
      }

      // Frame rate
      if (options.fps) {
        command = command.fps(options.fps);
      }

      // Size
      if (options.width) {
        command = command.size(`${options.width}x?`);
      }

      // Quality for jpg
      if (format === 'jpg' && options.quality) {
        command = command.outputOptions([`-q:v ${Math.round((100 - options.quality) / 100 * 31)}`]);
      }

      command
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          // Count generated frames
          const files = fs.readdirSync(outputDir).filter(f => f.startsWith('frame-'));
          resolve({ outputDir, frameCount: files.length });
        })
        .on('error', (err) => reject(err))
        .save(outputPattern);
    });
  }

  /**
   * Convert video to GIF with palette optimization
   * @param {string} inputPath
   * @param {string} outputPath
   * @param {object} options - width, fps, startTime, duration, colors, loop
   * @param {function} onProgress
   */
  static toGif(inputPath, outputPath, options = {}, onProgress = null) {
    const width = options.width || 480;
    const fps = options.fps || 15;
    const colors = options.colors || 256;

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Time range
      if (options.startTime) {
        command = command.setStartTime(options.startTime);
      }
      if (options.duration) {
        command = command.setDuration(options.duration);
      }

      // Use palette generation for better quality
      const filterComplex = [
        `fps=${fps}`,
        `scale=${width}:-1:flags=lanczos`,
        `split[s0][s1]`,
        `[s0]palettegen=max_colors=${colors}[p]`,
        `[s1][p]paletteuse=dither=bayer:bayer_scale=5`
      ].join(',');

      // Loop control (-1 = no loop, 0 = infinite)
      const loop = options.loop !== undefined ? options.loop : 0;

      command
        .complexFilter(filterComplex)
        .outputOptions([`-loop ${loop}`])
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }
}

module.exports = VideoService;
