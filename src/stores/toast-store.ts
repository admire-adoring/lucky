import { create } from 'zustand'
import type { Toast } from '../types'

interface ToastState {
  toasts: Toast[]
  push: (message: string) => void
  dismiss: (id: number) => void
}

let seq = 0

/**
 * 顶部居中的轻量提示；v1.0 里所有「范围外」的操作都用它反馈。
 * 展示时长与退场节奏由 <ToastHost> 里的单条组件负责（2100ms 显示 + 260ms 退场），
 * store 只维护列表，不持有计时器。
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message) => {
    seq += 1
    const id = seq
    set((state) => ({ toasts: [...state.toasts, { id, message }] }))
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}))

/** 组件外调用（事件处理器里懒取，避免为提示订阅整个组件树） */
export function toast(message: string): void {
  useToastStore.getState().push(message)
}
