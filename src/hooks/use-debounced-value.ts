import { useEffect, useState } from 'react'

/** 160ms 防抖（与原型搜索一致） */
export function useDebouncedValue<T>(value: T, delay = 160): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
