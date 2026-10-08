import { ProjectShelf } from '../project-detail/ProjectShelf'

/* ============================================================================
   学习模块的「实践项目」分区（`/learning/projects`）
   ----------------------------------------------------------------------------
   2026-09-27 按用户定的结构接上项目区：

     「工作区的项目依赖项目区／学习区的项目依赖项目区／项目区是整体全局的／
       工作区的项目和学习区的项目，布局一致，只是有个性」

   接入前这一格是原型的静态标记（`design/study/study_index.html`）：
   硬编 3 条项目名（「个人系统前端 / Vite 插件练习 / CSS 弥散风格组件库」）、
   点一下只弹一个空壳弹窗 —— 不读 `useProjects`、没有详情、与项目区的 8 条数据无关。
   照搬样本就是"编数字"（与 `ProjectDrawers` 文件头里对 work 样本的同一条取舍）。

   ============================================================================
   这一页只有三行，因为它与工作模块那一页是同一份版式
   ============================================================================
   版面全部来自 `components/workspace/project-detail/ProjectShelf.tsx`；
   这里只声明属于学习模块的三样：
     · `scope="learn"` —— `docs/模块设计.md` §4「学习项目，scope=learning」。
       文档里那个 `learning` 是模块名，项目上的 `scope` 字段取值是 `learn`
          （见 `types/index.ts` 的 `Scope`）。两处不是一个命名空间，别混。
     · 基路径 `/learning/projects` —— 与 `filterProjects` 里的 scope 无关，
       它只决定"点开抽屉去哪儿"，对应路由挂在 `App.tsx`。
     · 页头措辞「实践项目」。`.accent` 那两个字自动取学习模块的强调色
       （`--mw-m-main` 由 `data-module='learning'` 决定），这里不写颜色。

   详情页与工作模块那一份是同一个组件（`ProjectDetail.tsx`），
      壳在 `pages/workspace/LearningProjectDetailPage.tsx`。
      要改详情内容请改那一个文件，两处（含项目模块的 `/projects/:id`）同时生效。
   ============================================================================ */

export function PracticeProjects() {
  return (
    <ProjectShelf
      scope="learn"
      basePath="/learning/projects"
      title={
        <>
          实践<span className="accent">项目</span>
        </>
      }
    />
  )
}
