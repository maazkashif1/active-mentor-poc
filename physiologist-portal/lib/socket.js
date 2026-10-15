'use client';
import { io } from 'socket.io-client';
import { getToken } from './api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let socket = null;

export function getSocket() {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  if (!token) return null;

  if (socket?.connected) return socket;

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(BASE, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
