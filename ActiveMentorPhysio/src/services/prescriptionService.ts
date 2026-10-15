import api from '../config/api';

export const getMyPrescriptions = () => api.get('/prescriptions/mine').then(r => r.data);

export const submitResult = (
  prescriptionId: string,
  reps: number,
  score: number,
  assistedReps = 0,
  originalTargetAngle?: number,
  adaptedTargetAngle?: number,
  repPeakAngles?: number[],
  adaptationEvents?: Array<{ timestamp: number; from: number; to: number; reason: string }>,
  restAngle?: number,
  restCalibrated?: boolean,
  videoUrl?: string,
) =>
  api.post('/results', {
    prescriptionId, reps, score, assistedReps,
    originalTargetAngle, adaptedTargetAngle, repPeakAngles, adaptationEvents,
    restAngle, restCalibrated, videoUrl,
  }).then(r => r.data);

export const uploadVideoToR2 = async (videoPath: string): Promise<string> => {
  const { data } = await api.get('/upload/presigned?ext=mp4');
  const { uploadUrl, videoUrl } = data as { uploadUrl: string; videoUrl: string };

  const uri = videoPath.startsWith('file://') ? videoPath : `file://${videoPath}`;
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();

  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'video/mp4' },
  });

  return videoUrl;
};
