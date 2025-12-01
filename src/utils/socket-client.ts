// src/utils/socket-client.ts
import { io, Socket } from 'socket.io-client';

export class RealTimeReporter {
  private socket: Socket;
  private serverUrl: string;

  constructor(
    serverUrl: string = 'http://localhost:3000',
    auth?: { token?: string; workspaceId?: string },
    path: string = '/socket.io',
  ) {
    this.serverUrl = serverUrl;
    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      auth,
      path,
    });

    this.socket.on('connect', () => {
      console.log(`🔌 Socket connected to ${this.serverUrl} (path: ${path})`);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
    });
  }

  public reportLeak(data: any) {
    if (this.socket && this.socket.connected) {
      console.log('📡 Sending leak report via socket...');
      this.socket.emit('cli:leak_detected', data);
    } else {
      console.log('⚠️  Socket not connected. Cannot send report.');
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
