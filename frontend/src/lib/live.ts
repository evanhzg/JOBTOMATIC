// Live updates: one WebSocket shared by the whole app, with auto-reconnect.
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api";

type Listener = (type: string, data: any) => void;
const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let connected = false;
const connListeners = new Set<(c: boolean) => void>();

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${proto}://${location.host}/ws`);
  socket.onopen = () => {
    connected = true;
    connListeners.forEach((l) => l(true));
    listeners.forEach((l) => l("reconnected", null));
  };
  socket.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      listeners.forEach((l) => l(m.type, m.data));
    } catch {
      /* ignore */
    }
  };
  socket.onclose = () => {
    connected = false;
    connListeners.forEach((l) => l(false));
    setTimeout(connect, 2500);
  };
}

export function useEvents(fn: Listener) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!socket) connect();
    const l: Listener = (t, d) => ref.current(t, d);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}

export function useConnected() {
  const [c, setC] = useState(connected);
  useEffect(() => {
    connListeners.add(setC);
    return () => {
      connListeners.delete(setC);
    };
  }, []);
  return c;
}

/** Fetch `path`, refetch when one of `events` arrives (debounced) and every `pollMs`. */
export function useLive<T>(path: string | null, events: string[], pollMs = 60000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const load = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [path]);
  useEffect(() => {
    load();
    const id = window.setInterval(load, pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);
  useEvents((type) => {
    if (events.includes(type) || type === "reconnected") {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(load, 350);
    }
  });
  return { data, error, reload: load, setData };
}
