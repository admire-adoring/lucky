import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/**
 * 项目目录里的 HTML —— 流程图 / 架构图那一类产物。
 *
 * 它们不被搬进库、也不走前端路由：正文就是那个 html 文件（用户用 mermaid / draw.io /
 * 手写画的，内联脚本与相对资源都在里面）。应用只负责"列出来"与"开个独立窗口加载它"。
 */
export interface ProjectHtmlFile {
  /** 相对项目目录的路径，原样传回给 `openProjectHtml` */
  rel: string
  name: string
  size: number
  /** 修改时刻（Unix 秒）。格式化交前端 —— `new Date(secs * 1000)` 才是本地时区 */
  mtime: number
}

export function listProjectHtml(projectId: string): Promise<ProjectHtmlFile[]> {
  return call(() => invoke<ProjectHtmlFile[]>('project_html_list', { projectId }))
}

export function openProjectHtml(projectId: string, rel: string): Promise<void> {
  return call(() => invoke('project_html_open', { projectId, rel }))
}
