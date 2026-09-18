import type { CSSProperties } from 'react'
import { ownerAvatarStyle, memberAvatarStyle } from '../../data/derive'
import { cn } from '../../lib/cn'

type AvatarSize = 'md' | 'sm' | 'xs'

const SIZES: Record<AvatarSize, string> = {
  md: 'h-8 w-8 rounded-[9px] text-12-5',
  sm: 'h-[26px] w-[26px] rounded-[7px] text-10-5',
  xs: 'h-[22px] w-[22px] rounded-[6px] text-9-5',
}

interface AvatarProps {
  name: string
  size?: AvatarSize
  /** 不传则按名字哈希配色（详情页做法） */
  style?: CSSProperties
  className?: string
}

export function Avatar({ name, size = 'md', style, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-bold tracking-[.02em] text-white',
        SIZES[size],
        className,
      )}
      style={style ?? { background: memberAvatarStyle(name) }}
    >
      {name}
    </span>
  )
}

/**
 * 列表卡片 / 表格 / 看板里的负责人头像组：
 * 按索引取色（原型 projects.html 的 owners()），重叠 -8px。
 */
export function OwnerAvatars({ owners, className }: { owners: string[]; className?: string }) {
  return (
    <span className={cn('flex', className)}>
      {owners.map((owner, index) => (
        <span
          key={`${owner}-${index}`}
          className={cn(
            // 描边要"挖出"上一层头像，所以不能用半透明的 bg-surface（会透出底下的人像）。
            // 固定在接近不透明的白，与玻璃底衬的亮度一致，重叠处才干净。
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2 border-white/90 text-10 font-bold tracking-[.02em] text-white',
            index > 0 && '-ml-2',
          )}
          style={{ background: ownerAvatarStyle(index) }}
        >
          {owner}
        </span>
      ))}
    </span>
  )
}
