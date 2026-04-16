import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 600000, // 10min for large files
});

// --- Video APIs ---

export async function probeVideo(file) {
  const formData = new FormData();
  formData.append('video', file);
  const res = await api.post('/video/probe', formData);
  return res.data;
}

export async function transcodeVideo(file, options, onUploadProgress) {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('options', JSON.stringify(options));
  const res = await api.post('/video/transcode', formData, { onUploadProgress });
  return res.data;
}

export async function extractFrames(file, options, onUploadProgress) {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('options', JSON.stringify(options));
  const res = await api.post('/video/extract-frames', formData, { onUploadProgress });
  return res.data;
}

export async function videoToGif(file, options, onUploadProgress) {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('options', JSON.stringify(options));
  const res = await api.post('/video/to-gif', formData, { onUploadProgress });
  return res.data;
}

export async function getTaskProgress(taskId) {
  const res = await api.get(`/progress/${taskId}`);
  return res.data;
}

// --- Image APIs ---

export async function getImageMetadata(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await api.post('/image/metadata', formData);
  return res.data;
}

export async function convertImage(file, options) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('options', JSON.stringify(options));
  const res = await api.post('/image/convert', formData);
  return res.data;
}

export async function stitchImages(files, options) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  Object.entries(options).forEach(([key, val]) => {
    formData.append(key, val);
  });
  const res = await api.post('/image/stitch', formData);
  return res.data;
}

export async function splitImage(file, options) {
  const formData = new FormData();
  formData.append('image', file);
  Object.entries(options).forEach(([key, val]) => {
    formData.append(key, val);
  });
  const res = await api.post('/image/split', formData);
  return res.data;
}

export function getDownloadUrl(filename) {
  return `/api/download/${filename}`;
}

export default api;
