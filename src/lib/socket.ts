// One live connection for the whole app. Screens get a "scoped" handle: their
// listeners are tracked, and disconnect() only removes those listeners, so moving
// between screens never tears down and rebuilds the connection.
import { io, type Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";

type Listener = (...args: never[]) => void;

let shared: Socket | null = null;
let sharedToken = "";

function connection() {
  const token = getToken();
  if (!shared || sharedToken !== token) {
    shared?.disconnect();
    shared = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    sharedToken = token;
  }
  return shared;
}

/** Close the shared connection (used on sign-out). */
export function closeSocket() {
  shared?.disconnect();
  shared = null;
  sharedToken = "";
}

export type ScopedSocket = {
  readonly connected: boolean;
  on: (event: string, listener: Listener) => ScopedSocket;
  off: (event: string, listener?: Listener) => ScopedSocket;
  emit: (event: string, ...args: unknown[]) => ScopedSocket;
  disconnect: () => void;
};

export function scopedSocket(): ScopedSocket {
  const socket = connection();
  const mine: [string, Listener][] = [];
  const handle: ScopedSocket = {
    get connected() {
      return socket.connected;
    },
    on(event, listener) {
      mine.push([event, listener]);
      socket.on(event, listener as never);
      // A screen opened after the connection is up still wants its "connect" callback.
      if (event === "connect" && socket.connected) queueMicrotask(() => (listener as () => void)());
      return handle;
    },
    off(event, listener) {
      for (let i = mine.length - 1; i >= 0; i -= 1) {
        const [name, fn] = mine[i];
        if (name === event && (!listener || fn === listener)) {
          socket.off(name, fn as never);
          mine.splice(i, 1);
        }
      }
      return handle;
    },
    emit(event, ...args) {
      socket.emit(event, ...args);
      return handle;
    },
    disconnect() {
      mine.splice(0).forEach(([name, fn]) => socket.off(name, fn as never));
    },
  };
  return handle;
}
