import { memberAvatarStyle, ownerDisplayName } from '../../data/derive'
import type { ActivityItem } from '../../types'
import { Avatar } from '../ui/Avatar'

/** 项目动态（原型 .feed）：头像锚定在时间线左侧 */
export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  return (
    <div className="relative pl-[34px]">
      {activity.map((item, index) => {
        const isLast = index === activity.length - 1

        return (
          <div key={item.id} className={isLast ? 'relative' : 'relative pb-5'}>
            {!isLast ? <span className="absolute bottom-[-4px] left-[-22px] top-6 w-[1.5px] bg-line" /> : null}

            <span className="absolute left-[-34px] top-0">
              <Avatar name={item.who} size="xs" style={{ background: memberAvatarStyle(item.who) }} />
            </span>

            <div className="text-13-5 leading-[1.7] text-ink-700">
              <b className="font-[650] text-ink-900">{ownerDisplayName(item.who)}</b> {item.action}
            </div>
            <div className="mt-0.5 text-11-5 text-ink-400">{item.time}</div>
          </div>
        )
      })}
    </div>
  )
}
