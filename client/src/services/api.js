import { invoke, convertFileSrc } from '@tauri-apps/api/core';

// Helper to extract absolute path from File or string
async function getFilePath(file) {
  if (typeof file === 'string') return file;
  if (file && file.path) return file.path;
  // If no path is available (e.g. strict web context), we'd need to use Tauri Plugin Dialog.
  // For the sake of dropzone in Tauri, file.path is injected.
  throw new Error("Unable to retrieve file path safely. Please try selecting the file via the button instead of dragging if this fails continually.");
}

// --- Video APIs ---

export async function probeVideo(file) {
  const filePath = await getFilePath(file);
  const data = await invoke('probe_video', { filePath });
  return { success: true, data, filename: file.name || file };
}

export async function transcodeVideo(file, options, onUploadProgress) {
  // onUploadProgress is not native to invoke, but we can listen to events. 
  // We'll keep the signature and implement event listening later.
  const filePath = await getFilePath(file);
  const taskId = await invoke('transcode_video', { filePath, options });
  return { success: true, taskId };
}

export async function extractFrames(file, options, onUploadProgress) {
  const filePath = await getFilePath(file);
  const taskId = await invoke('extract_frames', { filePath, options });
  return { success: true, taskId };
}

export async function videoToGif(file, options, onUploadProgress) {
  const filePath = await getFilePath(file);
  const taskId = await invoke('video_to_gif', { filePath, options });
  return { success: true, taskId };
}

export async function getTaskProgress(taskId) {
  const data = await invoke('get_task_progress', { taskId });
  return data;
}

export async function openFolder(path) {
  await invoke('open_folder', { path });
}

export async function saveFile(sourcePath, filename) {
  await invoke('save_file', { sourcePath, filename });
}

// --- Image APIs ---

export async function getImageMetadata(file) {
  const filePath = await getFilePath(file);
  const data = await invoke('get_image_metadata', { filePath });
  return { success: true, data, filename: file.name || file };
}

export async function convertImage(file, options) {
  const filePath = await getFilePath(file);
  const data = await invoke('convert_image', { filePath, options });
  return { success: true, data };
}

export async function stitchImages(files, options) {
  const filePaths = await Promise.all(Array.from(files).map(f => getFilePath(f)));
  const data = await invoke('stitch_images', { filePaths, options });
  return { success: true, data };
}

export async function splitImage(file, options) {
  const filePath = await getFilePath(file);
  const data = await invoke('split_image', { filePath, options });
  return { success: true, data };
}

export async function runDiagnostics() {
  const data = await invoke('run_diagnostics');
  return { success: true, data };
}

export function getDownloadUrl(path) {
  if (!path) return '';
  return convertFileSrc(path);
}

export default {
  probeVideo, transcodeVideo, extractFrames, videoToGif, getTaskProgress, openFolder, saveFile,
  getImageMetadata, convertImage, stitchImages, splitImage, getDownloadUrl, runDiagnostics
};
