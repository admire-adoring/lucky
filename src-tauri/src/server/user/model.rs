//! 用户（成员名单）。单机应用没有"登录账户"—— 这张表回答的是"谁在干活"：
//! 项目负责人、任务指派、文档作者、会议参会都从这里选，删一个人要先看引用。
use serde::{Deserialize, Serialize};

/// 一个人的被引用面。删除前得看得见 —— 挡下来的理由要具体到"被 3 个项目用着"。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRefs {
    /// 当负责人的项目数 + 作为成员参与的项目数
    pub projects: i64,
    pub tasks: i64,
    pub docs: i64,
    pub activities: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    /// 头像上那两个字母（`LY`）；任务按它引用，所以**不能随便改**
    pub code: String,
    pub display_name: String,
    pub created_at: String,
    /// `true` = 本机唯一使用者（就是"我"），页面上单独一块
    pub is_me: bool,
    pub refs: UserRefs,
}

/// 写形态。`id` 不给就是新建（后端生成）；给了就是改名字。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInput {
    #[serde(default)]
    pub id: Option<String>,
    /// 新建必填；改名字时不用给（code 是 `task.owner_code` 的引用目标，不做改名）
    #[serde(default)]
    pub code: Option<String>,
    pub display_name: String,
}
