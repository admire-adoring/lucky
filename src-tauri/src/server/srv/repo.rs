//! 服务器台账的 SQL。对外只认业务键 `host`（路由 `/work/servers/:host` 用它），
//! `srv_server.id` 留在这一层内部，机器改名时不用连带改外键与历史。
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};

use crate::server::error::{Error, Result};
use crate::server::srv::model::{
    DeployDoc, DeployDocInput, DeployRelease, DeployReleaseInput, Server, ServerInput, ServerPath,
    ServerPort, ServerProjectRef, ServerReleaseCount,
};

const COLS: &str = "id, host, ip, ssh_port, os, cores, mem_gb, disk_gb, role_code, env_code, \
                    login_user, auth_code, esc_mode, esc_user, cred_ref, note, sort_order, \
                    removed_at, created_at, updated_at";

fn row_to_server(row: &Row<'_>) -> rusqlite::Result<Server> {
    Ok(Server {
        id: row.get(0)?,
        host: row.get(1)?,
        ip: row.get(2)?,
        ssh_port: row.get(3)?,
        os: row.get(4)?,
        cores: row.get(5)?,
        mem_gb: row.get(6)?,
        disk_gb: row.get(7)?,
        role_code: row.get(8)?,
        env_code: row.get(9)?,
        login_user: row.get(10)?,
        auth_code: row.get(11)?,
        esc_mode: row.get(12)?,
        esc_user: row.get(13)?,
        cred_ref: row.get(14)?,
        note: row.get(15)?,
        sort_order: row.get(16)?,
        removed_at: row.get(17)?,
        created_at: row.get(18)?,
        updated_at: row.get(19)?,
        projects: Vec::new(),
        ports: Vec::new(),
        tags: Vec::new(),
        path_groups: Vec::new(),
        paths: Vec::new(),
    })
}

/// 在册机器（`removed_at IS NULL`），带全部子项。
pub fn list(conn: &Connection) -> Result<Vec<Server>> {
    let mut stmt =
        conn.prepare(&format!("SELECT {COLS} FROM srv_server WHERE removed_at IS NULL ORDER BY sort_order, host"))?;
    let mut rows = stmt
        .query_map([], row_to_server)?
        .collect::<rusqlite::Result<Vec<Server>>>()?;
    drop(stmt);
    for server in &mut rows {
        hydrate(conn, server)?;
    }
    Ok(rows)
}

/// 按机器名取一台，带全部子项。
pub fn get(conn: &Connection, host: &str) -> Result<Server> {
    let mut server = conn
        .query_row(&format!("SELECT {COLS} FROM srv_server WHERE host = ?1"), [host], row_to_server)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("机器 {host}")))?;
    hydrate(conn, &mut server)?;
    Ok(server)
}

