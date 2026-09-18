// Windows 的 release 版本不额外弹控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lucky_lib::run()
}
