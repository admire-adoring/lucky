/* ============================================================================
   工作台内容层 —— **生成器已退役**（2026-09-25），现在是手写维护。
   ----------------------------------------------------------------------------
   ⚠️ 上一版这里写的是"由 design/export-workbench-content.mjs 生成，**请勿手改**"，
   那个脚本（连同 `design/gen-modules.mjs`）**已从仓库删除**（与 build-*.mjs 同期）。
   所以改这个文件不再会被覆盖，改它就等于改事实源。

   事实源原来是 gen-modules.mjs 的 MODULES（它同时驱动设计原型 workbench.html）。
   内容不手抄的理由与 CSS 同源那条一致：抄一遍就会漂，而"数字/文案差一点"这种漂
   在页面上不会报错，只会安静地不一致。

   ⚠️ 本轮改动只有一处：进度条的 `"grad"` 值从
   `"bg-[linear-gradient(90deg,#a78bfa,#7c3aed)]"` 这类**渐变工具类**
   换成了域色令牌类（`bg-learn` / `bg-life` / `bg-work`），共 18 处（纯色化）。
   **键名 `grad` 保持不变** —— 改键名要同时动 `TileRows.tsx` 的 prop 与类型，
   而它的含义已经从"渐变类"变成"进度填充类"，属于"名字变陈旧"，就地记明即可。
   与 `--grad-ai` 同一处理口径（见 design-tokens.css）。 */

import type { WorkbenchAggregates, WorkbenchModule } from '../types/workbench'

/** gen-modules.mjs 里项目投影的指纹。src/data/workbench.ts 会拿 PROJECTS 现算一遍比对 */
export const CONTENT_PROJECTS_FINGERPRINT = 'vvxcpg'

export const WORKBENCH_AGGREGATES: WorkbenchAggregates = {
  "TASKS": {
    "total": 164,
    "done": 100,
    "todo": 64,
    "rate": 61
  },
  "GLOBAL_AVG": 59,
  "MONTHS": [
    "9",
    "10",
    "11",
    "12"
  ],
  "BUDGET_TOTAL": 224800,
  "BY_DAYS": [
    "p5",
    "p2",
    "p1",
    "p3",
    "p6",
    "p4"
  ],
  "VIS": [
    [
      "私有",
      3
    ],
    [
      "工作内部",
      2
    ],
    [
      "家庭可见",
      2
    ],
    [
      "公开",
      1
    ]
  ],
  "DOM": {
    "life": {
      "total": 54,
      "done": 33,
      "todo": 21,
      "avg": 70,
      "rate": 61.1
    },
    "work": {
      "total": 54,
      "done": 29,
      "todo": 25,
      "avg": 42,
      "rate": 53.7
    },
    "learn": {
      "total": 56,
      "done": 38,
      "todo": 18,
      "avg": 60,
      "rate": 67.9
    }
  }
}

