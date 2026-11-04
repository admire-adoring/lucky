//! Lucky-Y 桌面应用，Tauri v2 官方布局。
//!
//! 本文件是命令层：创建窗口、注册命令、把命令转发给领域层。
//! 业务逻辑一律在 `src/server/`，那一层不 import tauri，
//! 将来加 HTTP 入口时把目录拆回独立 crate 即可。
//!
//! 数据库与日志的路径由工程根 `config.toml` 配置（见 `config.rs`），命令层读配置、
//! 建目录、初始化日志；领域层只收一个 `Path`。

mod config;
mod server;

use server::{
    DocContent, DeployRelease, DeployReleaseInput, Document, DocumentInput, Project, ProjectInput,
    AppInfo, Server, ServerInput, ServerReleaseCount, Store, Task, TaskInput, TaskItem, User, UserInput,
    Contact, ContactInput, Meeting, MeetingInput,
    CalendarEvent, CalendarEventInput, SettingItem, SettingItemInput,
    KnowledgeNote, KnowledgeNoteInput, KnowledgeTag, KnowledgeTagInput, NoteFilter,
    LifeFinance, LifeFinanceInput, LifeHabit, LifeHabitInput, LifeJournal, LifeJournalInput,
    LifePet, LifePetInput, LifeRecipe, LifeRecipeInput, LifeWorkout, LifeWorkoutInput,
    LearningGoal, LearningGoalInput, LearningOutput, LearningOutputInput, LearningOverview,
    LearningResource, LearningResourceInput, LearningReview, LearningReviewInput, LearningSkill,
    LearningSkillInput, LearningStudyLog, LearningStudyLogInput,
    app, calendar, doc, knowledge, learning, life, project, setting, srv, task, user, work,
};
use project::{ActivityRow, MilestoneInput, ProjectMilestone, RecentActivityRow};
use serde::Serialize;
use tauri::{Manager, State};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 命令错误的可序列化形态：`code` 给前端按类型分支（冲突不关弹窗、找不到退列表），
/// `message` 给人读。TS 侧对应 `src/api/error.ts` 的 `ApiError`。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiError {
    code: &'static str,
    message: String,
}

impl From<server::Error> for ApiError {
    fn from(e: server::Error) -> Self {
        tracing::warn!("命令错误：{}", e);
        ApiError { code: e.code(), message: e.to_string() }
    }
}

/* ============================================================
   服务器台账 · 命令
   ------------------------------------------------------------
   命令只做三件事：取 state、调领域层、把错误转成 ApiError。
   机器的业务键是 `host`（路由 `/work/servers/:host` 用它）；
   发布记录与部署文档没有路由级业务键，直接用 id。
   ============================================================ */

