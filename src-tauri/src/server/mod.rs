//! Lucky-Y 领域层。
//!
//! 不 import `tauri`、`serde_json` 等传输层类型，只依赖 `rusqlite` 与 `serde`
//! 的序列化派生。将来加 HTTP 入口时把本目录拆回独立 crate，代码零改动。
//!
//! 表结构的唯一事实源是 `design/sql-design/` 下的 DDL，`db::MIGRATIONS`
//! 用 `include_str!` 直接引用那三份文件，不另存副本。

pub mod app;
pub mod calendar;
pub mod db;
pub mod doc;
pub mod error;
pub mod knowledge;
pub mod learning;
pub mod life;
pub mod project;
pub mod setting;
pub mod srv;
pub mod store;
pub mod task;
pub mod user;
pub mod work;

mod id;

// 重导出是领域层的公共面：命令层只消费一部分，其余留给将来的 HTTP 入口与测试。
#[allow(unused_imports)]
pub use doc::{DocContent, DocLinkInput, Document, DocumentInput, DocumentLink};
#[allow(unused_imports)]
pub use error::{Error, Result};
#[allow(unused_imports)]
pub use project::{ActivityRow, MilestoneInput, Project, ProjectInput, ProjectMilestone, ProjectRisk, RecentActivityRow};
#[allow(unused_imports)]
pub use srv::{
    DeployRelease, DeployReleaseInput, Server, ServerInput, ServerPath,
    ServerPathInput, ServerPort, ServerProjectRef, ServerReleaseCount,
};
pub use store::Store;
#[allow(unused_imports)]
pub use app::AppInfo;
#[allow(unused_imports)]
pub use task::{Task, TaskInput, TaskItem};
#[allow(unused_imports)]
pub use user::{User, UserInput, UserRefs};
#[allow(unused_imports)]
pub use work::{Contact, ContactInput, Meeting, MeetingAttendee, MeetingInput};
#[allow(unused_imports)]
pub use calendar::{CalendarEvent, CalendarEventInput};
#[allow(unused_imports)]
pub use knowledge::{KnowledgeNote, KnowledgeNoteInput, KnowledgeTag, KnowledgeTagInput, NoteFilter};
#[allow(unused_imports)]
pub use life::{
    LifeFinance, LifeFinanceInput, LifeHabit, LifeHabitInput, LifeHabitLog, LifeJournal,
    LifeJournalInput, LifePet, LifePetInput, LifeRecipe, LifeRecipeInput, LifeWorkout,
    LifeWorkoutInput,
};
#[allow(unused_imports)]
pub use setting::{SettingItem, SettingItemInput};
#[allow(unused_imports)]
pub use learning::{
    LearningGoal, LearningGoalInput, LearningOutput, LearningOutputInput, LearningOverview,
    LearningResource, LearningResourceInput, LearningReview, LearningReviewInput, LearningSkill,
    LearningSkillInput, LearningStudyLog, LearningStudyLogInput,
};
