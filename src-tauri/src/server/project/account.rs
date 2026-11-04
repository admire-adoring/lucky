//! 项目账户（凭据）。**元信息在库里，明文在本机钥匙串。**
//!
//! 三条边界：
//! 1. 库里没有任何明文，也没有密文 —— `secret_ref` 只是钥匙串里的键。
//!    备份 `lucky.db` 不会带走任何密码（`全局架构.md` §八）。
//! 2. `due` 不落库：下次轮换 = `rotated_at + cycle_days`，到期天数是展示层的减法。
//! 3. 钥匙串读失败（用户拒绝授权 / 条目被外部删掉）**不当成空密码** ——
//!    报错要能让人分清"没存"与"读不到"。
use keyring::Entry;
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

/// 钥匙串里的服务名（与其它应用隔离）。
const SERVICE: &str = "lucky-y";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAccount {
    pub id: String,
    pub project_id: String,
    pub platform: String,
    pub account: String,
    /// `password` | `key`
    pub kind: String,
    /// `prod` | `test` | `dev`
    pub env: String,
    pub note: String,
    pub cycle_days: i64,
    /// 上次轮换（`YYYY-MM-DD`）
    pub rotated_at: String,
    pub rotated_by: Option<String>,
    /// 轮换人显示名（hydrate）
    pub rotated_by_name: String,
    /// 钥匙串里有没有这份密码 —— 决定"看明文"那格能不能点
    pub has_secret: bool,
    pub disabled: bool,
    pub sort_order: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAccountInput {
    pub platform: String,
    pub account: String,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default = "default_env")]
    pub env: String,
    #[serde(default)]
    pub note: String,
    #[serde(default = "default_cycle")]
    pub cycle_days: i64,
    pub rotated_at: String,
    #[serde(default)]
    pub rotated_by: Option<String>,
    #[serde(default)]
    pub disabled: bool,
    /// 密码/密钥：`Some("")` = 清空，`Some("值")` = 写入，`None` = **不动**（编辑时不改密码的常态）
    #[serde(default)]
    pub secret: Option<String>,
}

fn default_kind() -> String {
    "password".into()
}
fn default_env() -> String {
    "prod".into()
}
fn default_cycle() -> i64 {
    90
}

const COLS: &str = "id, project_id, platform, account, kind, env, note, cycle_days, rotated_at, \
                    rotated_by, secret_ref, disabled, sort_order, updated_at";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_account(row: &Row<'_>) -> rusqlite::Result<ProjectAccount> {
    let secret_ref: Option<String> = row.get(10)?;
    Ok(ProjectAccount {
        id: row.get(0)?,
        project_id: row.get(1)?,
        platform: row.get(2)?,
        account: row.get(3)?,
        kind: row.get(4)?,
        env: row.get(5)?,
        note: row.get(6)?,
        cycle_days: row.get(7)?,
        rotated_at: row.get(8)?,
        rotated_by: row.get(9)?,
        rotated_by_name: String::new(),
        has_secret: secret_ref.is_some(),
        disabled: row.get::<_, i64>(11)? != 0,
        sort_order: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

pub fn list(conn: &Connection, project_id: &str) -> Result<Vec<ProjectAccount>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM project_account WHERE project_id = ?1 ORDER BY sort_order, platform"
    ))?;
    let mut rows = stmt
        .query_map([project_id], row_to_account)?
        .collect::<rusqlite::Result<Vec<ProjectAccount>>>()?;
    drop(stmt);
    for item in &mut rows {
        hydrate(conn, item)?;
    }
    Ok(rows)
}

pub fn create(conn: &mut Connection, project_id: &str, input: &ProjectAccountInput) -> Result<ProjectAccount> {
    validate(input)?;
    let id = new_id("ac");
    /* 先写钥匙串、再登记索引：钥匙串失败时不要留下一行"看起来有密码"的记录 */
    let secret_ref = match input.secret.as_deref() {
        Some(value) if !value.is_empty() => {
            write_secret(&id, value)?;
            Some(format!("account/{id}"))
        }
        _ => None,
    };

    let tx = conn.transaction()?;
    tx.execute(
        &format!(
            "INSERT INTO project_account
               (id, project_id, platform, account, kind, env, note, cycle_days, rotated_at,
                rotated_by, secret_ref, disabled, sort_order, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                     (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM project_account WHERE project_id = ?2),
                     {NOW})"
        ),
        params![
            id,
            project_id,
            input.platform,
            input.account,
            input.kind,
            input.env,
            input.note,
            input.cycle_days,
            input.rotated_at,
            input.rotated_by,
            secret_ref,
            if input.disabled { 1 } else { 0 },
        ],
    )?;
    tx.commit()?;
    get(conn, &id)
}

