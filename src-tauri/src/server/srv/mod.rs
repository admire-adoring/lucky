//! 服务器台账。门面：取锁 + 调 repo + 组装错误 —— 本模块是 srv 域唯一的 `pub` 面，
//! 函数名不用带前缀（模块名就是命名空间），`Store` 住在 crate 根的 `store.rs`。
mod cred;
mod draft;
mod model;
mod probe;
mod repo;

pub use draft::{LoginOutcome, LoginProbeInput, ReachOutcome};
pub use probe::ProbeOutcome;
pub use model::{
    DeployRelease, DeployReleaseInput, Server, ServerInput, ServerPath,
    ServerPathInput, ServerPort, ServerProjectRef, ServerReleaseCount,
};

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

/// 认证 / 提权 / 系统识别。密钥认证才验得了；密码档明确回报做不到。
pub fn probe_login(input: &draft::LoginProbeInput) -> Result<draft::LoginOutcome> {
    draft::login(input)
}
