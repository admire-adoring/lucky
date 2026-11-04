/**
 * 设置项 hooks。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteSetting,
  fetchSettings,
  fetchSettingsByCategory,
  setSettingValue,
  upsertSetting,
  type SettingItemInput,
} from '../api/settings'
import { settingKeys } from '../api/settings'
import { toast } from '../stores/toast-store'

export function useSettings() {
  return useQuery({
    queryKey: settingKeys.list(),
    queryFn: fetchSettings,
  })
}

export function useSettingsByCategory(category: string) {
  return useQuery({
    queryKey: settingKeys.category(category),
    queryFn: () => fetchSettingsByCategory(category),
  })
}

export function useSettingActions() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: settingKeys.all })
  }
  return {
    upsert: useMutation({
      mutationFn: (input: SettingItemInput) => upsertSetting(input),
      onSuccess: () => invalidate(),
      onError: (e: Error) => toast(`保存失败：${e.message}`),
    }),
    setValue: useMutation({
      mutationFn: ({ key, value }: { key: string; value: string }) => setSettingValue(key, value),
      onSuccess: () => invalidate(),
      onError: (e: Error) => toast(`保存失败：${e.message}`),
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteSetting(id),
      onSuccess: () => {
        invalidate()
        toast('已删除设置项')
      },
      onError: (e: Error) => toast(`删除失败：${e.message}`),
    }),
  }
}
