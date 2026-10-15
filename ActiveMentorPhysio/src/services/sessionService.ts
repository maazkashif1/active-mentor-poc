import api from '../config/api';

export const getPhysiologists = () => api.get('/physiologist/all').then(r => r.data);

export const getSlots = (physiologistId: string) =>
  api.get(`/physiologist/slots/${physiologistId}`).then(r => r.data);

export const bookSession = (physiologistId: string, slotDate: string, slotTime: string, complaints: string) =>
  api.post('/sessions/book', { physiologistId, slotDate, slotTime, complaints }).then(r => r.data);

export const getMySessions = () => api.get('/sessions/my').then(r => r.data);

export const getSession = (id: string) => api.get(`/sessions/${id}`).then(r => r.data);