/// 新增。项目 / 端口 / 标签 / 文件位置一次写齐。
///
/// 同名行分两种：在册的挡路（Conflict）；已移除的复活它 —— `removed_at` 那次移除
/// 只是把机器从台账收走，发布记录还挂着这行的 `id`，换一个新 id 那些"接回"的
/// 承诺（移除确认框里写的）就断了。
pub fn create(conn: &mut Connection, input: &ServerInput) -> Result<Server> {
    validate(input)?;
    let existing: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT id, removed_at FROM srv_server WHERE host = ?1",
            [&input.host],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let revive_id = match existing {
        // 在册的同名行挡路；已移除的把 id 拿回来复活
        Some((_, None)) => return Err(Error::Conflict(format!("机器名已存在：{}", input.host))),
        Some((id, Some(_))) => Some(id),
        None => None,
    };

    let tx = conn.transaction()?;
    let id = match revive_id {
        Some(id) => {
            tx.execute(
                "UPDATE srv_server SET
                   host = ?2, ip = ?3, ssh_port = ?4, os = ?5, cores = ?6, mem_gb = ?7, disk_gb = ?8,
                   role_code = ?9, env_code = ?10, login_user = ?11, auth_code = ?12, esc_mode = ?13,
                   esc_user = ?14, cred_ref = ?15, note = ?16,
                   removed_at = NULL,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
                 WHERE id = ?1",
                params![
                    id,
                    input.host,
                    input.ip,
                    input.ssh_port,
                    input.os,
                    input.cores,
                    input.mem_gb,
                    input.disk_gb,
                    input.role_code,
                    input.env_code,
                    input.login_user,
                    input.auth_code,
                    input.esc_mode,
                    input.esc_user,
                    input.cred_ref,
                    input.note,
                ],
            )?;
            id
        }
        None => {
            let id = new_id();
            tx.execute(
                "INSERT INTO srv_server
                   (id, host, ip, ssh_port, os, cores, mem_gb, disk_gb, role_code, env_code,
                    login_user, auth_code, esc_mode, esc_user, cred_ref, note, sort_order,
                    removed_at, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,
                         NULL, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
                params![
                    id,
                    input.host,
                    input.ip,
                    input.ssh_port,
                    input.os,
                    input.cores,
                    input.mem_gb,
                    input.disk_gb,
                    input.role_code,
                    input.env_code,
                    input.login_user,
                    input.auth_code,
                    input.esc_mode,
                    input.esc_user,
                    input.cred_ref,
                    input.note,
                    0i64,
                ],
            )?;
            id
        }
    };
    write_children(&tx, &id, input)?;
    tx.commit()?;
    get(conn, &input.host)
}

/// 编辑。`host` 是**改动前**的机器名（前端从卡片 / 详情页进来时手上就是它），
/// `input.host` 可以是新名字。
pub fn update(conn: &mut Connection, host: &str, input: &ServerInput) -> Result<Server> {
    validate(input)?;
    let id: String = conn
        .query_row("SELECT id FROM srv_server WHERE host = ?1", [host], |row| row.get(0))
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("机器 {host}")))?;

    let taken: i64 = conn.query_row(
        "SELECT COUNT(*) FROM srv_server WHERE host = ?1 AND id <> ?2",
        params![input.host, id],
        |row| row.get(0),
    )?;
    if taken > 0 {
        return Err(Error::Conflict(format!("机器名已存在：{}", input.host)));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE srv_server SET
           host = ?2, ip = ?3, ssh_port = ?4, os = ?5, cores = ?6, mem_gb = ?7, disk_gb = ?8,
           role_code = ?9, env_code = ?10, login_user = ?11, auth_code = ?12, esc_mode = ?13,
           esc_user = ?14, cred_ref = ?15, note = ?16,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id = ?1",
        params![
            id,
            input.host,
            input.ip,
            input.ssh_port,
            input.os,
            input.cores,
            input.mem_gb,
            input.disk_gb,
            input.role_code,
            input.env_code,
            input.login_user,
            input.auth_code,
            input.esc_mode,
            input.esc_user,
            input.cred_ref,
            input.note,
        ],
    )?;
    write_children(&tx, &id, input)?;
    tx.commit()?;
    get(conn, &input.host)
}

/// 从台账收走（软删）。机器本身、上面的应用与数据都不受影响。
pub fn remove(conn: &Connection, host: &str) -> Result<()> {
    let n = conn.execute(
        "UPDATE srv_server
            SET removed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
          WHERE host = ?1 AND removed_at IS NULL",
        [host],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("在册机器 {host}")));
    }
    Ok(())
}

/// 彻底删除（连带子表按外键级联）。给"这台机器填错了"用，日常的移除是 `remove`。
pub fn delete(conn: &Connection, host: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM srv_server WHERE host = ?1", [host])?;
    if n == 0 {
        return Err(Error::NotFound(format!("机器 {host}")));
    }
    Ok(())
}

/* ============================================================
   发布记录（srv_deploy_release）
   ------------------------------------------------------------
   项目名与机器名是读时 JOIN 出来的：发布清单 / KPI 卡直接消费，
   不让每个调用方自己再按 id 查一遍名字。
   ============================================================ */

const RELEASE_COLS: &str = "r.id, r.project_id, p.name, r.server_id, s.host, r.version, r.result_code, \
                            r.released_at, r.operator_code, r.duration_sec, r.commit_sha, r.changes, r.rollback_to";
const RELEASE_FROM: &str = "FROM srv_deploy_release r \
                            JOIN project p ON p.id = r.project_id \
                            LEFT JOIN srv_server s ON s.id = r.server_id";

fn row_to_release(row: &Row<'_>) -> rusqlite::Result<DeployRelease> {
    Ok(DeployRelease {
        id: row.get(0)?,
        project_id: row.get(1)?,
        project_name: row.get(2)?,
        server_id: row.get(3)?,
        server_host: row.get(4)?,
        version: row.get(5)?,
        result_code: row.get(6)?,
        released_at: row.get(7)?,
        operator_code: row.get(8)?,
        duration_sec: row.get(9)?,
        commit_sha: row.get(10)?,
        changes: row.get(11)?,
        rollback_to: row.get(12)?,
    })
}