export const WORKBENCH_MODULES: WorkbenchModule[] = [
  {
    "key": "home",
    "label": "工作台",
    "summary": "全域平均进度 59% · 8 个项目 · 164 条任务",
    "icon": "i-grid",
    "focus": [
      {
        "name": "老房翻新改造",
        "meta": "瓦工进场 · 任务 9/24",
        "tag": "剩 12 天",
        "tone": "danger"
      },
      {
        "name": "Q4 客户交付系统重构",
        "meta": "灰度发布 · 任务 26/36",
        "tag": "11月15日",
        "tone": "danger"
      },
      {
        "name": "Rust 异步编程精读",
        "meta": "mini-runtime 跑通 · 任务 16/20",
        "tag": "剩 10 天",
        "tone": "warn"
      },
      {
        "name": "马尔代夫家庭旅行",
        "meta": "行程终版确认 · 任务 13/19",
        "tag": "剩 13 天",
        "tone": "warn"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-trend",
        "title": "域完成度",
        "sub": "3 个业务域 · 柱高 = 域平均进度",
        "value": "59%",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  73,
                  21
                ],
                [
                  119,
                  12.6
                ],
                [
                  165,
                  18
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "生活",
          "工作",
          "学习"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-check-circle",
        "title": "任务总量",
        "sub": "已完成 100 / 164 条",
        "value": "61%",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#4f46e5",
              "w": 22,
              "bars": [
                [
                  11,
                  17.7
                ],
                [
                  105,
                  15.5
                ],
                [
                  199,
                  20.4
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 22,
              "bars": [
                [
                  39,
                  11.3
                ],
                [
                  133,
                  13.4
                ],
                [
                  227,
                  9.6
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "生活",
          "工作",
          "学习"
        ],
        "legend": [
          [
            "bg-brand-500",
            "已完成"
          ],
          [
            "bg-ink-300",
            "待办"
          ]
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-alert",
        "title": "风险与到期",
        "sub": "1 项风险 · 6 项待到期",
        "value": "1",
        "unit": "项",
        "dot": "bg-danger",
        "chart": {
          "groups": [
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  40,
                  30
                ]
              ]
            },
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  92,
                  15
                ],
                [
                  144,
                  30
                ],
                [
                  196,
                  15
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "9月",
          "10月",
          "11月",
          "12月"
        ]
      },
      {
        "kind": "list",
        "icon": "i-project",
        "title": "项目明细",
        "right": "全部 · 8 个项目",
        "body": [
          {
            "kind": "project",
            "id": "p7"
          },
          {
            "kind": "project",
            "id": "p8"
          },
          {
            "kind": "project",
            "id": "p5"
          },
          {
            "kind": "project",
            "id": "p3"
          },
          {
            "kind": "project",
            "id": "p1"
          },
          {
            "kind": "project",
            "id": "p2"
          },
          {
            "kind": "project",
            "id": "p4"
          },
          {
            "kind": "project",
            "id": "p6"
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-clock",
        "title": "关键节点",
        "right": "风险与里程碑",
        "body": [
          {
            "kind": "event",
            "dot": "bg-danger",
            "text": [
              {
                "text": "工期已延期 5 天",
                "em": true
              }
            ],
            "sub": "老房翻新改造",
            "right": "剩余 12 天",
            "tone": "danger"
          },
          {
            "kind": "event",
            "dot": "bg-danger",
            "text": [
              {
                "text": "鉴权迁移存在兼容风险"
              }
            ],
            "sub": "Q4 客户交付系统重构",
            "right": "剩余 58 天"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "里程碑 · 行程终版确认"
              }
            ],
            "sub": "马尔代夫家庭旅行",
            "right": "10月01日"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "里程碑 · mini-runtime 跑通"
              }
            ],
            "sub": "Rust 异步编程精读",
            "right": "9月28日"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "里程碑 · KR 拆解评审"
              }
            ],
            "sub": "团队 OKR 落地推进",
            "right": "12月31日"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "早上好。今天有 "
          },
          {
            "text": "1 项风险",
            "em": true
          },
          {
            "text": "、"
          },
          {
            "text": "6 项待到期",
            "em": true
          },
          {
            "text": "："
          },
          {
            "text": "老房翻新改造",
            "em": true
          },
          {
            "text": " 剩余 12 天（42%）、"
          },
          {
            "text": "Rust 异步编程精读",
            "em": true
          },
          {
            "text": " 剩余 10 天（80%）。要我先排今天的顺序吗？"
          }
        ],
        "time": "16:04"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "先看全域。"
          }
        ],
        "time": "16:05"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "全域平均进度 "
          },
          {
            "text": "59%",
            "em": true
          },
          {
            "text": "，164 条任务完成 100 条（61%）。生活 70% 领先，工作 42% 落后 17 个百分点 —— 差距主要来自 "
          },
          {
            "text": "团队 OKR 落地推进",
            "em": true
          },
          {
            "text": "（12%，还没有实质排期）。"
          }
        ],
        "time": "16:05"
      }
    ],
    "enter": {
      "text": "已在工作台",
      "path": "/",
      "self": true
    }
  },
  {
    "key": "tasks",
    "label": "任务清单",
    "summary": "待办 64 · 已完成 100 / 164（61%）",
    "icon": "i-kanban",
    "focus": [
      {
        "name": "数据可视化课程实践",
        "meta": "作业 1-4 完成 · 进度 0%",
        "tag": "任务 0/14",
        "tone": "warn"
      },
      {
        "name": "团队 OKR 落地推进",
        "meta": "KR 拆解评审 · 进度 12%",
        "tag": "任务 3/18",
        "tone": "warn"
      },
      {
        "name": "老房翻新改造",
        "meta": "瓦工进场 · 进度 42%",
        "tag": "任务 9/24",
        "tone": "danger"
      },
      {
        "name": "马尔代夫家庭旅行",
        "meta": "行程终版确认 · 进度 68%",
        "tag": "任务 13/19",
        "tone": "ink"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-kanban",
        "title": "待办分布",
        "sub": "按业务域 · 柱高 = 待办条数",
        "value": "64",
        "unit": "条",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#0f9d76",
              "w": 26,
              "bars": [
                [
                  73,
                  25.2
                ]
              ]
            },
            {
              "color": "#2f6fed",
              "w": 26,
              "bars": [
                [
                  119,
                  30
                ]
              ]
            },
            {
              "color": "#7c3aed",
              "w": 26,
              "bars": [
                [
                  165,
                  21.6
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "生活",
          "工作",
          "学习"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-flag",
        "title": "优先级分布",
        "sub": "按项目优先级 · 柱高 = 项目数",
        "value": "8",
        "unit": "个",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#e5484d",
              "w": 26,
              "bars": [
                [
                  73,
                  15
                ]
              ]
            },
            {
              "color": "#e0a020",
              "w": 26,
              "bars": [
                [
                  119,
                  30
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 26,
              "bars": [
                [
                  165,
                  15
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "高",
          "中",
          "低"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-clock",
        "title": "紧急待办",
        "sub": "≤14 天到期的项目 · 柱高 = 剩余天数",
        "value": "3",
        "unit": "项",
        "dot": "bg-danger",
        "chart": {
          "groups": [
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  73,
                  21.4
                ],
                [
                  119,
                  25.7
                ],
                [
                  165,
                  27.9
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "10天",
          "12天",
          "13天"
        ]
      },
      {
        "kind": "list",
        "icon": "i-list",
        "title": "待办明细",
        "right": "未完成的 6 个项目",
        "body": [
          {
            "kind": "flat",
            "dot": "bg-learn",
            "grad": "bg-learn",
            "name": "Rust 异步编程精读",
            "meta": "待办 4 条 · 9月28日",
            "pct": 80
          },
          {
            "kind": "flat",
            "dot": "bg-life",
            "grad": "bg-life",
            "name": "老房翻新改造",
            "meta": "待办 15 条 · 9月30日",
            "pct": 42
          },
          {
            "kind": "flat",
            "dot": "bg-life",
            "grad": "bg-life",
            "name": "马尔代夫家庭旅行",
            "meta": "待办 6 条 · 10月01日",
            "pct": 68
          },
          {
            "kind": "flat",
            "dot": "bg-work",
            "grad": "bg-work",
            "name": "Q4 客户交付系统重构",
            "meta": "待办 10 条 · 11月15日",
            "pct": 72
          },
          {
            "kind": "flat",
            "dot": "bg-learn",
            "grad": "bg-learn",
            "name": "数据可视化课程实践",
            "meta": "待办 14 条 · 11月20日",
            "pct": 0
          },
          {
            "kind": "flat",
            "dot": "bg-work",
            "grad": "bg-work",
            "name": "团队 OKR 落地推进",
            "meta": "待办 15 条 · 12月31日",
            "pct": 12
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-layers",
        "title": "任务分布",
        "right": "按业务域",
        "body": [
          {
            "kind": "flat",
            "dot": "bg-life",
            "grad": "bg-life",
            "name": "生活",
            "meta": "33 / 54 条 · 待办 21",
            "pct": 61.1
          },
          {
            "kind": "flat",
            "dot": "bg-work",
            "grad": "bg-work",
            "name": "工作",
            "meta": "29 / 54 条 · 待办 25",
            "pct": 53.7
          },
          {
            "kind": "flat",
            "dot": "bg-learn",
            "grad": "bg-learn",
            "name": "学习",
            "meta": "38 / 56 条 · 待办 18",
            "pct": 67.9
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "当前 "
          },
          {
            "text": "64 条待办",
            "em": true
          },
          {
            "text": "，集中在三处："
          },
          {
            "text": "老房翻新改造",
            "em": true
          },
          {
            "text": " 15 条、"
          },
          {
            "text": "团队 OKR 落地推进",
            "em": true
          },
          {
            "text": " 15 条、"
          },
          {
            "text": "Q4 客户交付系统重构",
            "em": true
          },
          {
            "text": " 10 条。"
          }
        ],
        "time": "16:06"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "先把 ≤14 天的拉出来。"
          }
        ],
        "time": "16:07"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "3 个项目在 14 天内到期："
          },
          {
            "text": "Rust 异步编程精读",
            "em": true
          },
          {
            "text": "（10 天，剩 4 条）、"
          },
          {
            "text": "老房翻新改造",
            "em": true
          },
          {
            "text": "（12 天，剩 15 条）、"
          },
          {
            "text": "马尔代夫家庭旅行",
            "em": true
          },
          {
            "text": "（13 天，剩 6 条）。按剩余天数排序就是上面的顺序。"
          }
        ],
        "time": "16:07"
      }
    ],
    "enter": {
      "text": "进入任务清单",
      "path": "/work/tasks"
    }
  },
  {
    "key": "schedule",
    "label": "日程",
    "summary": "6 项待到期 · 最近 9月28日 · 2 项已归档",
    "icon": "i-calendar",
    "focus": [
      {
        "name": "Rust 异步编程精读",
        "meta": "mini-runtime 跑通 · 剩余 10 天",
        "tag": "9月28日",
        "tone": "warn"
      },
      {
        "name": "老房翻新改造",
        "meta": "瓦工进场 · 剩余 12 天",
        "tag": "9月30日",
        "tone": "warn"
      },
      {
        "name": "马尔代夫家庭旅行",
        "meta": "行程终版确认 · 剩余 13 天",
        "tag": "10月01日",
        "tone": "warn"
      },
      {
        "name": "Q4 客户交付系统重构",
        "meta": "灰度发布 · 剩余 58 天",
        "tag": "11月15日",
        "tone": "ink"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-calendar",
        "title": "到期分布",
        "sub": "未完成项目 · 柱高 = 该项目数",
        "value": "6",
        "unit": "项",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  40,
                  30
                ]
              ]
            },
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  92,
                  15
                ],
                [
                  144,
                  30
                ],
                [
                  196,
                  15
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "9月",
          "10月",
          "11月",
          "12月"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-flag",
        "title": "里程碑节点",
        "sub": "每个项目 1 个里程碑 · 按域着色",
        "value": "8",
        "unit": "条",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#0f9d76",
              "w": 26,
              "bars": [
                [
                  73,
                  30
                ]
              ]
            },
            {
              "color": "#2f6fed",
              "w": 26,
              "bars": [
                [
                  119,
                  20
                ]
              ]
            },
            {
              "color": "#7c3aed",
              "w": 26,
              "bars": [
                [
                  165,
                  30
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "生活",
          "工作",
          "学习"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-alert",
        "title": "风险与延期",
        "sub": "老房翻新改造 · 主卫瓷砖到货延迟",
        "value": "5",
        "unit": "天",
        "dot": "bg-danger",
        "chart": {
          "groups": [
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  96,
                  12.5
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 26,
              "bars": [
                [
                  142,
                  30
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "延期 5 天",
          "剩余 12 天"
        ]
      },
      {
        "kind": "list",
        "icon": "i-calendar",
        "title": "未来 6 周",
        "right": "按截止日排序",
        "body": [
          {
            "kind": "flat",
            "dot": "bg-learn",
            "grad": "bg-learn",
            "name": "Rust 异步编程精读",
            "meta": "9月28日 · 剩余 10 天",
            "pct": 80
          },
          {
            "kind": "flat",
            "dot": "bg-life",
            "grad": "bg-life",
            "name": "老房翻新改造",
            "meta": "9月30日 · 剩余 12 天",
            "pct": 42
          },
          {
            "kind": "flat",
            "dot": "bg-life",
            "grad": "bg-life",
            "name": "马尔代夫家庭旅行",
            "meta": "10月01日 · 剩余 13 天",
            "pct": 68
          },
          {
            "kind": "flat",
            "dot": "bg-work",
            "grad": "bg-work",
            "name": "Q4 客户交付系统重构",
            "meta": "11月15日 · 剩余 58 天",
            "pct": 72
          },
          {
            "kind": "flat",
            "dot": "bg-learn",
            "grad": "bg-learn",
            "name": "数据可视化课程实践",
            "meta": "11月20日 · 剩余 63 天",
            "pct": 0
          },
          {
            "kind": "flat",
            "dot": "bg-work",
            "grad": "bg-work",
            "name": "团队 OKR 落地推进",
            "meta": "12月31日 · 剩余 104 天",
            "pct": 12
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-flag",
        "title": "关键里程碑",
        "right": "8 个项目",
        "body": [
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "12 周计划达成"
              }
            ],
            "sub": "年度体检与健身计划",
            "right": "8月15日"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "正式上线"
              }
            ],
            "sub": "个人博客 v2 重写",
            "right": "8月30日"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "mini-runtime 跑通"
              }
            ],
            "sub": "Rust 异步编程精读",
            "right": "9月28日"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "瓦工进场"
              }
            ],
            "sub": "老房翻新改造",
            "right": "9月30日"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "行程终版确认"
              }
            ],
            "sub": "马尔代夫家庭旅行",
            "right": "10月01日"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "灰度发布"
              }
            ],
            "sub": "Q4 客户交付系统重构",
            "right": "11月15日"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "作业 1-4 完成"
              }
            ],
            "sub": "数据可视化课程实践",
            "right": "11月20日"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "KR 拆解评审"
              }
            ],
            "sub": "团队 OKR 落地推进",
            "right": "12月31日"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "8 个节点里 6 个待到期，最近的三个都在 9 月底：9月28日 "
          },
          {
            "text": "Rust 异步编程精读",
            "em": true
          },
          {
            "text": "、9月30日 "
          },
          {
            "text": "老房翻新改造",
            "em": true
          },
          {
            "text": "、10月01日 "
          },
          {
            "text": "马尔代夫家庭旅行",
            "em": true
          },
          {
            "text": "。"
          }
        ],
        "time": "16:08"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "11 月还有几个？"
          }
        ],
        "time": "16:08"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "2 个：11月15日 "
          },
          {
            "text": "Q4 客户交付系统重构",
            "em": true
          },
          {
            "text": "（里程碑：灰度发布）、11月20日 "
          },
          {
            "text": "数据可视化课程实践",
            "em": true
          },
          {
            "text": "（里程碑：作业 1-4 完成）。12月31日 是 "
          },
          {
            "text": "团队 OKR 落地推进",
            "em": true
          },
          {
            "text": "。"
          }
        ],
        "time": "16:09"
      }
    ],
    "enter": {
      "text": "进入日程",
      "path": "/work/calendar"
    }
  },
  {
    "key": "life",
    "label": "生活",
    "summary": "生活 70% · 3 个项目 · 54 条任务",
    "icon": "i-life",
    "focus": [
      {
        "name": "老房翻新改造",
        "meta": "瓦工进场 · 任务 9/24",
        "tag": "剩 12 天",
        "tone": "danger"
      },
      {
        "name": "马尔代夫家庭旅行",
        "meta": "行程终版确认 · 任务 13/19",
        "tag": "剩 13 天",
        "tone": "warn"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-trend",
        "title": "域完成度",
        "sub": "3 个项目 · 柱高 = 项目进度",
        "value": "70%",
        "dot": "bg-life",
        "chart": {
          "groups": [
            {
              "color": "#0f9d76",
              "w": 26,
              "bars": [
                [
                  73,
                  20.4
                ],
                [
                  119,
                  12.6
                ],
                [
                  165,
                  30
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "马尔代夫",
          "老房翻新",
          "年度体检"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-check-circle",
        "title": "任务进度",
        "sub": "已完成 33 / 54 条",
        "value": "61.1%",
        "dot": "bg-life",
        "chart": {
          "groups": [
            {
              "color": "#0f9d76",
              "w": 22,
              "bars": [
                [
                  11,
                  16.3
                ],
                [
                  105,
                  11.3
                ],
                [
                  199,
                  13.8
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 22,
              "bars": [
                [
                  39,
                  7.5
                ],
                [
                  133,
                  18.8
                ],
                [
                  227,
                  2
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "马尔代夫",
          "老房翻新",
          "年度体检"
        ],
        "legend": [
          [
            "bg-life",
            "已完成"
          ],
          [
            "bg-ink-300",
            "待办"
          ]
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-clock",
        "title": "到期压力",
        "sub": "2 个未完成项目 · 柱高 = 剩余天数",
        "value": "2",
        "unit": "项",
        "dot": "bg-danger",
        "chart": {
          "groups": [
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  96,
                  30
                ],
                [
                  142,
                  27.7
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "13 天",
          "12 天"
        ]
      },
      {
        "kind": "list",
        "icon": "i-project",
        "title": "项目明细",
        "right": "生活 · 3 个项目",
        "body": [
          {
            "kind": "project",
            "id": "p1"
          },
          {
            "kind": "project",
            "id": "p2"
          },
          {
            "kind": "project",
            "id": "p8"
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-clock",
        "title": "最近活动",
        "right": "生活 · 近 7 天",
        "body": [
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "LY",
                "em": true
              },
              {
                "text": " 更新了行程排期"
              }
            ],
            "sub": "马尔代夫家庭旅行",
            "right": "12 分钟前"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "LY",
                "em": true
              },
              {
                "text": " 完成了「预订接送机」"
              }
            ],
            "sub": "马尔代夫家庭旅行",
            "right": "2 小时前"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "LY",
                "em": true
              },
              {
                "text": " 调整了预算上限"
              }
            ],
            "sub": "老房翻新改造",
            "right": "昨天 18:40"
          },
          {
            "kind": "event",
            "dot": "bg-danger",
            "text": [
              {
                "text": "检测到工期延期 5 天",
                "em": true
              }
            ],
            "sub": "老房翻新改造",
            "right": "3 天前"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "今天有 1 项风险阻塞："
          },
          {
            "text": "老房翻新改造",
            "em": true
          },
          {
            "text": " 的工期已延期 5 天，我已把它排进今天的第一件事。"
          }
        ],
        "time": "16:07"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "按现在的进度，9 月 30 日还交得了吗？"
          }
        ],
        "time": "16:09"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "按剩余 12 天、当前 42% 的进度推算，按期概率约 "
          },
          {
            "text": "35%",
            "em": true
          },
          {
            "text": "。两条路：启用备用供应商，或顺延 7 天。"
          }
        ],
        "time": "16:09"
      }
    ],
    "enter": {
      "text": "进入生活主菜单",
      "path": "/life"
    }
  },
  {
    "key": "work",
    "label": "工作",
    "summary": "工作 42% · 2 个项目 · 54 条任务",
    "icon": "i-work",
    "focus": [
      {
        "name": "Q4 客户交付系统重构",
        "meta": "灰度发布 · 任务 26/36",
        "tag": "11月15日",
        "tone": "danger"
      },
      {
        "name": "团队 OKR 落地推进",
        "meta": "KR 拆解评审 · 任务 3/18",
        "tag": "12月31日",
        "tone": "ink"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-trend",
        "title": "域完成度",
        "sub": "2 个项目 · 柱高 = 项目进度",
        "value": "42%",
        "dot": "bg-work",
        "chart": {
          "groups": [
            {
              "color": "#2f6fed",
              "w": 26,
              "bars": [
                [
                  96,
                  21.6
                ],
                [
                  142,
                  3.6
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "Q4 重构",
          "团队 OKR"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-check-circle",
        "title": "任务进度",
        "sub": "已完成 29 / 54 条",
        "value": "53.7%",
        "dot": "bg-work",
        "chart": {
          "groups": [
            {
              "color": "#2f6fed",
              "w": 26,
              "bars": [
                [
                  11,
                  21.7
                ],
                [
                  105,
                  2.5
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 26,
              "bars": [
                [
                  63,
                  8.3
                ],
                [
                  157,
                  12.5
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "Q4 重构",
          "团队 OKR"
        ],
        "legend": [
          [
            "bg-work",
            "已完成"
          ],
          [
            "bg-ink-300",
            "待办"
          ]
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-alert",
        "title": "风险集中度",
        "sub": "1 项风险 · 距交付 58 天",
        "value": "1",
        "unit": "项",
        "dot": "bg-danger",
        "chart": {
          "groups": [
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  40,
                  21.7
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 26,
              "bars": [
                [
                  92,
                  8.3
                ]
              ]
            },
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  144,
                  3.6
                ],
                [
                  196,
                  21.6
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "已完成",
          "待办",
          "进行中",
          "推进中"
        ]
      },
      {
        "kind": "list",
        "icon": "i-project",
        "title": "项目明细",
        "right": "工作 · 2 个项目",
        "body": [
          {
            "kind": "project",
            "id": "p3"
          },
          {
            "kind": "project",
            "id": "p4"
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-clock",
        "title": "最近活动",
        "right": "工作 · 近 7 天",
        "body": [
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "ZQ",
                "em": true
              },
              {
                "text": " 提交了灰度发布检查单"
              }
            ],
            "sub": "Q4 客户交付系统重构",
            "right": "40 分钟前"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "LY",
                "em": true
              },
              {
                "text": " 更新了技术方案 v3"
              }
            ],
            "sub": "Q4 客户交付系统重构",
            "right": "昨天 15:20"
          },
          {
            "kind": "event",
            "dot": "bg-danger",
            "text": [
              {
                "text": "鉴权迁移存在兼容风险",
                "em": true
              }
            ],
            "sub": "Q4 客户交付系统重构",
            "right": "2 天前"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "HM",
                "em": true
              },
              {
                "text": " 拆解了 3 项 KR"
              }
            ],
            "sub": "团队 OKR 落地推进",
            "right": "4 天前"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "工作域平均进度 "
          },
          {
            "text": "42%",
            "em": true
          },
          {
            "text": "，低于全域 17 个百分点。主要拖累是 "
          },
          {
            "text": "团队 OKR 落地推进",
            "em": true
          },
          {
            "text": "（12%）。"
          }
        ],
        "time": "16:11"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "鉴权那个风险影响交付吗？"
          }
        ],
        "time": "16:12"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "Q4 客户交付系统重构",
            "em": true
          },
          {
            "text": " 还剩 58 天、进度 72%。风险点是旧版 Token 与新版 JWT 并存，需要灰度阶段验证双写一致性 —— 建议把它挂到里程碑「灰度发布」之前。"
          }
        ],
        "time": "16:12"
      }
    ],
    "enter": {
      "text": "进入工作主菜单",
      "path": "/work"
    }
  },
  {
    "key": "learn",
    "label": "学习",
    "summary": "学习 60% · 3 个项目 · 56 条任务",
    "icon": "i-learn",
    "focus": [
      {
        "name": "Rust 异步编程精读",
        "meta": "mini-runtime 跑通 · 任务 16/20",
        "tag": "剩 10 天",
        "tone": "warn"
      },
      {
        "name": "数据可视化课程实践",
        "meta": "作业 1-4 完成 · 任务 0/14",
        "tag": "11月20日",
        "tone": "ink"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-trend",
        "title": "域完成度",
        "sub": "3 个项目 · 柱高 = 项目进度",
        "value": "60%",
        "dot": "bg-learn",
        "chart": {
          "groups": [
            {
              "color": "#7c3aed",
              "w": 26,
              "bars": [
                [
                  73,
                  24
                ],
                [
                  119,
                  2
                ],
                [
                  165,
                  30
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "Rust 精读",
          "可视化课程",
          "博客 v2"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-check-circle",
        "title": "任务进度",
        "sub": "已完成 38 / 56 条",
        "value": "67.9%",
        "dot": "bg-learn",
        "chart": {
          "groups": [
            {
              "color": "#7c3aed",
              "w": 22,
              "bars": [
                [
                  11,
                  21.8
                ],
                [
                  105,
                  2
                ],
                [
                  199,
                  30
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 22,
              "bars": [
                [
                  39,
                  5.5
                ],
                [
                  133,
                  19.1
                ],
                [
                  227,
                  2
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "Rust 精读",
          "可视化课程",
          "博客 v2"
        ],
        "legend": [
          [
            "bg-learn",
            "已完成"
          ],
          [
            "bg-ink-300",
            "待办"
          ]
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-clock",
        "title": "到期压力",
        "sub": "2 个未完成项目 · 柱高 = 剩余天数",
        "value": "2",
        "unit": "项",
        "dot": "bg-danger",
        "chart": {
          "groups": [
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  96,
                  4.8
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 26,
              "bars": [
                [
                  142,
                  30
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "10 天",
          "63 天"
        ]
      },
      {
        "kind": "list",
        "icon": "i-project",
        "title": "项目明细",
        "right": "学习 · 3 个项目",
        "body": [
          {
            "kind": "project",
            "id": "p5"
          },
          {
            "kind": "project",
            "id": "p6"
          },
          {
            "kind": "project",
            "id": "p7"
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-clock",
        "title": "最近活动",
        "right": "学习 · 近 7 天",
        "body": [
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "LY",
                "em": true
              },
              {
                "text": " 完成了「第 5 章精读」"
              }
            ],
            "sub": "Rust 异步编程精读",
            "right": "1 小时前"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "LY",
                "em": true
              },
              {
                "text": " 提交了里程碑「正式上线」"
              }
            ],
            "sub": "个人博客 v2 重写",
            "right": "19 天前"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "LY",
                "em": true
              },
              {
                "text": " 整理了 6 篇读书笔记"
              }
            ],
            "sub": "Rust 异步编程精读",
            "right": "3 天前"
          },
          {
            "kind": "event",
            "dot": "bg-ink-400",
            "text": [
              {
                "text": "课程实践尚未开始（进度 0%）"
              }
            ],
            "sub": "数据可视化课程实践",
            "right": "待启动"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "学习域进度最好：平均 "
          },
          {
            "text": "60%",
            "em": true
          },
          {
            "text": "，56 条任务完成 38 条。但 "
          },
          {
            "text": "Rust 异步编程精读",
            "em": true
          },
          {
            "text": " 只剩 10 天、还差 4 条。"
          }
        ],
        "time": "16:13"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "另外那个课要开始吗？"
          }
        ],
        "time": "16:13"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "数据可视化课程实践",
            "em": true
          },
          {
            "text": " 还没开始（0%），距离截止 63 天、14 条作业。与 "
          },
          {
            "text": "Rust 异步编程精读",
            "em": true
          },
          {
            "text": " 的收尾期重叠 —— 建议先让精读收口，再开课。"
          }
        ],
        "time": "16:14"
      }
    ],
    "enter": {
      "text": "进入学习主菜单",
      "path": "/learning"
    }
  },
  {
    "key": "knowledge",
    "label": "知识库",
    "summary": "8 条文档索引 · 来源 8 个项目 · 正文不入库",
    "icon": "i-knowledge",
    "focus": [
      {
        "name": "旅行资料库",
        "meta": "马尔代夫家庭旅行 · 家庭可见",
        "tag": "索引",
        "tone": "ink"
      },
      {
        "name": "装修报价与图纸",
        "meta": "老房翻新改造 · 家庭可见",
        "tag": "索引",
        "tone": "ink"
      },
      {
        "name": "技术方案 v3",
        "meta": "Q4 客户交付系统重构 · 工作内部",
        "tag": "索引",
        "tone": "ink"
      },
      {
        "name": "OKR 对齐文档",
        "meta": "团队 OKR 落地推进 · 工作内部",
        "tag": "索引",
        "tone": "ink"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-knowledge",
        "title": "索引总量",
        "sub": "按归属域 · 柱高 = 索引条数",
        "value": "8",
        "unit": "条",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#0f9d76",
              "w": 26,
              "bars": [
                [
                  73,
                  30
                ]
              ]
            },
            {
              "color": "#2f6fed",
              "w": 26,
              "bars": [
                [
                  119,
                  20
                ]
              ]
            },
            {
              "color": "#7c3aed",
              "w": 26,
              "bars": [
                [
                  165,
                  30
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "生活",
          "工作",
          "学习"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-lock",
        "title": "可见性分布",
        "sub": "按可见性 · 柱高 = 条目数",
        "value": "4",
        "unit": "档",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  40,
                  30
                ]
              ]
            },
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  92,
                  20
                ]
              ]
            },
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  144,
                  20
                ]
              ]
            },
            {
              "color": "#9ba4b2",
              "w": 26,
              "bars": [
                [
                  196,
                  10
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "私有",
          "工作内部",
          "家庭可见",
          "公开"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-empty",
        "title": "数据接入",
        "sub": "尚未接入后端 · 索引为静态占位",
        "value": "—",
        "unit": "未接入",
        "dot": "bg-ink-300",
        "chart": null,
        "tail": {
          "kind": "planned",
          "items": [
            "永久笔记",
            "双链图谱",
            "附件管理"
          ],
          "note": "规划中"
        }
      },
      {
        "kind": "list",
        "icon": "i-knowledge",
        "title": "索引明细",
        "right": "8 条 · 按项目",
        "body": [
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "旅行资料库",
                "em": true
              }
            ],
            "sub": "马尔代夫家庭旅行",
            "right": "家庭可见"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "装修报价与图纸",
                "em": true
              }
            ],
            "sub": "老房翻新改造",
            "right": "家庭可见"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "技术方案 v3",
                "em": true
              }
            ],
            "sub": "Q4 客户交付系统重构",
            "right": "工作内部"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "OKR 对齐文档",
                "em": true
              }
            ],
            "sub": "团队 OKR 落地推进",
            "right": "工作内部"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "读书笔记合集",
                "em": true
              }
            ],
            "sub": "Rust 异步编程精读",
            "right": "私有"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "课程大纲",
                "em": true
              }
            ],
            "sub": "数据可视化课程实践",
            "right": "私有"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "设计系统说明",
                "em": true
              }
            ],
            "sub": "个人博客 v2 重写",
            "right": "公开"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "体检报告索引",
                "em": true
              }
            ],
            "sub": "年度体检与健身计划",
            "right": "私有"
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-layers",
        "title": "沉淀规则",
        "right": "模块设计 §5",
        "body": [
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "学习笔记成熟 → 升级为永久笔记"
              }
            ],
            "sub": "学习 → 知识库",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "工作通用知识 → 脱敏后入库"
              }
            ],
            "sub": "工作 → 知识库",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-brand-500",
            "text": [
              {
                "text": "项目产出 → 沉淀为知识条目"
              }
            ],
            "sub": "项目 → 知识库",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-danger",
            "text": [
              {
                "text": "工作机密、公司代码、客户数据不入库",
                "em": true
              }
            ],
            "sub": "红线",
            "right": "强制",
            "tone": "danger"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "当前 "
          },
          {
            "text": "8 条文档索引",
            "em": true
          },
          {
            "text": "全部来自项目的 docsUrl 字段，还没有独立的笔记库 —— 按设计文档，知识库在 MVP 阶段先并入学习模块。"
          }
        ],
        "time": "16:15"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "那这些索引现在能做什么？"
          }
        ],
        "time": "16:15"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "现在只能做\"找得到\"：每条索引指向一个项目、一个可见性等级（私有 3 / 工作内部 2 / 家庭可见 2 / 公开 1）。永久笔记、双链、附件都要等后端。"
          },
          {
            "text": "工作文档正文不入个人库",
            "em": true
          },
          {
            "text": "这条红线已经落在可见性上了。"
          }
        ],
        "time": "16:16"
      }
    ],
    "enter": {
      "text": "进入知识库",
      "path": "/knowledge"
    }
  },
  {
    "key": "project",
    "label": "项目",
    "summary": "8 个项目 · 进行中 3 · 风险 1",
    "icon": "i-project",
    "focus": [
      {
        "name": "老房翻新改造",
        "meta": "瓦工进场 · 任务 9/24",
        "tag": "42%",
        "tone": "danger"
      },
      {
        "name": "Q4 客户交付系统重构",
        "meta": "灰度发布 · 任务 26/36",
        "tag": "72%",
        "tone": "danger"
      },
      {
        "name": "数据可视化课程实践",
        "meta": "作业 1-4 完成 · 任务 0/14",
        "tag": "0%",
        "tone": "warn"
      },
      {
        "name": "团队 OKR 落地推进",
        "meta": "KR 拆解评审 · 任务 3/18",
        "tag": "12%",
        "tone": "warn"
      }
    ],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-kanban",
        "title": "状态分布",
        "sub": "按项目状态 · 柱高 = 项目数",
        "value": "8",
        "unit": "个",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#74808f",
              "w": 26,
              "bars": [
                [
                  40,
                  20
                ]
              ]
            },
            {
              "color": "#0f9d76",
              "w": 26,
              "bars": [
                [
                  92,
                  30
                ]
              ]
            },
            {
              "color": "#d82323",
              "w": 26,
              "bars": [
                [
                  144,
                  10
                ]
              ]
            },
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  196,
                  20
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "待启动",
          "进行中",
          "风险",
          "已完成"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-layers",
        "title": "域分布",
        "sub": "按业务域 · 柱高 = 项目数",
        "value": "8",
        "unit": "个",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#0f9d76",
              "w": 26,
              "bars": [
                [
                  73,
                  30
                ]
              ]
            },
            {
              "color": "#2f6fed",
              "w": 26,
              "bars": [
                [
                  119,
                  20
                ]
              ]
            },
            {
              "color": "#7c3aed",
              "w": 26,
              "bars": [
                [
                  165,
                  30
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "生活",
          "工作",
          "学习"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-file",
        "title": "预算规模",
        "sub": "3 个项目登记预算 · 柱高 = 预算（万元）",
        "value": "¥22.5万",
        "unit": "",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  73,
                  5.2
                ],
                [
                  119,
                  30
                ],
                [
                  165,
                  2
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "¥3.2万",
          "¥18.6万",
          "¥0.7万"
        ]
      },
      {
        "kind": "list",
        "icon": "i-project",
        "title": "项目明细",
        "right": "按进度降序",
        "body": [
          {
            "kind": "project",
            "id": "p7"
          },
          {
            "kind": "project",
            "id": "p8"
          },
          {
            "kind": "project",
            "id": "p5"
          },
          {
            "kind": "project",
            "id": "p3"
          },
          {
            "kind": "project",
            "id": "p1"
          },
          {
            "kind": "project",
            "id": "p2"
          },
          {
            "kind": "project",
            "id": "p4"
          },
          {
            "kind": "project",
            "id": "p6"
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-flag",
        "title": "里程碑",
        "right": "每个项目 1 个",
        "body": [
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "12 周计划达成"
              }
            ],
            "sub": "年度体检与健身计划",
            "right": "8月15日"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "正式上线"
              }
            ],
            "sub": "个人博客 v2 重写",
            "right": "8月30日"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "mini-runtime 跑通"
              }
            ],
            "sub": "Rust 异步编程精读",
            "right": "9月28日"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "瓦工进场"
              }
            ],
            "sub": "老房翻新改造",
            "right": "9月30日"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "行程终版确认"
              }
            ],
            "sub": "马尔代夫家庭旅行",
            "right": "10月01日"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "灰度发布"
              }
            ],
            "sub": "Q4 客户交付系统重构",
            "right": "11月15日"
          },
          {
            "kind": "event",
            "dot": "bg-learn",
            "text": [
              {
                "text": "作业 1-4 完成"
              }
            ],
            "sub": "数据可视化课程实践",
            "right": "11月20日"
          },
          {
            "kind": "event",
            "dot": "bg-work",
            "text": [
              {
                "text": "KR 拆解评审"
              }
            ],
            "sub": "团队 OKR 落地推进",
            "right": "12月31日"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "8 个项目：进行中 3、待启动 2、风险 1、已完成 2。平均进度 "
          },
          {
            "text": "59%",
            "em": true
          },
          {
            "text": "，最高的 "
          },
          {
            "text": "个人博客 v2 重写",
            "em": true
          },
          {
            "text": " 与 "
          },
          {
            "text": "年度体检与健身计划",
            "em": true
          },
          {
            "text": " 都到 100%。"
          }
        ],
        "time": "16:17"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "预算一共多少？"
          }
        ],
        "time": "16:17"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "只有 3 个项目带预算：马尔代夫 ¥32,000、老房翻新 ¥186,000、年度体检 ¥6,800，合计 "
          },
          {
            "text": "¥224,800",
            "em": true
          },
          {
            "text": "。其余 5 个是内部或学习类项目，未登记预算。"
          }
        ],
        "time": "16:18"
      }
    ],
    "enter": {
      "text": "进入项目主菜单",
      "path": "/projects"
    }
  },
  {
    "key": "settings",
    "label": "设置",
    "summary": "10 个设置页 · 可开关 6 个模块 · 4 类集成",
    "icon": "i-settings",
    "focus": [],
    "tiles": [
      {
        "kind": "kpi",
        "icon": "i-grid",
        "title": "模块开关",
        "sub": "设置 → 模块管理 · 开启/关闭",
        "value": "6",
        "unit": "个",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  73,
                  30
                ],
                [
                  119,
                  20
                ],
                [
                  165,
                  10
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "业务域",
          "统一层",
          "系统"
        ]
      },
      {
        "kind": "kpi",
        "icon": "i-settings",
        "title": "设置页",
        "sub": "每根柱 = 1 个设置页（模块设计 §6）",
        "value": "10",
        "unit": "页",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#4f46e5",
              "w": 16,
              "bars": [
                [
                  12,
                  24
                ],
                [
                  35.4,
                  24
                ],
                [
                  58.8,
                  24
                ],
                [
                  82.19999999999999,
                  24
                ],
                [
                  105.6,
                  24
                ],
                [
                  129,
                  24
                ],
                [
                  152.39999999999998,
                  24
                ],
                [
                  175.79999999999998,
                  24
                ],
                [
                  199.2,
                  24
                ],
                [
                  222.6,
                  24
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        }
      },
      {
        "kind": "kpi",
        "icon": "i-link",
        "title": "集成位",
        "sub": "设置 → 集成与 API",
        "value": "4",
        "unit": "类",
        "dot": "bg-brand-500",
        "chart": {
          "groups": [
            {
              "color": "#4f46e5",
              "w": 26,
              "bars": [
                [
                  40,
                  24
                ],
                [
                  92,
                  24
                ],
                [
                  144,
                  24
                ],
                [
                  196,
                  24
                ]
              ]
            }
          ],
          "width": 238,
          "height": 35,
          "baseline": 34
        },
        "labels": [
          "GitHub",
          "日历",
          "Notion",
          "Webhook"
        ]
      },
      {
        "kind": "list",
        "icon": "i-settings",
        "title": "设置页清单",
        "right": "10 页 · 均在规划中",
        "body": [
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "账户与安全",
                "em": true
              }
            ],
            "sub": "/settings/account",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "模块管理",
                "em": true
              }
            ],
            "sub": "/settings/modules",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "主题与外观",
                "em": true
              }
            ],
            "sub": "/settings/appearance",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "通知提醒",
                "em": true
              }
            ],
            "sub": "/settings/notifications",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "数据与备份",
                "em": true
              }
            ],
            "sub": "/settings/data",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "导入导出",
                "em": true
              }
            ],
            "sub": "/settings/import-export",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "集成与 API",
                "em": true
              }
            ],
            "sub": "/settings/integrations",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "权限与隐私",
                "em": true
              }
            ],
            "sub": "/settings/privacy",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "快捷键",
                "em": true
              }
            ],
            "sub": "/settings/shortcuts",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "关于",
                "em": true
              }
            ],
            "sub": "/settings/about",
            "right": "规划中"
          }
        ]
      },
      {
        "kind": "list",
        "icon": "i-lock",
        "title": "边界与红线",
        "right": "模块设计 §6",
        "body": [
          {
            "kind": "event",
            "dot": "bg-brand-500",
            "text": [
              {
                "text": "模块开关控制 6 个模块的显示与隐藏"
              }
            ],
            "sub": "模块管理",
            "right": "全局"
          },
          {
            "kind": "event",
            "dot": "bg-life",
            "text": [
              {
                "text": "隐私过滤：工作机密 / 生活隐私 / 学习公开范围"
              }
            ],
            "sub": "权限与隐私",
            "right": "分级"
          },
          {
            "kind": "event",
            "dot": "bg-ink-300",
            "text": [
              {
                "text": "数据导出：Markdown / CSV / JSON"
              }
            ],
            "sub": "导入导出",
            "right": "规划中"
          },
          {
            "kind": "event",
            "dot": "bg-danger",
            "text": [
              {
                "text": "审计日志：登录、导出、集成调用",
                "em": true
              }
            ],
            "sub": "权限与隐私",
            "right": "强制",
            "tone": "danger"
          }
        ]
      }
    ],
    "chat": [
      {
        "role": "ai",
        "content": [
          {
            "text": "设置模块有 10 个页面、可开关 6 个模块、4 类集成位 —— 都在设计文档里定好了，但"
          },
          {
            "text": "本轮原型没有设置界面",
            "em": true
          },
          {
            "text": "。"
          }
        ],
        "time": "16:19"
      },
      {
        "role": "user",
        "content": [
          {
            "text": "那先不做？"
          }
        ],
        "time": "16:19"
      },
      {
        "role": "ai",
        "content": [
          {
            "text": "按 MVP 顺序，设置排在最后一步（账户、模块管理、主题、数据导出）。现在最该确认的是"
          },
          {
            "text": "模块开关",
            "em": true
          },
          {
            "text": "：它决定了除工作台之外的 8 个模块能不能被隐藏。"
          }
        ],
        "time": "16:20"
      }
    ],
    "enter": {
      "text": "进入设置",
      "path": "/settings"
    }
  }
]
