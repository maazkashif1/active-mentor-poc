import api from '../config/api';

export const listThreads = () => api.get('/chat/threads').then(r => r.data);

export const openThreadWithPhysio = (physiologistId: string) =>
  api.post('/chat/threads', { physiologistId }).then(r => r.data);

export const getMessages = (threadId: string, before?: string) =>
  api
    .get(`/chat/threads/${threadId}/messages`, { params: { limit: 50, before } })
    .then(r => r.data);

export const sendMessageHttp = (threadId: string, body: string) =>
  api.post(`/chat/threads/${threadId}/messages`, { body }).then(r => r.data);

export const markThreadRead = (threadId: string) =>
  api.patch(`/chat/threads/${threadId}/read`).then(r => r.data);