/// 一个项目的发布记录，新的在前（`ix_srv_release_project` 就是按这个方向建的）。
pub fn release_list_by_project(conn: &Connection, project_id: &str) -> Result<Vec<DeployRelease>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {RELEASE_COLS} {RELEASE_FROM}
          WHERE r.project_id = ?1 ORDER BY r.released_at DESC, r.sort_order"
    ))?;
    let rows = stmt
        .query_map([project_id], row_to_release)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// 跨项目的最近一条。同时刻并列时回滚优先 —— 这一格问的是"有没有正在烧的火"。
pub fn release_last(conn: &Connection) -> Result<Option<DeployRelease>> {
    let release = conn
        .query_row(
            &format!(
                "SELECT {RELEASE_COLS} {RELEASE_FROM}
                 ORDER BY r.released_at DESC, (r.result_code = 'rollback') DESC LIMIT 1"
            ),
            [],
            row_to_release,
        )
        .optional()?;
    Ok(release)
}

/// 每台机器名下的发布条数（台账徽标）。只在册机器会被台账页对上，别的行白算不亏。
pub fn release_counts(conn: &Connection) -> Result<Vec<ServerReleaseCount>> {
    let mut stmt = conn.prepare(
        "SELECT s.host, COUNT(*) FROM srv_deploy_release r
           JOIN srv_server s ON s.id = r.server_id GROUP BY s.host",
    )?;
    let rows = stmt
        .query_map([], |row| Ok(ServerReleaseCount { host: row.get(0)?, count: row.get(1)? }))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// 新增一条发布记录。`released_at` 缺省时由 SQL 取当前时刻 —— 补录历史才需要给。
pub fn release_create(conn: &mut Connection, input: &DeployReleaseInput) -> Result<DeployRelease> {
    validate_release(input)?;
    let id = new_id();
    conn.execute(
        "INSERT INTO srv_deploy_release
           (id, project_id, server_id, version, result_code, released_at, operator_code,
            duration_sec, commit_sha, changes, rollback_to, sort_order)
         VALUES (?1,?2,?3,?4,?5, COALESCE(?6, strftime('%Y-%m-%dT%H:%M:%SZ','now')),?7,?8,?9,?10,?11,0)",
        params![
            id,
            input.project_id,
            resolve_server_id(conn, input.server_host.as_deref())?,
            input.version,
            input.result_code,
            input.released_at,
            input.operator_code,
            input.duration_sec,
            input.commit_sha,
            input.changes,
            input.rollback_to,
        ],
    )?;
    release_by_id(conn, &id)
}

/// 编辑一条发布记录。`released_at` 缺省时保留原值 —— 改一处错字不该把发布时刻改成现在。
pub fn release_update(conn: &mut Connection, id: &str, input: &DeployReleaseInput) -> Result<DeployRelease> {
    validate_release(input)?;
    let n = conn.execute(
        "UPDATE srv_deploy_release SET
           project_id = ?2, server_id = ?3, version = ?4, result_code = ?5,
           released_at = COALESCE(?6, released_at), operator_code = ?7, duration_sec = ?8,
           commit_sha = ?9, changes = ?10, rollback_to = ?11
         WHERE id = ?1",
        params![
            id,
            input.project_id,
            resolve_server_id(conn, input.server_host.as_deref())?,
            input.version,
            input.result_code,
            input.released_at,
            input.operator_code,
            input.duration_sec,
            input.commit_sha,
            input.changes,
            input.rollback_to,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("发布记录 {id}")));
    }
    release_by_id(conn, id)
}

pub fn release_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM srv_deploy_release WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("发布记录 {id}")));
    }
    Ok(())
}

fn release_by_id(conn: &Connection, id: &str) -> Result<DeployRelease> {
    conn.query_row(
        &format!("SELECT {RELEASE_COLS} {RELEASE_FROM} WHERE r.id = ?1"),
        [id],
        row_to_release,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("发布记录 {id}")))
}

/// 机器按业务键 host 引用（写入方手上只有它），落库前换回 id。
/// 已收走的机器也能挂 —— 发布记录是历史，历史不因为台账收走而作废。
fn resolve_server_id(conn: &Connection, host: Option<&str>) -> Result<Option<String>> {
    let host = match host.map(str::trim).filter(|h| !h.is_empty()) {
        Some(host) => host,
        None => return Ok(None),
    };
    conn.query_row("SELECT id FROM srv_server WHERE host = ?1", [host], |row| row.get(0))
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("机器 {host}")))
}

