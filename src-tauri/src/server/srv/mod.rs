//! 服务器台账。门面：取锁 + 调 repo + 组装错误 —— 本模块是 srv 域唯一的 `pub` 面，
//! 函数名不用带前缀（模块名就是命名空间），`Store` 住在 crate 根的 `store.rs`。
mod cred;
mod draft;
mod model;
mod probe;
mod repo;
mod term;
mod term_repo;

pub use draft::{LoginOutcome, LoginProbeInput, ReachOutcome};
pub use probe::ProbeOutcome;
pub use model::{
    DeployRelease, DeployReleaseInput, Server, ServerInput, ServerPath,
    ServerPathInput, ServerPort, ServerProjectRef, ServerReleaseCount,
};
pub use term::{Hub, TermOpen, TermRun, TermStats, TermTail};
pub use term_repo::{TermCommandRow, TermSessionRow};

use crate::server::error::Result;
use crate::server::store::Store;

/* ============================================================
   机器台账（srv_server 及其子表）
   ============================================================ */

/// 在册机器（已从台账收走的不在其中）。
pub fn list(store: &Store) -> Result<Vec<Server>> {
    let conn = store.conn()?;
    repo::list(&conn)
}

/// 按机器名取一台，带全部子项。
pub fn get(store: &Store, host: &str) -> Result<Server> {
    let conn = store.conn()?;
    repo::get(&conn, host)
}

/// 新增；同名已移除的机器走复活（见 `repo::create`）。
pub fn create(store: &Store, input: &ServerInput) -> Result<Server> {
    let mut conn = store.conn()?;
    repo::create(&mut conn, input)
}

/// `host` 是改动前的机器名。
pub fn update(store: &Store, host: &str, input: &ServerInput) -> Result<Server> {
    let mut conn = store.conn()?;
    repo::update(&mut conn, host, input)
}

/// 从台账收走（软删）。
pub fn remove(store: &Store, host: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::remove(&conn, host)
}

/// 彻底删除。**先清这台机器名下的文档**（部署手册等，宿主是 `server`），再删台账行 ——
/// 文件先走，失败可感知。
pub fn delete(store: &Store, host: &str) -> Result<()> {
    crate::server::doc::cleanup_by_owner(store, "server", host)?;
    let conn = store.conn()?;
    repo::delete(&conn, host)
}

/* ============================================================
   发布记录（srv_deploy_release）
   ============================================================ */

/// 一个项目的发布记录，新的在前。
pub fn release_list_by_project(store: &Store, project_id: &str) -> Result<Vec<DeployRelease>> {
    let conn = store.conn()?;
    repo::release_list_by_project(&conn, project_id)
}

/// 跨项目的最近一条（KPI「最近发布」）；一条都没有时为 None。
pub fn release_last(store: &Store) -> Result<Option<DeployRelease>> {
    let conn = store.conn()?;
    repo::release_last(&conn)
}

/// 每台机器名下的发布条数（台账徽标）。
pub fn release_counts(store: &Store) -> Result<Vec<ServerReleaseCount>> {
    let conn = store.conn()?;
    repo::release_counts(&conn)
}

pub fn release_create(store: &Store, input: &DeployReleaseInput) -> Result<DeployRelease> {
    let mut conn = store.conn()?;
    repo::release_create(&mut conn, input)
}

/// `released_at` 缺省时保留原值。
pub fn release_update(store: &Store, id: &str, input: &DeployReleaseInput) -> Result<DeployRelease> {
    let mut conn = store.conn()?;
    repo::release_update(&mut conn, id, input)
}

pub fn release_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::release_delete(&conn, id)
}

/// 连接探测：真跑一次 SSH，成功则把机器自报的规格写回表。
pub fn probe(store: &Store, host: &str) -> Result<probe::ProbeOutcome> {
    let conn = store.conn()?;
    probe::probe(&conn, host)
}

/* ============================================================
   草稿探测（添加服务器表单里的「检查连接」）
   ------------------------------------------------------------
   机器还没入库、没有 host 行可查 ⇒ 参数全部来自表单，不读库也不写库。
   ============================================================ */

/// 地址解析 + 端口连通。本机动作，不碰凭据 —— 地址填完就能跑。
pub fn probe_reach(host: &str, port: u16) -> Result<draft::ReachOutcome> {
    draft::reach(host, port)
}

/// 认证 / 提权 / 系统识别。
///
/// 表单那两格留空、又带着 `savedHost` 时，先用库里存的那份填上 ——
/// 「检查连接」于是不必让用户把密码重新敲一遍。
pub fn probe_login(store: &Store, input: &draft::LoginProbeInput) -> Result<draft::LoginOutcome> {
    let mut filled = input.clone();
    let blank = match filled.auth_code.as_str() {
        "pwd" => filled.password.as_deref().unwrap_or("").is_empty(),
        _ => filled.key_path.as_deref().unwrap_or("").is_empty(),
    };
    if blank {
        if let Some(host) = filled.saved_host.as_deref().filter(|value| !value.is_empty()) {
            let conn = store.conn()?;
            if let Some(saved) = repo::secret(&conn, host)? {
                if filled.auth_code == "pwd" {
                    filled.password = Some(saved);
                } else {
                    filled.key_path = Some(saved);
                }
            }
        }
    }
    draft::login(&filled)
}

/// 编辑页回填用：返回这台机器存过的凭据明文。没存过 → `None`。
pub fn secret(store: &Store, host: &str) -> Result<Option<String>> {
    let conn = store.conn()?;
    repo::secret(&conn, host)
}

/// 只换凭据（终端页认不通时就地重填）。空串 = 清掉。
pub fn secret_set(store: &Store, host: &str, secret: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::set_secret(&conn, host, secret)
}

/* ============================================================
   终端（真 SSH）
   ------------------------------------------------------------
   会话活着的时候在 `Hub`（进程内存）里；落库的是审计行 ——
   会话表记时间与结束方式，命令表记命令、退出码、耗时。
   ============================================================ */

/// 连上这台机器，开一条会话。
pub fn term_open(store: &Store, hub: &Hub, host: &str) -> Result<TermOpen> {
    term::open(store, hub, host)
}

/// 在会话里跑一条命令。`cd` 的目录变化会留下来。
pub fn term_exec(store: &Store, hub: &Hub, session_id: &str, command: &str) -> Result<TermRun> {
    term::exec(store, hub, session_id, command)
}

/// 真读一次负载（CPU / 内存 / load / 进程表）。
pub fn term_stats(hub: &Hub, session_id: &str) -> Result<TermStats> {
    term::stats(hub, session_id)
}

/// 跟日志：`path` 为空时按常见位置挑一个。
pub fn term_tail(hub: &Hub, session_id: &str, path: Option<&str>, lines: i64) -> Result<TermTail> {
    term::tail(hub, session_id, path, lines)
}

/// 关会话（收主连接 + 落库 `closed`）。
pub fn term_close(store: &Store, hub: &Hub, session_id: &str) -> Result<()> {
    term::close(store, hub, session_id)
}

/// 这台机器上敲过的命令，新的在前（方向键跨会话取它）。
pub fn term_history(store: &Store, host: &str, limit: i64) -> Result<Vec<TermCommandRow>> {
    term::history(store, host, limit)
}

/// 这台机器上的终端会话记录。
pub fn term_sessions(store: &Store, host: &str, limit: i64) -> Result<Vec<TermSessionRow>> {
    term::sessions(store, host, limit)
}