#[tauri::command]
fn srv_list(store: State<'_, Store>) -> Result<Vec<Server>, ApiError> {
    srv::list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn srv_get(store: State<'_, Store>, host: String) -> Result<Server, ApiError> {
    srv::get(&store, &host).map_err(ApiError::from)
}

#[tauri::command]
fn srv_create(store: State<'_, Store>, input: ServerInput) -> Result<Server, ApiError> {
    srv::create(&store, &input).map_err(ApiError::from)
}

/// `host` 是改动前的机器名；`input.host` 可以是新名字。
#[tauri::command]
fn srv_update(store: State<'_, Store>, host: String, input: ServerInput) -> Result<Server, ApiError> {
    srv::update(&store, &host, &input).map_err(ApiError::from)
}

/// 从台账收走（软删）。机器本身不受影响。
#[tauri::command]
fn srv_remove(store: State<'_, Store>, host: String) -> Result<(), ApiError> {
    srv::remove(&store, &host).map_err(ApiError::from)
}

#[tauri::command]
fn srv_delete(store: State<'_, Store>, host: String) -> Result<(), ApiError> {
    srv::delete(&store, &host).map_err(ApiError::from)
}

/* —— 发布记录 —— */

#[tauri::command]
fn srv_release_list_by_project(store: State<'_, Store>, project_id: String) -> Result<Vec<DeployRelease>, ApiError> {
    srv::release_list_by_project(&store, &project_id).map_err(ApiError::from)
}

/// 跨项目的最近一条；一条都没有时回 null。
#[tauri::command]
fn srv_release_last(store: State<'_, Store>) -> Result<Option<DeployRelease>, ApiError> {
    srv::release_last(&store).map_err(ApiError::from)
}

/// 每台机器名下的发布条数（台账徽标）。
#[tauri::command]
fn srv_release_counts(store: State<'_, Store>) -> Result<Vec<ServerReleaseCount>, ApiError> {
    srv::release_counts(&store).map_err(ApiError::from)
}

#[tauri::command]
fn srv_release_create(store: State<'_, Store>, input: DeployReleaseInput) -> Result<DeployRelease, ApiError> {
    srv::release_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn srv_release_update(store: State<'_, Store>, id: String, input: DeployReleaseInput) -> Result<DeployRelease, ApiError> {
    srv::release_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn srv_release_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    srv::release_delete(&store, &id).map_err(ApiError::from)
}

/* —— 部署文档 —— */

/* ============================================================
   项目 · 执行层「项目」域
   ------------------------------------------------------------
   三个域的 `/x/projects` 入口都走 `project_list`，只是 scope 不同。
   ============================================================ */

#[tauri::command]
fn project_list(store: State<'_, Store>, scope: Option<String>) -> Result<Vec<Project>, ApiError> {
    project::list(&store, scope.as_deref()).map_err(ApiError::from)
}

#[tauri::command]
fn project_get(store: State<'_, Store>, id: String) -> Result<Project, ApiError> {
    project::get(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn project_create(store: State<'_, Store>, input: ProjectInput) -> Result<Project, ApiError> {
    project::create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn project_update(
    store: State<'_, Store>,
    id: String,
    input: ProjectInput,
) -> Result<Project, ApiError> {
    project::update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn project_set_status(
    store: State<'_, Store>,
    id: String,
    status: String,
) -> Result<Project, ApiError> {
    project::set_status(&store, &id, &status).map_err(ApiError::from)
}

#[tauri::command]
fn project_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    project::delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn project_log_activity(
    store: State<'_, Store>,
    id: String,
    action: String,
) -> Result<(), ApiError> {
    project::log_activity(&store, &id, &action).map_err(ApiError::from)
}

/// 项目的动态流（按时间倒序）。`limit` 不给就全取。
#[tauri::command]
fn project_list_activity(
    store: State<'_, Store>,
    project_id: String,
    limit: Option<i64>,
) -> Result<Vec<ActivityRow>, ApiError> {
    project::list_activity(&store, &project_id, limit).map_err(ApiError::from)
}

/// 跨项目的最近动态（工作台首页用）。
#[tauri::command]
fn project_recent_activity(
    store: State<'_, Store>,
    limit: i64,
) -> Result<Vec<RecentActivityRow>, ApiError> {
    project::recent_activity(&store, limit).map_err(ApiError::from)
}

/* ============================================================
   任务 · 全局层「任务清单」域
   ------------------------------------------------------------
   项目详情页的任务分区也读这里，带上 `projectId` 过滤。
   ============================================================ */

#[tauri::command]
fn task_list(
    store: State<'_, Store>,
    project_id: Option<String>,
    scope: Option<String>,
) -> Result<Vec<Task>, ApiError> {
    task::list(&store, project_id.as_deref(), scope.as_deref()).map_err(ApiError::from)
}

#[tauri::command]
fn task_create(store: State<'_, Store>, input: TaskInput) -> Result<Task, ApiError> {
    task::create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn task_update(store: State<'_, Store>, id: String, input: TaskInput) -> Result<Task, ApiError> {
    task::update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn task_set_state(store: State<'_, Store>, id: String, state: String) -> Result<Task, ApiError> {
    task::set_state(&store, &id, &state).map_err(ApiError::from)
}

#[tauri::command]
fn task_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    task::delete(&store, &id).map_err(ApiError::from)
}

/* ============================================================
   文档 · 一张表挂多种主实体（项目 / 服务器 / 未来的笔记）
   ------------------------------------------------------------
   正文两类：local_md 是本地 .md 文件（`documents/<owner_kind>/<owner_id>/`，
   文件是正文的源，库只存索引与坐标），其余来源只有在原工具的索引。
   见 全局架构.md §三 / §九。
   ============================================================ */

#[tauri::command]
fn doc_list(
    store: State<'_, Store>,
    owner_kind: Option<String>,
    owner_id: Option<String>,
    project_id: Option<String>,
    kind: Option<String>,
) -> Result<Vec<Document>, ApiError> {
    doc::list(
        &store,
        owner_kind.as_deref(),
        owner_id.as_deref(),
        project_id.as_deref(),
        kind.as_deref(),
    )
    .map_err(ApiError::from)
}

#[tauri::command]
fn doc_get(store: State<'_, Store>, id: String) -> Result<Document, ApiError> {
    doc::get(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn doc_create(store: State<'_, Store>, input: DocumentInput) -> Result<Document, ApiError> {
    doc::create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn doc_update(
    store: State<'_, Store>,
    id: String,
    input: DocumentInput,
) -> Result<Document, ApiError> {
    doc::update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn doc_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    doc::delete(&store, &id).map_err(ApiError::from)
}

/// 读正文；文件被外部改过时顺带把索引同步掉，`changed` 告诉界面这件事。
#[tauri::command]
fn doc_read(store: State<'_, Store>, id: String) -> Result<DocContent, ApiError> {
    doc::read(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn doc_write(
    store: State<'_, Store>,
    id: String,
    content: String,
    name: Option<String>,
) -> Result<Document, ApiError> {
    doc::write(&store, &id, &content, name.as_deref()).map_err(ApiError::from)
}

/// 文档根 + 根下的目录：新建文档时给人挑「存到哪个文件夹」。
#[tauri::command]
fn doc_dirs(store: State<'_, Store>) -> doc::DocDirs {
    doc::dirs(&store)
}


/* ============================================================
   成员名单 + 本机数据（账户页）
   ============================================================ */

#[tauri::command]
fn user_list(store: State<'_, Store>) -> Result<Vec<User>, ApiError> {
    user::list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn user_save(store: State<'_, Store>, input: UserInput) -> Result<User, ApiError> {
    user::save(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn user_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    user::delete(&store, &id).map_err(ApiError::from)
}

/// 库与文档落在哪、各有多少 —— 账户页「本机数据」卡。
#[tauri::command]
fn app_info(store: State<'_, Store>) -> Result<AppInfo, ApiError> {
    app::info(&store).map_err(ApiError::from)
}


/* ============================================================
   项目的 HTML（流程图 / 架构图）—— 独立窗口打开
   ============================================================ */

#[tauri::command]
fn project_html_list(
    store: State<'_, Store>,
    project_id: String,
) -> Result<Vec<project::HtmlFile>, ApiError> {
    project::html_list(&store, &project_id).map_err(ApiError::from)
}

/// 开一个独立窗口直接加载项目目录里的 html。
///
/// 为什么在壳层：建窗口要 `AppHandle`，而领域层不许 `use tauri`。
/// 为什么用 `WebviewUrl::External(file://…)` 而不是塞进前端路由：这些图是用户用别的工具
///   （mermaid / draw.io / 手写）画的，内联脚本与相对资源都在原文件里 —— 套进我们的 CSP
///   与外壳只会让它们坏掉。窗口里只放它自己，坏不到主界面。
#[tauri::command]
fn project_html_open(
    app: tauri::AppHandle,
    store: State<'_, Store>,
    project_id: String,
    rel: String,
) -> Result<(), ApiError> {
    let abs = project::html_resolve(&store, &project_id, &rel).map_err(ApiError::from)?;
    let url = tauri::Url::from_file_path(&abs).map_err(|_| {
        ApiError::from(server::Error::Invalid(format!("路径无法转成 URL：{}", abs.display())))
    })?;

    /* 同一个文件只开一个窗口：label 按绝对路径算，已存在就聚焦 */
    let label = format!("html-{}", short_key(&abs.to_string_lossy()));
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_focus();
        return Ok(());
    }

    let title = abs
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "HTML".into());

    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(url))
        .title(title)
        .inner_size(1200.0, 860.0)
        .min_inner_size(480.0, 360.0)
        .build()
        .map_err(|error| ApiError::from(server::Error::Invalid(format!("窗口打不开：{error}"))))?;
    Ok(())
}

/// 窗口 label 只收 `[a-zA-Z0-9-_]`：对绝对路径做 FNV-1a 取 8 位十六进制。
fn short_key(text: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:08x}")
}


/* ============================================================
   项目账户（凭据）—— 元信息在库、明文在本机钥匙串
   ============================================================ */

#[tauri::command]
fn account_list(
    store: State<'_, Store>,
    project_id: String,
) -> Result<Vec<project::ProjectAccount>, ApiError> {
    project::account_list(&store, &project_id).map_err(ApiError::from)
}

#[tauri::command]
fn account_create(
    store: State<'_, Store>,
    project_id: String,
    input: project::ProjectAccountInput,
) -> Result<project::ProjectAccount, ApiError> {
    project::account_create(&store, &project_id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn account_update(
    store: State<'_, Store>,
    id: String,
    input: project::ProjectAccountInput,
) -> Result<project::ProjectAccount, ApiError> {
    project::account_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn account_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    project::account_delete(&store, &id).map_err(ApiError::from)
}

/// 读明文（钥匙串）。没有存密码时返回 `Invalid` 并说明 —— 不返回空串。
#[tauri::command]
fn account_secret(store: State<'_, Store>, id: String) -> Result<String, ApiError> {
    project::account_secret(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   任务检查项（task_item）—— 一个任务的多条子记录
   ============================================================ */

#[tauri::command]
fn task_item_list(store: State<'_, Store>, task_id: String) -> Result<Vec<TaskItem>, ApiError> {
    task::item_list(&store, &task_id).map_err(ApiError::from)
}

#[tauri::command]
fn task_item_create(
    store: State<'_, Store>,
    task_id: String,
    title: String,
) -> Result<TaskItem, ApiError> {
    task::item_create(&store, &task_id, &title).map_err(ApiError::from)
}

#[tauri::command]
fn task_item_toggle(store: State<'_, Store>, id: String, done: bool) -> Result<TaskItem, ApiError> {
    task::item_toggle(&store, &id, done).map_err(ApiError::from)
}

#[tauri::command]
fn task_item_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    task::item_delete(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   项目问题清单（project_bug）
   ============================================================ */

#[tauri::command]
fn bug_list(store: State<'_, Store>, project_id: String) -> Result<Vec<project::ProjectBug>, ApiError> {
    project::bug_list(&store, &project_id).map_err(ApiError::from)
}

#[tauri::command]
fn bug_create(
    store: State<'_, Store>,
    project_id: String,
    input: project::ProjectBugInput,
) -> Result<project::ProjectBug, ApiError> {
    project::bug_create(&store, &project_id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn bug_update(
    store: State<'_, Store>,
    id: String,
    input: project::ProjectBugInput,
) -> Result<project::ProjectBug, ApiError> {
    project::bug_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn bug_set_status(store: State<'_, Store>, id: String, status: String) -> Result<project::ProjectBug, ApiError> {
    project::bug_set_status(&store, &id, &status).map_err(ApiError::from)
}

#[tauri::command]
fn bug_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    project::bug_delete(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   项目里程碑（project_milestone）
   ============================================================ */

#[tauri::command]
fn project_milestone_list(
    store: State<'_, Store>,
    project_id: String,
) -> Result<Vec<ProjectMilestone>, ApiError> {
    project::milestone_list(&store, &project_id).map_err(ApiError::from)
}

#[tauri::command]
fn project_milestone_create(
    store: State<'_, Store>,
    project_id: String,
    input: MilestoneInput,
) -> Result<ProjectMilestone, ApiError> {
    project::milestone_create(&store, &project_id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn project_milestone_update(
    store: State<'_, Store>,
    id: String,
    input: MilestoneInput,
) -> Result<ProjectMilestone, ApiError> {
    project::milestone_update(&store, &id, &input).map_err(ApiError::from)
}

/// 只改状态（"标记为当前阶段"那类短动作）。设为 now 时先把同项目的 now 降为 todo。
#[tauri::command]
fn project_milestone_set_state(
    store: State<'_, Store>,
    id: String,
    state: String,
) -> Result<ProjectMilestone, ApiError> {
    project::milestone_set_state(&store, &id, &state).map_err(ApiError::from)
}

#[tauri::command]
fn project_milestone_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    project::milestone_delete(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   会议（work_meeting + 参会人）—— 项目详情那一格按 projectId 筛
   ============================================================ */

#[tauri::command]
fn meeting_list(
    store: State<'_, Store>,
    project_id: Option<String>,
) -> Result<Vec<Meeting>, ApiError> {
    work::meeting_list(&store, project_id.as_deref()).map_err(ApiError::from)
}

#[tauri::command]
fn meeting_create(store: State<'_, Store>, input: MeetingInput) -> Result<Meeting, ApiError> {
    work::meeting_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn meeting_update(
    store: State<'_, Store>,
    id: String,
    input: MeetingInput,
) -> Result<Meeting, ApiError> {
    work::meeting_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn meeting_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    work::meeting_delete(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   联系人（work_contact）
   ============================================================ */

#[tauri::command]
fn contact_list(store: State<'_, Store>, role_code: Option<String>) -> Result<Vec<Contact>, ApiError> {
    work::contact_list(&store, role_code.as_deref()).map_err(ApiError::from)
}

#[tauri::command]
fn contact_create(store: State<'_, Store>, input: ContactInput) -> Result<Contact, ApiError> {
    work::contact_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn contact_update(store: State<'_, Store>, id: String, input: ContactInput) -> Result<Contact, ApiError> {
    work::contact_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn contact_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    work::contact_delete(&store, &id).map_err(ApiError::from)
}


/// 连接探测：真 SSH 一次。成功把机器自报的规格写回 `srv_server`（os/cores/mem/disk）。
#[tauri::command]
fn srv_probe(store: State<'_, Store>, host: String) -> Result<server::srv::ProbeOutcome, ApiError> {
    server::srv::probe(&store, &host).map_err(ApiError::from)
}

/* ------------------------------------------------------------------
   表单里的「检查连接」—— 机器还没入库，参数全来自输入框。

   拆两段是因为耗时不一样：解析与端口是本机动作，认证 / 提权 / 系统要等 SSH
   往返。合成一条，前两行会陪着 SSH 干等。

   两条都走 `spawn_blocking`：里面是 DNS、TCP connect 与 `ssh` 子进程，
   压在异步工作线程上会把同时进行的其它命令一起拖住。
   ------------------------------------------------------------------ */

async fn run_blocking<T, F>(work: F) -> Result<T, ApiError>
where
    T: Send + 'static,
    F: FnOnce() -> server::Result<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| {
            ApiError::from(server::Error::Invalid(format!("检查线程没起来：{error}")))
        })?
        .map_err(ApiError::from)
}

/// 第一段：地址解析 + 端口连通。不碰凭据，也不写库。
#[tauri::command]
async fn srv_probe_reach(host: String, port: u16) -> Result<server::srv::ReachOutcome, ApiError> {
    run_blocking(move || server::srv::probe_reach(&host, port)).await
}

/// 第二段：认证 / 提权 / 系统识别。
#[tauri::command]
async fn srv_probe_login(
    input: server::srv::LoginProbeInput,
) -> Result<server::srv::LoginOutcome, ApiError> {
    run_blocking(move || server::srv::probe_login(&input)).await
}


/* ============================================================
   日历事件（calendar_event）
   ============================================================ */

#[tauri::command]
fn event_list_range(store: State<'_, Store>, start: String, end: String) -> Result<Vec<CalendarEvent>, ApiError> {
    calendar::list_range(&store, &start, &end).map_err(ApiError::from)
}

#[tauri::command]
fn event_list_all(store: State<'_, Store>, limit: Option<i64>) -> Result<Vec<CalendarEvent>, ApiError> {
    calendar::list_all(&store, limit.unwrap_or(100)).map_err(ApiError::from)
}

#[tauri::command]
fn event_create(store: State<'_, Store>, input: CalendarEventInput) -> Result<CalendarEvent, ApiError> {
    calendar::create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn event_update(store: State<'_, Store>, id: String, input: CalendarEventInput) -> Result<CalendarEvent, ApiError> {
    calendar::update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn event_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    calendar::delete(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   设置项（setting_item）
   ============================================================ */

#[tauri::command]
fn setting_list(store: State<'_, Store>) -> Result<Vec<SettingItem>, ApiError> {
    setting::list_all(&store).map_err(ApiError::from)
}

#[tauri::command]
fn setting_list_by_category(store: State<'_, Store>, category: String) -> Result<Vec<SettingItem>, ApiError> {
    setting::list_by_category(&store, &category).map_err(ApiError::from)
}

#[tauri::command]
fn setting_get_value(store: State<'_, Store>, key: String) -> Result<Option<String>, ApiError> {
    setting::get_value(&store, &key).map_err(ApiError::from)
}

#[tauri::command]
fn setting_upsert(store: State<'_, Store>, input: SettingItemInput) -> Result<SettingItem, ApiError> {
    setting::upsert(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn setting_set_value(store: State<'_, Store>, key: String, value: String) -> Result<(), ApiError> {
    setting::set_value(&store, &key, &value).map_err(ApiError::from)
}

#[tauri::command]
fn setting_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    setting::delete(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   知识库（knowledge_note + knowledge_tag）
   ============================================================ */

#[tauri::command]
fn note_list(store: State<'_, Store>, filter: NoteFilter) -> Result<Vec<KnowledgeNote>, ApiError> {
    knowledge::list_notes(&store, &filter).map_err(ApiError::from)
}

#[tauri::command]
fn note_create(store: State<'_, Store>, input: KnowledgeNoteInput) -> Result<KnowledgeNote, ApiError> {
    knowledge::create_note(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn note_update(store: State<'_, Store>, id: String, input: KnowledgeNoteInput) -> Result<KnowledgeNote, ApiError> {
    knowledge::update_note(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn note_toggle_favorite(store: State<'_, Store>, id: String) -> Result<KnowledgeNote, ApiError> {
    knowledge::toggle_favorite(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn note_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    knowledge::delete_note(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn tag_list(store: State<'_, Store>, is_topic: Option<bool>) -> Result<Vec<KnowledgeTag>, ApiError> {
    knowledge::list_tags(&store, is_topic).map_err(ApiError::from)
}

#[tauri::command]
fn tag_create(store: State<'_, Store>, input: KnowledgeTagInput) -> Result<KnowledgeTag, ApiError> {
    knowledge::create_tag(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn tag_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    knowledge::delete_tag(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn note_set_tags(store: State<'_, Store>, note_id: String, tag_ids: Vec<String>) -> Result<(), ApiError> {
    knowledge::set_note_tags(&store, &note_id, &tag_ids).map_err(ApiError::from)
}

#[tauri::command]
fn note_get_tags(store: State<'_, Store>, note_id: String) -> Result<Vec<KnowledgeTag>, ApiError> {
    knowledge::get_note_tags(&store, &note_id).map_err(ApiError::from)
}


/* ============================================================
   生活域（习惯/财务/运动/食谱/宠物/日记）
   ============================================================ */

#[tauri::command]
fn habit_list(store: State<'_, Store>) -> Result<Vec<LifeHabit>, ApiError> {
    life::habit_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn habit_create(store: State<'_, Store>, input: LifeHabitInput) -> Result<LifeHabit, ApiError> {
    life::habit_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn habit_update(store: State<'_, Store>, id: String, input: LifeHabitInput) -> Result<LifeHabit, ApiError> {
    life::habit_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn habit_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    life::habit_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn habit_toggle_log(store: State<'_, Store>, habit_id: String, log_date: String) -> Result<(), ApiError> {
    life::habit_toggle_log(&store, &habit_id, &log_date).map(|_| ()).map_err(ApiError::from)
}

#[tauri::command]
fn finance_list(store: State<'_, Store>, limit: Option<i64>) -> Result<Vec<LifeFinance>, ApiError> {
    life::finance_list(&store, limit.unwrap_or(100)).map_err(ApiError::from)
}

#[tauri::command]
fn finance_create(store: State<'_, Store>, input: LifeFinanceInput) -> Result<LifeFinance, ApiError> {
    life::finance_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn finance_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    life::finance_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn workout_list(store: State<'_, Store>, limit: Option<i64>) -> Result<Vec<LifeWorkout>, ApiError> {
    life::workout_list(&store, limit.unwrap_or(50)).map_err(ApiError::from)
}

#[tauri::command]
fn workout_create(store: State<'_, Store>, input: LifeWorkoutInput) -> Result<LifeWorkout, ApiError> {
    life::workout_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn workout_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    life::workout_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn recipe_list(store: State<'_, Store>) -> Result<Vec<LifeRecipe>, ApiError> {
    life::recipe_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn recipe_create(store: State<'_, Store>, input: LifeRecipeInput) -> Result<LifeRecipe, ApiError> {
    life::recipe_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn recipe_update(store: State<'_, Store>, id: String, input: LifeRecipeInput) -> Result<LifeRecipe, ApiError> {
    life::recipe_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn recipe_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    life::recipe_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn pet_list(store: State<'_, Store>) -> Result<Vec<LifePet>, ApiError> {
    life::pet_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn pet_create(store: State<'_, Store>, input: LifePetInput) -> Result<LifePet, ApiError> {
    life::pet_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn pet_update(store: State<'_, Store>, id: String, input: LifePetInput) -> Result<LifePet, ApiError> {
    life::pet_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn pet_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    life::pet_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn journal_list(store: State<'_, Store>, limit: Option<i64>) -> Result<Vec<LifeJournal>, ApiError> {
    life::journal_list(&store, limit.unwrap_or(30)).map_err(ApiError::from)
}

#[tauri::command]
fn journal_get_by_date(store: State<'_, Store>, log_date: String) -> Result<Option<LifeJournal>, ApiError> {
    life::journal_get_by_date(&store, &log_date).map_err(ApiError::from)
}

#[tauri::command]
fn journal_upsert(store: State<'_, Store>, input: LifeJournalInput) -> Result<LifeJournal, ApiError> {
    life::journal_upsert(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn journal_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    life::journal_delete(&store, &id).map_err(ApiError::from)
}


/* ============================================================
   学习域（目标/技能/资源/复习/输出/学习日志）
   ============================================================ */

#[tauri::command]
fn learning_overview(store: State<'_, Store>) -> Result<LearningOverview, ApiError> {
    learning::overview(&store).map_err(ApiError::from)
}

#[tauri::command]
fn goal_list(store: State<'_, Store>) -> Result<Vec<LearningGoal>, ApiError> {
    learning::goal_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn goal_create(store: State<'_, Store>, input: LearningGoalInput) -> Result<LearningGoal, ApiError> {
    learning::goal_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn goal_update(store: State<'_, Store>, id: String, input: LearningGoalInput) -> Result<LearningGoal, ApiError> {
    learning::goal_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn goal_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    learning::goal_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn skill_list(store: State<'_, Store>) -> Result<Vec<LearningSkill>, ApiError> {
    learning::skill_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn skill_create(store: State<'_, Store>, input: LearningSkillInput) -> Result<LearningSkill, ApiError> {
    learning::skill_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn skill_update(store: State<'_, Store>, id: String, input: LearningSkillInput) -> Result<LearningSkill, ApiError> {
    learning::skill_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn skill_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    learning::skill_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn learning_resource_list(store: State<'_, Store>) -> Result<Vec<LearningResource>, ApiError> {
    learning::resource_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn learning_resource_create(store: State<'_, Store>, input: LearningResourceInput) -> Result<LearningResource, ApiError> {
    learning::resource_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn learning_resource_update(store: State<'_, Store>, id: String, input: LearningResourceInput) -> Result<LearningResource, ApiError> {
    learning::resource_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn learning_resource_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    learning::resource_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn review_list(store: State<'_, Store>) -> Result<Vec<LearningReview>, ApiError> {
    learning::review_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn review_due(store: State<'_, Store>, today: String) -> Result<Vec<LearningReview>, ApiError> {
    learning::review_due(&store, &today).map_err(ApiError::from)
}

#[tauri::command]
fn review_create(store: State<'_, Store>, input: LearningReviewInput) -> Result<LearningReview, ApiError> {
    learning::review_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn review_update(store: State<'_, Store>, id: String, input: LearningReviewInput) -> Result<LearningReview, ApiError> {
    learning::review_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn review_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    learning::review_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn review_grade(store: State<'_, Store>, id: String, grade: i64) -> Result<LearningReview, ApiError> {
    learning::review_grade(&store, &id, grade).map_err(ApiError::from)
}

#[tauri::command]
fn output_list(store: State<'_, Store>) -> Result<Vec<LearningOutput>, ApiError> {
    learning::output_list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn output_create(store: State<'_, Store>, input: LearningOutputInput) -> Result<LearningOutput, ApiError> {
    learning::output_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn output_update(store: State<'_, Store>, id: String, input: LearningOutputInput) -> Result<LearningOutput, ApiError> {
    learning::output_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn output_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    learning::output_delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn study_log_list(store: State<'_, Store>, limit: Option<i64>) -> Result<Vec<LearningStudyLog>, ApiError> {
    learning::log_list(&store, limit.unwrap_or(50)).map_err(ApiError::from)
}

#[tauri::command]
fn study_log_create(store: State<'_, Store>, input: LearningStudyLogInput) -> Result<LearningStudyLog, ApiError> {
    learning::log_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn study_log_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    learning::log_delete(&store, &id).map_err(ApiError::from)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config = config::Config::load()?;
            config::init_log(&config.log);
            let db_path = config.database_path();
            if let Some(dir) = db_path.parent() {
                std::fs::create_dir_all(dir)?;
            }
            tracing::info!("启动：数据库 {}", db_path.display());
            app.manage(Store::open(&db_path, config.documents_root())?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            srv_list, srv_get, srv_create, srv_update, srv_remove, srv_delete,
            srv_release_list_by_project, srv_release_last, srv_release_counts,
            srv_release_create, srv_release_update, srv_release_delete,
            project_list, project_get, project_create, project_update,
            project_set_status, project_delete, project_log_activity, project_list_activity,
            project_recent_activity,
            project_milestone_list, project_milestone_create, project_milestone_update,
            project_milestone_set_state, project_milestone_delete,
            doc_list, doc_get, doc_create, doc_update, doc_delete, doc_read, doc_write, doc_dirs,
            user_list, user_save, user_delete, app_info,
            project_html_list, project_html_open,
            account_list, account_create, account_update, account_delete, account_secret,
            task_item_list, task_item_create, task_item_toggle, task_item_delete,
            bug_list, bug_create, bug_update, bug_set_status, bug_delete,
            meeting_list, meeting_create, meeting_update, meeting_delete,
            contact_list, contact_create, contact_update, contact_delete,
            srv_probe,
            srv_probe_reach, srv_probe_login,
            task_list, task_create, task_update, task_set_state, task_delete,
            event_list_range, event_list_all, event_create, event_update, event_delete,
            setting_list, setting_list_by_category, setting_get_value,
            setting_upsert, setting_set_value, setting_delete,
            note_list, note_create, note_update, note_toggle_favorite, note_delete,
            tag_list, tag_create, tag_delete, note_set_tags, note_get_tags,
            habit_list, habit_create, habit_update, habit_delete, habit_toggle_log,
            finance_list, finance_create, finance_delete,
            workout_list, workout_create, workout_delete,
            recipe_list, recipe_create, recipe_update, recipe_delete,
            pet_list, pet_create, pet_update, pet_delete,
            journal_list, journal_get_by_date, journal_upsert, journal_delete,
            learning_overview,
            goal_list, goal_create, goal_update, goal_delete,
            skill_list, skill_create, skill_update, skill_delete,
            learning_resource_list, learning_resource_create, learning_resource_update, learning_resource_delete,
            review_list, review_due, review_create, review_update, review_delete, review_grade,
            output_list, output_create, output_update, output_delete,
            study_log_list, study_log_create, study_log_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