/// 写入路径与 CHECK 约束的同一批规则（见 `srv_deploy_release` 的 DDL）。
fn validate_release(input: &DeployReleaseInput) -> Result<()> {
    if input.version.trim().is_empty() {
        return Err(Error::Invalid("版本号不能为空".into()));
    }
    if !matches!(input.result_code.as_str(), "success" | "rollback") {
        return Err(Error::Invalid(format!("发布结果不合法：{}", input.result_code)));
    }
    if let Some(sec) = input.duration_sec {
        if sec < 0 {
            return Err(Error::Invalid("部署耗时不能为负数".into()));
        }
    }
    // rollback_to 只属于回滚那条（DDL 列注释），两个方向都拦。
    match (input.result_code.as_str(), &input.rollback_to) {
        ("rollback", None) => Err(Error::Invalid("回滚记录要填回滚到哪一版".into())),
        ("success", Some(_)) => Err(Error::Invalid("成功发布不带回滚目标".into())),
        _ => Ok(()),
    }
}

/* ============================================================
   部署文档（srv_deploy_doc）
   ============================================================ */

const DOC_COLS: &str = "id, project_id, name, kind_code, version, updated_at, sort_order";

fn row_to_doc(row: &Row<'_>) -> rusqlite::Result<DeployDoc> {
    Ok(DeployDoc {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        kind_code: row.get(3)?,
        version: row.get(4)?,
        updated_at: row.get(5)?,
        sort_order: row.get(6)?,
    })
}

/// 一个项目的部署文档（书架那一排），按登记顺序。
pub fn doc_list(conn: &Connection, project_id: &str) -> Result<Vec<DeployDoc>> {
    let mut stmt =
        conn.prepare(&format!("SELECT {DOC_COLS} FROM srv_deploy_doc WHERE project_id = ?1 ORDER BY sort_order"))?;
    let rows = stmt
        .query_map([project_id], row_to_doc)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// 新增一份部署文档。顺序取该项目现有最大值 + 1 —— 新登记的排在书架末尾。
pub fn doc_create(conn: &mut Connection, input: &DeployDocInput) -> Result<DeployDoc> {
    validate_doc(input)?;
    let id = new_id();
    conn.execute(
        "INSERT INTO srv_deploy_doc (id, project_id, name, kind_code, version, updated_at, sort_order)
         VALUES (?1,?2,?3,?4,?5, strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                 (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM srv_deploy_doc WHERE project_id = ?2))",
        params![id, input.project_id, input.name, input.kind_code, input.version],
    )?;
    doc_by_id(conn, &id)
}

/// 编辑。`updated_at` 就是"这次更新"的时刻，不收调用方给的值。
pub fn doc_update(conn: &mut Connection, id: &str, input: &DeployDocInput) -> Result<DeployDoc> {
    validate_doc(input)?;
    let n = conn.execute(
        "UPDATE srv_deploy_doc SET
           project_id = ?2, name = ?3, kind_code = ?4, version = ?5,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id = ?1",
        params![id, input.project_id, input.name, input.kind_code, input.version],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("部署文档 {id}")));
    }
    doc_by_id(conn, id)
}

pub fn doc_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM srv_deploy_doc WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("部署文档 {id}")));
    }
    Ok(())
}

fn doc_by_id(conn: &Connection, id: &str) -> Result<DeployDoc> {
    conn.query_row(&format!("SELECT {DOC_COLS} FROM srv_deploy_doc WHERE id = ?1"), [id], row_to_doc)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("部署文档 {id}")))
}

fn validate_doc(input: &DeployDocInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("文档名不能为空".into()));
    }
    if !matches!(input.kind_code.as_str(), "manual" | "process" | "script") {
        return Err(Error::Invalid(format!("文档类型不合法：{}", input.kind_code)));
    }
    Ok(())
}

