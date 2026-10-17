//! id 生成。各域共用，前缀区分来源（`srv-` / `pj-` / `tk-`）。
//!
//! 本地库要支持离线创建与前端乐观更新 ⇒ id 必须先于写库存在，不用自增整数。

/// `<前缀>-<纳秒十六进制>-<序号十六进制>`。同一纳秒内的多次调用靠序号区分。
pub fn new_id(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);

    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{prefix}-{nanos:x}-{seq:x}")
}