pub fn update(conn: &mut Connection, id: &str, input: &ProjectAccountInput) -> Result<ProjectAccount> {
    validate(input)?;
    let existing = get(conn, id)?;

    /* 密码三态：不给 = 不动；空串 = 清掉；有值 = 覆盖 */
    let secret_ref = match input.secret.as_deref() {
        Some(value) if !value.is_empty() => {
            write_secret(&existing.id, value)?;
            Some(format!("account/{}", existing.id))
        }
        Some(_) => {
            clear_secret(&existing.id);
            None
        }
        None => existing.has_secret.then(|| format!("account/{}", existing.id)),
    };

    let tx = conn.transaction()?;
    let n = tx.execute(
        &format!(
            "UPDATE project_account SET
               platform = ?2, account = ?3, kind = ?4, env = ?5, note = ?6, cycle_days = ?7,
               rotated_at = ?8, rotated_by = ?9, secret_ref = ?10, disabled = ?11, updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.platform,
            input.account,
            input.kind,
            input.env,
            input.note,
            input.cycle_days,
            input.rotated_at,
            input.rotated_by,
            secret_ref,
            if input.disabled { 1 } else { 0 },
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("账户 {id}")));
    }
    tx.commit()?;
    get(conn, id)
}

/// 删除：钥匙串与行一起走。钥匙串删不掉不拦——行没了之后那份密码再没有入口。
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    clear_secret(id);
    let n = conn.execute("DELETE FROM project_account WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("账户 {id}")));
    }
    Ok(())
}

/// 读明文。没有存 → 明确说"没存"，不要返回空串（那会被当成"密码是空的"）。
pub fn secret(conn: &Connection, id: &str) -> Result<String> {
    let item = get(conn, id)?;
    if !item.has_secret {
        return Err(Error::Invalid(format!("「{}」没有存密码（只登记了账号）", item.account)));
    }
    entry(&item.id)?
        .get_password()
        .map_err(|_| Error::Invalid("钥匙串读不到这份密码（可能被系统清掉了）".into()))
}

fn get(conn: &Connection, id: &str) -> Result<ProjectAccount> {
    let mut item = conn
        .query_row(&format!("SELECT {COLS} FROM project_account WHERE id = ?1"), [id], row_to_account)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("账户 {id}")))?;
    hydrate(conn, &mut item)?;
    Ok(item)
}

fn hydrate(conn: &Connection, item: &mut ProjectAccount) -> Result<()> {
    item.rotated_by_name = match &item.rotated_by {
        Some(id) => conn
            .query_row("SELECT display_name FROM app_user WHERE id = ?1", [id], |row| row.get(0))
            .optional()?
            .unwrap_or_default(),
        None => String::new(),
    };
    Ok(())
}

fn entry(id: &str) -> Result<Entry> {
    Entry::new(SERVICE, &format!("account/{id}"))
        .map_err(|error| Error::Invalid(format!("钥匙串打不开：{error}")))
}

fn write_secret(id: &str, value: &str) -> Result<()> {
    entry(id)?
        .set_password(value)
        .map_err(|error| Error::Invalid(format!("写钥匙串失败：{error}")))
}

/// 清钥匙串。**失败不报**：条目本来就不在（`NoEntry`）是最常见的一种，不该让删除失败。
fn clear_secret(id: &str) {
    if let Ok(item) = entry(id) {
        let _ = item.delete_credential();
    }
}

fn check_enum(what: &str, value: &str, allowed: &[&str]) -> Result<()> {
    if allowed.contains(&value) {
        return Ok(());
    }
    Err(Error::Invalid(format!("{what}的取值不对：{value}")))
}

fn validate(input: &ProjectAccountInput) -> Result<()> {
    if input.platform.trim().is_empty() {
        return Err(Error::Invalid("平台不能为空".into()));
    }
    if input.account.trim().is_empty() {
        return Err(Error::Invalid("账号不能为空".into()));
    }
    check_enum("凭据类型", &input.kind, &["password", "key"])?;
    check_enum("环境", &input.env, &["prod", "test", "dev"])?;
    if input.cycle_days <= 0 {
        return Err(Error::Invalid("轮换周期要大于 0 天".into()));
    }
    if input.rotated_at.trim().is_empty() {
        return Err(Error::Invalid("上次轮换日期不能为空".into()));
    }
    Ok(())
}