/// 子表整组替换：先删后插，顺序即 `sort_order`。
///
/// 分组必须先于路径写入 —— 路径的 `(server_id, group_name)` 是复合外键，
/// 而且删分组会级联删掉它下面的路径。
fn write_children(tx: &Transaction<'_>, server_id: &str, input: &ServerInput) -> Result<()> {
    tx.execute("DELETE FROM srv_server_project WHERE server_id = ?1", [server_id])?;
    for (i, project_id) in input.project_ids.iter().enumerate() {
        tx.execute(
            "INSERT INTO srv_server_project (server_id, project_id, sort_order) VALUES (?1,?2,?3)",
            params![server_id, project_id, i as i64],
        )?;
    }

    tx.execute("DELETE FROM srv_server_port WHERE server_id = ?1", [server_id])?;
    for (i, port) in input.ports.iter().enumerate() {
        tx.execute(
            "INSERT INTO srv_server_port (server_id, port, svc, sort_order) VALUES (?1,?2,?3,?4)",
            params![server_id, port.port, port.svc, i as i64],
        )?;
    }

    tx.execute("DELETE FROM srv_server_tag WHERE server_id = ?1", [server_id])?;
    for (i, name) in input.tags.iter().enumerate() {
        // 标签池是共享的：同名复用，不重复建。
        tx.execute("INSERT OR IGNORE INTO srv_tag (name) VALUES (?1)", [name])?;
        let tag_id: i64 = tx.query_row("SELECT id FROM srv_tag WHERE name = ?1", [name], |row| row.get(0))?;
        tx.execute(
            "INSERT OR IGNORE INTO srv_server_tag (server_id, tag_id, sort_order) VALUES (?1,?2,?3)",
            params![server_id, tag_id, i as i64],
        )?;
    }

    tx.execute("DELETE FROM srv_path_group WHERE server_id = ?1", [server_id])?;
    for (i, group) in input.path_groups.iter().enumerate() {
        tx.execute(
            "INSERT INTO srv_path_group (server_id, name, sort_order) VALUES (?1,?2,?3)",
            params![server_id, group, i as i64],
        )?;
    }
    for (i, path) in input.paths.iter().enumerate() {
        tx.execute(
            "INSERT INTO srv_server_path (id, server_id, group_name, use_label, path, note, sort_order)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![new_id(), server_id, path.group, path.use_label, path.path, path.note, i as i64],
        )?;
    }
    Ok(())
}

fn hydrate(conn: &Connection, server: &mut Server) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name FROM srv_server_project sp
           JOIN project p ON p.id = sp.project_id
          WHERE sp.server_id = ?1 ORDER BY sp.sort_order",
    )?;
    server.projects = stmt
        .query_map([&server.id], |row| {
            Ok(ServerProjectRef { id: row.get(0)?, name: row.get(1)? })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(stmt);

    let mut stmt = conn.prepare(
        "SELECT port, svc FROM srv_server_port WHERE server_id = ?1 ORDER BY sort_order",
    )?;
    server.ports = stmt
        .query_map([&server.id], |row| Ok(ServerPort { port: row.get(0)?, svc: row.get(1)? }))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(stmt);

    let mut stmt = conn.prepare(
        "SELECT t.name FROM srv_server_tag st JOIN srv_tag t ON t.id = st.tag_id
          WHERE st.server_id = ?1 ORDER BY st.sort_order",
    )?;
    server.tags = stmt
        .query_map([&server.id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(stmt);

    let mut stmt = conn.prepare("SELECT name FROM srv_path_group WHERE server_id = ?1 ORDER BY sort_order")?;
    server.path_groups = stmt
        .query_map([&server.id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(stmt);

    let mut stmt = conn.prepare(
        "SELECT id, group_name, use_label, path, note FROM srv_server_path
          WHERE server_id = ?1 ORDER BY sort_order",
    )?;
    server.paths = stmt
        .query_map([&server.id], |row| {
            Ok(ServerPath {
                id: row.get(0)?,
                group: row.get(1)?,
                use_label: row.get(2)?,
                path: row.get(3)?,
                note: row.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(())
}

/// 写入路径与 CHECK 约束的同一批规则，提前在这里拦下来 —— 报错信息能说人话，
/// 不等到 SQLite 抛一句 "CHECK constraint failed"。
fn validate(input: &ServerInput) -> Result<()> {
    if input.host.trim().is_empty() {
        return Err(Error::Invalid("机器名不能为空".into()));
    }
    if input.ip.trim().is_empty() {
        return Err(Error::Invalid("地址不能为空".into()));
    }
    if !(1..=65535).contains(&input.ssh_port) {
        return Err(Error::Invalid("SSH 端口超出范围".into()));
    }
    if !matches!(input.role_code.as_str(), "web" | "db" | "cache") {
        return Err(Error::Invalid(format!("角色不合法：{}", input.role_code)));
    }
    if !matches!(input.env_code.as_str(), "prod" | "stage" | "test" | "local") {
        return Err(Error::Invalid(format!("环境不合法：{}", input.env_code)));
    }
    if !matches!(input.auth_code.as_str(), "key" | "pwd") {
        return Err(Error::Invalid(format!("认证方式不合法：{}", input.auth_code)));
    }
    if !matches!(input.esc_mode.as_str(), "none" | "su" | "sudo") {
        return Err(Error::Invalid(format!("提权方式不合法：{}", input.esc_mode)));
    }
    for path in &input.paths {
        if !input.path_groups.iter().any(|group| group == &path.group) {
            return Err(Error::Invalid(format!("路径的分组不存在：{}", path.group)));
        }
    }
    Ok(())
}

/// id 由写入方生成，不引入自增整数：离线创建与乐观更新都需要 id 先于写库存在。
fn new_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);

    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("srv-{nanos:x}-{seq:x}")
}
