import { create } from 'zustand';

interface ToastState {
  message: string | null;
  serial: number;
}
export const useToast = create<ToastState>(() => ({ message: null, serial: 0 }));

let timer: number | undefined;
export function toast(message: string, ms = 2600): void {
  window.clearTimeout(timer);
  useToast.setState((s) => ({ message, serial: s.serial + 1 }));
  timer = window.setTimeout(() => useToast.setState({ message: null }), ms);
}
