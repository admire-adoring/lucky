//! 会议（`work_meeting` + 参会人 `work_meeting_attendee`）。
//!
//! 一张会 = 时间 + 地点 + 组织者 + 参会人 + （可选）纪要文档 + （可选）所属项目。
//! 参会人是多值 ⇒ 拆表；写入按"整组替换"（与项目的 tags/owners 同一条）。
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingAttendee {
    pub user_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meeting {
    pub id: String,
    /// 可空：跨项目的会（周会/复盘）不属任何项目
    pub project_id: Option<String>,
    pub title: String,
    pub starts_at: String,
    pub ends_at: Option<String>,
    pub location: String,
    /// planned / done / canceled
    pub status: String,
    pub minutes_doc: Option<String>,
    pub owner_id: String,
    pub owner_name: String,
    pub attendees: Vec<MeetingAttendee>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingInput {
    #[serde(default)]
    pub project_id: Option<String>,
    pub title: String,
    pub starts_at: String,
    #[serde(default)]
    pub ends_at: Option<String>,
    #[serde(default)]
    pub location: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub minutes_doc: Option<String>,
    /// 整组替换：给了就以它为准（空数组 = 清空参会人）
    #[serde(default)]
    pub attendee_ids: Vec<String>,
}

fn default_status() -> String {
    "planned".into()
}
