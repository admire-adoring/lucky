import { useEffect } from 'react'

/** 同步 document.title（原型每个页面各自设置） */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
