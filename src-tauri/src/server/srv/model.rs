//! 服务器台账的模型。字段名与表列一一对应，序列化后是 camelCase，与前端对齐。
use serde::{Deserialize, Serialize};

/// 这台机器服务的一个项目。前端要 `id` 拼日志 / 部署 / 终端三条路由。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerProjectRef {
    pub id: String,
    pub name: String,
}

/// 应用端口。与 `Server::ssh_port` 是两件事：那个是连它的入口，这个是它对外跑的服务。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerPort {
    pub port: i64,
    pub svc: String,
}

/// 一条文件位置（读出来的形态，带 id）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerPath {
    pub id: String,
    pub group: String,
    /// 前端的字段名就叫 `use`（`PathSeed.use`），这里换个 Rust 名再改回去。
    #[serde(rename = "use")]
    pub use_label: String,
    pub path: String,
    pub note: String,
}

/// 写入时的一条文件位置（还没有 id）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerPathInput {
    pub group: String,
    #[serde(rename = "use")]
    pub use_label: String,
    pub path: String,
    #[serde(default)]
    pub note: String,
}

/// 台账里的一台机器 —— 主表一行，加上它的项目 / 端口 / 标签 / 文件位置。
///
/// 凭据不在其中：密码与私钥正文存本机钥匙串，这里只有 `cred_ref`（引用）与
/// `auth_code` / `esc_mode` / `esc_user`（怎么连，不是用什么连）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Server {
    pub id: String,
    pub host: String,
    pub ip: String,
    pub ssh_port: i64,
    pub os: String,
    pub cores: Option<i64>,
    pub mem_gb: Option<i64>,
    pub disk_gb: Option<i64>,
    pub role_code: String,
    pub env_code: String,
    pub login_user: String,
    pub auth_code: String,
    pub esc_mode: String,
    pub esc_user: String,
    pub cred_ref: Option<String>,
    pub note: String,
    pub sort_order: i64,
    pub removed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub projects: Vec<ServerProjectRef>,
    pub ports: Vec<ServerPort>,
    pub tags: Vec<String>,
    pub path_groups: Vec<String>,
    pub paths: Vec<ServerPath>,
}

/// 新增 / 编辑的入参。除标识与分类外都可缺省，缺省即取表上的默认值。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInput {
    pub host: String,
    pub ip: String,
    #[serde(default = "default_ssh_port")]
    pub ssh_port: i64,
    #[serde(default)]
    pub os: String,
    #[serde(default)]
    pub cores: Option<i64>,
    #[serde(default)]
    pub mem_gb: Option<i64>,
    #[serde(default)]
    pub disk_gb: Option<i64>,
    pub role_code: String,
    pub env_code: String,
    #[serde(default)]
    pub login_user: String,
    #[serde(default = "default_auth")]
    pub auth_code: String,
    #[serde(default = "default_esc")]
    pub esc_mode: String,
    #[serde(default)]
    pub esc_user: String,
    #[serde(default)]
    pub cred_ref: Option<String>,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub project_ids: Vec<String>,
    #[serde(default)]
    pub ports: Vec<ServerPort>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub path_groups: Vec<String>,
    #[serde(default)]
    pub paths: Vec<ServerPathInput>,
}

fn default_ssh_port() -> i64 {
    22
}

fn default_auth() -> String {
    "key".to_string()
}

fn default_esc() -> String {
    "none".to_string()
}

/* ============================================================
   发布记录（`srv_deploy_release`）
   ------------------------------------------------------------
   `released_at` 存 ISO 时刻，"昨天 / 5 天前"是前端派生文案；
   `duration_sec` 存秒，回滚那条没有耗时（可空）；
   `changes` 一个字段两种读法：成功 = 变更说明，回滚 = 原因。
   `project_name` / `server_host` 是读时 JOIN 出来的，不在本表。
   ============================================================ */

/// 一条发布记录（读出形态，带 JOIN 出来的项目名与机器名）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployRelease {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    /// 落库的机器 id；机器被硬删后为 NULL（ON DELETE SET NULL）
    pub server_id: Option<String>,
    /// 机器名，由 server_id JOIN 出来；NULL 与 server_id 同步
    pub server_host: Option<String>,
    pub version: String,
    /// success / rollback
    pub result_code: String,
    pub released_at: String,
    /// 操作人码（'LY' 这种，引用 app_user.code）；展示名前端换
    pub operator_code: Option<String>,
    /// 部署耗时（秒）；回滚没有这个概念，可空
    pub duration_sec: Option<i64>,
    pub commit_sha: String,
    /// 成功读作变更说明，回滚读作原因
    pub changes: String,
    /// 仅 result_code = rollback 有值
    pub rollback_to: Option<String>,
}

/// 新增 / 编辑一条发布记录的入参。机器按业务键 host 引用（不是 server_id），
/// repo 里换回 id —— 写入方手上有的就是它。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployReleaseInput {
    pub project_id: String,
    /// 缺省 NULL = 不挂机器
    pub server_host: Option<String>,
    pub version: String,
    pub result_code: String,
    /// 缺省 = 发布时刻（写入方补录历史时才需要给）
    pub released_at: Option<String>,
    /// 缺省 NULL = 没登记操作人
    pub operator_code: Option<String>,
    #[serde(default)]
    pub duration_sec: Option<i64>,
    #[serde(default)]
    pub commit_sha: String,
    #[serde(default)]
    pub changes: String,
    #[serde(default)]
    pub rollback_to: Option<String>,
}

/// 台账徽标用的聚合计数：一台机器名下有几条发布记录。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerReleaseCount {
    pub host: String,
    pub count: i64,
}

/* ============================================================
   部署文档（`srv_deploy_doc`）
   ------------------------------------------------------------
   归属是项目，不是机器 —— 服务器详情页那排书架按项目分排。
   与 work_doc 不是重复登记：这边是"运维现场要用的清单"。
   ============================================================ */

/// 一份部署文档（读出形态）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployDoc {
    pub id: String,
    pub project_id: String,
    pub name: String,
    /// manual / process / script；"手册 / 流程 / 脚本"是前端的事
    pub kind_code: String,
    pub version: String,
    pub updated_at: String,
    pub sort_order: i64,
}

/// 新增 / 编辑一份部署文档的入参。`updated_at` 不收：它就是"这次更新"的时刻。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployDocInput {
    pub project_id: String,
    pub name: String,
    pub kind_code: String,
    #[serde(default)]
    pub version: String,
}
