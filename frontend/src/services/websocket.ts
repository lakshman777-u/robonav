type WSCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private backoffBase = 1000;
  private handlers = new Map<string, WSCallback[]>();
  private state: 'connecting' | 'connected' | 'disconnected' = 'disconnected';

  connect(token: string) {
    if (this.state === 'connected' || this.state === 'connecting') return;
    this.token = token;
    this.state = 'connecting';
    this.initWs();
  }

  private initWs() {
    if (!this.token) return;

    // Check if running on GitHub Pages or static host without local backend
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const env = (import.meta as any).env || {};
    const hasCustomWs = !!env.VITE_WS_URL;
    if (!isLocal && !hasCustomWs) {
      this.state = 'disconnected';
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = env.VITE_WS_URL || `${protocol}//${host}/ws/browser?token=${this.token}`;
    
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.state = 'disconnected';
      return;
    }

    this.ws.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempts = 0;
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        if (type && this.handlers.has(type)) {
          this.handlers.get(type)!.forEach(cb => cb(data));
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    this.ws.onclose = () => {
      this.state = 'disconnected';
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error', error);
      this.ws?.close();
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const timeout = Math.min(this.backoffBase * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => {
        this.reconnectAttempts++;
        this.initWs();
      }, timeout);
    } else {
      console.error('Max WebSocket reconnect attempts reached.');
    }
  }

  onMessage(type: string, callback: WSCallback) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(callback);
  }

  offMessage(type: string, callback: WSCallback) {
    if (this.handlers.has(type)) {
      this.handlers.set(type, this.handlers.get(type)!.filter(cb => cb !== callback));
    }
  }

  send(message: object) {
    if (this.state === 'connected' && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message, WebSocket not connected');
    }
  }

  disconnect() {
    this.state = 'disconnected';
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getState() {
    return this.state;
  }
}

export const wsService = new WebSocketService();
