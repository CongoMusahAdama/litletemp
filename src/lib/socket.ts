// Live updates through Ably (the backend runs on Vercel, which can't hold sockets).
// Screens use the same small API the Socket.IO client had: on / off / emit /
// disconnect. Each screen's listeners are tracked so disconnect() only removes
// its own, and the one shared connection stays up while you move around.
import * as Ably from "ably";
import { api, getToken } from "./api";

type Listener = (...args: never[]) => void;
type TokenResponse = { tokenRequest: Ably.TokenRequest; userId: string; coupleId: string };
type Live = { client: Ably.Realtime; couple: Ably.RealtimeChannel; user: Ably.RealtimeChannel; me: string };

const listeners = new Map<string, Set<Listener>>();
let live: Live | null = null;
let starting: Promise<Live | null> | null = null;
let startedFor = "";

function dispatch(event: string, ...args: unknown[]) {
  listeners.get(event)?.forEach((listener) => {
    try {
      (listener as (...values: unknown[]) => void)(...args);
    } catch {
      // One screen's handler failing shouldn't stop the others.
    }
  });
}

function start(): Promise<Live | null> {
  const token = getToken();
  if (!token) return Promise.resolve(null);
  if (starting && startedFor === token) return starting;
  closeSocket();
  startedFor = token;
  starting = (async () => {
    const info = await api<TokenResponse>("/api/realtime/token");
    const me = info.userId;
    let first: TokenResponse | null = info;
    const client = new Ably.Realtime({
      // Don't send our own typing / call messages back to us (like socket.to(room)).
      echoMessages: false,
      authCallback: (_params, callback) => {
        const ready = first;
        first = null;
        (ready ? Promise.resolve(ready) : api<TokenResponse>("/api/realtime/token"))
          .then((response) => callback(null, response.tokenRequest))
          .catch((error) => callback(error instanceof Error ? error.message : "Live updates unavailable", null));
      },
    });
    const couple = client.channels.get(`couple:${info.coupleId}`);
    const user = client.channels.get(`user:${me}`);
    const onMessage = (message: Ably.InboundMessage) => { if (message.name) dispatch(message.name, message.data); };
    couple.subscribe(onMessage);
    user.subscribe(onMessage);
    couple.presence.subscribe((member) => {
      dispatch("presence", { userId: member.clientId, online: member.action !== "leave" && member.action !== "absent" });
    });
    couple.presence.enter().catch(() => undefined);
    client.connection.on((change) => {
      if (change.current === "connected") dispatch("connect");
      if (["disconnected", "suspended", "failed", "closed"].includes(change.current)) dispatch("disconnect");
    });
    live = { client, couple, user, me };
    return live;
  })().catch(() => {
    // Live updates not set up (or offline): the app still works, just without them.
    starting = null;
    return null;
  });
  return starting;
}

/** Close the shared connection (used on sign-out). */
export function closeSocket() {
  live?.client.close();
  live = null;
  starting = null;
  startedFor = "";
}

export type ScopedSocket = {
  readonly connected: boolean;
  on: (event: string, listener: Listener) => ScopedSocket;
  off: (event: string, listener?: Listener) => ScopedSocket;
  emit: (event: string, ...args: unknown[]) => ScopedSocket;
  disconnect: () => void;
};

// Things the app used to send over the socket now go to the API or to Ably.
async function send(event: string, args: unknown[]) {
  if (event === "message:send") {
    const [body, ack] = args as [unknown, ((result: unknown) => void) | undefined];
    try {
      const message = await api("/api/chat/messages", { method: "POST", body: JSON.stringify(body) });
      ack?.({ message });
    } catch (error) {
      ack?.({ error: error instanceof Error ? error.message : "Could not send" });
    }
    return;
  }
  if (event.startsWith("game:")) {
    await api("/api/games/play", { method: "POST", body: JSON.stringify({ action: event.slice(5), value: args[0] }) }).catch(() => undefined);
    return;
  }
  const connection = await start();
  if (!connection) return;
  if (event === "typing") {
    connection.couple.publish("typing", { userId: connection.me, isTyping: Boolean(args[0]) }).catch(() => undefined);
  } else if (event === "call:signal") {
    connection.couple.publish("call:signal", { from: connection.me, ...(args[0] as object) }).catch(() => undefined);
  } else if (event === "presence:check") {
    const members = await connection.couple.presence.get().catch(() => []);
    const others = members.filter((member) => member.clientId !== connection.me);
    if (others.length) others.forEach((member) => dispatch("presence", { userId: member.clientId, online: true }));
    else dispatch("presence", { userId: "partner", online: false });
  }
}

export function scopedSocket(): ScopedSocket {
  void start();
  const mine: [string, Listener][] = [];
  const handle: ScopedSocket = {
    get connected() {
      return live?.client.connection.state === "connected";
    },
    on(event, listener) {
      mine.push([event, listener]);
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(listener);
      // A screen opened after the connection is up still wants its "connect" callback.
      if (event === "connect" && handle.connected) queueMicrotask(() => (listener as () => void)());
      return handle;
    },
    off(event, listener) {
      for (let i = mine.length - 1; i >= 0; i -= 1) {
        const [name, fn] = mine[i];
        if (name === event && (!listener || fn === listener)) {
          listeners.get(name)?.delete(fn);
          mine.splice(i, 1);
        }
      }
      return handle;
    },
    emit(event, ...args) {
      void send(event, args);
      return handle;
    },
    disconnect() {
      mine.splice(0).forEach(([name, fn]) => listeners.get(name)?.delete(fn));
    },
  };
  return handle;
}
