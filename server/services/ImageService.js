const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const heicConvert = require('heic-convert');

class ImageService {
  /**
   * Internal helper to make input compatible with Sharp (converts HEIC to PNG Buffer if needed)
   * @param {string} inputPath
   * @returns {Promise<string|Buffer>} Path or Buffer compatible with Sharp
   */
  static async getCompatibleInput(inputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext === '.heic' || ext === '.heif') {
      try {
        console.log(`[DEBUG] Converting HEIC: ${inputPath}`);
        const inputBuffer = fs.readFileSync(inputPath);
        console.log(`[DEBUG] Input Buffer Size: ${inputBuffer.length} bytes`);

        // Convert HEIC to PNG buffer
        const outputBuffer = await heicConvert({
          buffer: inputBuffer,
          format: 'PNG'
        });

        console.log(`[DEBUG] Conversion SUCCESS: ${outputBuffer.length} bytes`);
        return outputBuffer;
      } catch (err) {
        console.error(`[DEBUG] Conversion FAILED:`, err);
        throw new Error(`HEIC conversion failed: ${err.message}`);
      }
    }
    return inputPath;
  }

  /**
   * Get image metadata
   * @param {string} inputPath
   * @returns {Promise<object>}
   */
  static async getMetadata(inputPath) {
    const input = await this.getCompatibleInput(inputPath);
    const metadata = await sharp(input).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      channels: metadata.channels,
      space: metadata.space,
      density: metadata.density,
      size: metadata.size,
      hasAlpha: metadata.hasAlpha,
    };
  }

  /**
   * Convert image format, resolution, and quality
   * @param {string} inputPath
   * @param {string} outputPath
   * @param {object} options - format, width, height, quality, fit, dpi
   */
  static async processImage(inputPath, outputPath, options = {}) {
    const input = await this.getCompatibleInput(inputPath);
    let pipeline = sharp(input);

    // Resize
    if (options.width || options.height) {
      pipeline = pipeline.resize(
        options.width ? parseInt(options.width) : null,
        options.height ? parseInt(options.height) : null,
        {
          fit: options.fit || 'inside',
          withoutEnlargement: options.withoutEnlargement !== false,
        }
      );
    }

    // Determine output format
    const format = options.format || path.extname(outputPath).slice(1) || 'jpeg';
    const quality = parseInt(options.quality) || 80;

    // Update output path with correct extension
    const dir = path.dirname(outputPath);
    const base = path.basename(outputPath, path.extname(outputPath));
    const extMap = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', tiff: 'tiff', heic: 'heic', heif: 'heif' };
    const ext = extMap[format] || format;
    outputPath = path.join(dir, `${base}.${ext}`);

    // Format-specific options
    const formatOptions = { quality };
    if (format === 'png') {
      formatOptions.compressionLevel = Math.round((100 - quality) / 100 * 9);
      delete formatOptions.quality;
    }

    // HEIC uses the 'heif' format in Sharp with AV1 compression
    let sharpFormat = format;
    if (format === 'heic') {
      sharpFormat = 'heif';
      formatOptions.compression = 'av1';
    }

    // DPI
    if (options.dpi) {
      pipeline = pipeline.withMetadata({ density: parseInt(options.dpi) });
    }

    await pipeline
      .toFormat(sharpFormat, formatOptions)
      .toFile(outputPath);

    return outputPath;
  }

  /**
   * Stitch multiple images together
   * @param {string[]} inputPaths
   * @param {string} outputPath
   * @param {object} options - direction, gap, backgroundColor, align, format
   */
  static async stitchImages(inputPaths, outputPath, options = {}) {
    if (!inputPaths || inputPaths.length === 0) {
      throw new Error('No images provided for stitching');
    }

    const direction = options.direction || 'vertical';
    const gap = parseInt(options.gap) || 0;
    const align = options.align || 'center';

    // Parse background color
    let background = { r: 0, g: 0, b: 0, alpha: 0 };
    if (options.backgroundColor && options.backgroundColor !== 'transparent') {
      if (options.backgroundColor === 'white') {
        background = { r: 255, g: 255, b: 255, alpha: 1 };
      } else if (options.backgroundColor === 'black') {
        background = { r: 0, g: 0, b: 0, alpha: 1 };
      } else if (options.backgroundColor.startsWith('#')) {
        const hex = options.backgroundColor.replace('#', '');
        background = {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
          alpha: 1,
        };
      }
    }

    const targetWidth = parseInt(options.targetWidth) || 0;

    // Read all image metadata and optionally resize to target width
    const images = await Promise.all(
      inputPaths.map(async (p) => {
        const input = await this.getCompatibleInput(p);
        const metadata = await sharp(input).metadata();
        let width = metadata.width;
        let height = metadata.height;

        // If targetWidth is specified, resize proportionally
        if (targetWidth > 0) {
          const scale = targetWidth / width;
          height = Math.round(height * scale);
          width = targetWidth;
          // Write resized image to a temp file
          const ext = path.extname(p);
          const resizedPath = p.replace(ext, `_resized${ext}`);
          await sharp(input).resize(width, height).toFile(resizedPath);
          return { path: resizedPath, width, height, tempPath: resizedPath };
        }
        return { path: input, width, height, isBuffer: Buffer.isBuffer(input) };
      })
    );

    // Calculate canvas dimensions
    let totalWidth, totalHeight;

    if (direction === 'vertical') {
      totalWidth = Math.max(...images.map(img => img.width));
      totalHeight = images.reduce((sum, img) => sum + img.height, 0) + gap * (images.length - 1);
    } else {
      totalWidth = images.reduce((sum, img) => sum + img.width, 0) + gap * (images.length - 1);
      totalHeight = Math.max(...images.map(img => img.height));
    }

    // Compute composite positions
    const compositeOptions = [];
    let currentX = 0;
    let currentY = 0;

    for (const img of images) {
      let left = currentX;
      let top = currentY;

      // Alignment
      if (direction === 'vertical') {
        if (align === 'center') left = Math.round((totalWidth - img.width) / 2);
        else if (align === 'right') left = totalWidth - img.width;
        else left = 0;
      } else {
        if (align === 'center') top = Math.round((totalHeight - img.height) / 2);
        else if (align === 'bottom') top = totalHeight - img.height;
        else top = 0;
      }

      compositeOptions.push({
        input: img.path,
        top: direction === 'vertical' ? currentY : top,
        left: direction === 'vertical' ? left : currentX,
      });

      if (direction === 'vertical') {
        currentY += img.height + gap;
      } else {
        currentX += img.width + gap;
      }
    }

    // Determine output format
    const format = options.format || 'png';
    const dir = path.dirname(outputPath);
    const base = path.basename(outputPath, path.extname(outputPath));
    outputPath = path.join(dir, `${base}.${format}`);

    await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background,
      }
    })
      .composite(compositeOptions)
      .toFormat(format, { quality: 90 })
      .toFile(outputPath);

    // Clean up temporary resized images
    for (const img of images) {
      if (img.tempPath) {
        try { fs.unlinkSync(img.tempPath); } catch (_) {}
      }
    }

    return outputPath;
  }

  /**
   * Split an image into multiple pieces based on height/width limit
   * @param {string} inputPath
   * @param {string} outputDir
   * @param {object} options - direction, limit, format
   * @returns {Promise<Array>} List of generated image info
   */
  static async splitImage(inputPath, outputDir, options = {}) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const input = await this.getCompatibleInput(inputPath);
    const metadata = await sharp(input).metadata();
    const totalWidth = metadata.width;
    const totalHeight = metadata.height;
    const direction = options.direction || 'vertical';
    const limit = parseInt(options.limit) || 1000;
    const format = options.format || metadata.format || 'png';

    const results = [];
    let sliceCount = 0;

    if (direction === 'vertical') {
      sliceCount = Math.ceil(totalHeight / limit);
      for (let i = 0; i < sliceCount; i++) {
        const top = i * limit;
        const currentHeight = Math.min(limit, totalHeight - top);
        const filename = `split-${i + 1}.${format}`;
        const outputPath = path.join(outputDir, filename);

        await sharp(input)
          .extract({ left: 0, top: top, width: totalWidth, height: currentHeight })
          .toFormat(format, { quality: 90 })
          .toFile(outputPath);

        const stats = fs.statSync(outputPath);
        results.push({
          filename,
          url: `${options.baseUrl || ''}/${filename}`,
          width: totalWidth,
          height: currentHeight,
          size: stats.size,
        });
      }
    } else {
      sliceCount = Math.ceil(totalWidth / limit);
      for (let i = 0; i < sliceCount; i++) {
        const left = i * limit;
        const currentWidth = Math.min(limit, totalWidth - left);
        const filename = `split-${i + 1}.${format}`;
        const outputPath = path.join(outputDir, filename);

        await sharp(input)
          .extract({ left: left, top: 0, width: currentWidth, height: totalHeight })
          .toFormat(format, { quality: 90 })
          .toFile(outputPath);

        const stats = fs.statSync(outputPath);
        results.push({
          filename,
          url: `${options.baseUrl || ''}/${filename}`,
          width: currentWidth,
          height: totalHeight,
          size: stats.size,
        });
      }
    }

    return results;
  }
}

module.exports = ImageService;
