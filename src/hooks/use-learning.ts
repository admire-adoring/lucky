/**
 * 学习域 hooks。6 张表各自一组。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createGoal, deleteGoal, fetchGoals, updateGoal, learningKeys,
  createSkill, deleteSkill, fetchSkills, updateSkill,
  createResource, deleteResource, fetchResources, updateResource,
  createReview, deleteReview, fetchReviews, fetchReviewsDue, gradeReview, updateReview,
  createOutput, deleteOutput, fetchOutputs, updateOutput,
  createStudyLog, deleteStudyLog, fetchStudyLogs,
  fetchLearningOverview,
  type LearningGoalInput, type LearningSkillInput, type LearningResourceInput,
  type LearningReviewInput, type LearningOutputInput,
} from '../api/learning'
import { toast } from '../stores/toast-store'

/* ---------- 概览 ---------- */
export function useLearningOverview() {
  return useQuery({ queryKey: learningKeys.overview(), queryFn: fetchLearningOverview })
}

/* ---------- 目标 ---------- */
export function useGoals() {
  return useQuery({ queryKey: learningKeys.goals(), queryFn: fetchGoals })
}
export function useGoalActions() {
  const qc = useQueryClient()
  const invalidate = () => { qc.invalidateQueries({ queryKey: learningKeys.goals() }); qc.invalidateQueries({ queryKey: learningKeys.overview() }) }
  const create = useMutation({
    mutationFn: createGoal,
    onSuccess: () => { invalidate(); toast('已添加目标') },
    onError: (e: Error) => toast(`添加失败：${e.message}`),
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LearningGoalInput }) => updateGoal(id, input),
    onSuccess: () => { invalidate(); toast('已更新') },
    onError: (e: Error) => toast(`更新失败：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => { invalidate(); toast('已删除') },
    onError: (e: Error) => toast(`删除失败：${e.message}`),
  })
  return { create, update, remove }
}

/* ---------- 技能 ---------- */
export function useSkills() {
  return useQuery({ queryKey: learningKeys.skills(), queryFn: fetchSkills })
}
export function useSkillActions() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: learningKeys.skills() })
  const create = useMutation({
    mutationFn: createSkill,
    onSuccess: () => { invalidate(); toast('已添加技能') },
    onError: (e: Error) => toast(`添加失败：${e.message}`),
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LearningSkillInput }) => updateSkill(id, input),
    onSuccess: () => { invalidate(); toast('已更新') },
    onError: (e: Error) => toast(`更新失败：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: deleteSkill,
    onSuccess: () => { invalidate(); toast('已删除') },
    onError: (e: Error) => toast(`删除失败：${e.message}`),
  })
  return { create, update, remove }
}

/* ---------- 资源 ---------- */
export function useResources() {
  return useQuery({ queryKey: learningKeys.resources(), queryFn: fetchResources })
}
export function useResourceActions() {
  const qc = useQueryClient()
  const invalidate = () => { qc.invalidateQueries({ queryKey: learningKeys.resources() }); qc.invalidateQueries({ queryKey: learningKeys.overview() }) }
  const create = useMutation({
    mutationFn: createResource,
    onSuccess: () => { invalidate(); toast('已添加资源') },
    onError: (e: Error) => toast(`添加失败：${e.message}`),
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LearningResourceInput }) => updateResource(id, input),
    onSuccess: () => { invalidate(); toast('已更新') },
    onError: (e: Error) => toast(`更新失败：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: deleteResource,
    onSuccess: () => { invalidate(); toast('已删除') },
    onError: (e: Error) => toast(`删除失败：${e.message}`),
  })
  return { create, update, remove }
}

/* ---------- 复习 ---------- */
export function useReviews() {
  return useQuery({ queryKey: learningKeys.reviews(), queryFn: fetchReviews })
}
export function useReviewsDue(today: string) {
  return useQuery({ queryKey: learningKeys.reviewsDue(today), queryFn: () => fetchReviewsDue(today) })
}
export function useReviewActions() {
  const qc = useQueryClient()
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['learning', 'review'] }); qc.invalidateQueries({ queryKey: learningKeys.overview() }) }
  const create = useMutation({
    mutationFn: createReview,
    onSuccess: () => { invalidate(); toast('已添加复习卡') },
    onError: (e: Error) => toast(`添加失败：${e.message}`),
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LearningReviewInput }) => updateReview(id, input),
    onSuccess: () => { invalidate(); toast('已更新') },
    onError: (e: Error) => toast(`更新失败：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => { invalidate(); toast('已删除') },
    onError: (e: Error) => toast(`删除失败：${e.message}`),
  })
  const grade = useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: number }) => gradeReview(id, grade),
    onSuccess: () => { invalidate(); toast('已记录评分') },
    onError: (e: Error) => toast(`评分失败：${e.message}`),
  })
  return { create, update, remove, grade }
}

/* ---------- 输出 ---------- */
export function useOutputs() {
  return useQuery({ queryKey: learningKeys.outputs(), queryFn: fetchOutputs })
}
export function useOutputActions() {
  const qc = useQueryClient()
  const invalidate = () => { qc.invalidateQueries({ queryKey: learningKeys.outputs() }); qc.invalidateQueries({ queryKey: learningKeys.overview() }) }
  const create = useMutation({
    mutationFn: createOutput,
    onSuccess: () => { invalidate(); toast('已添加输出') },
    onError: (e: Error) => toast(`添加失败：${e.message}`),
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LearningOutputInput }) => updateOutput(id, input),
    onSuccess: () => { invalidate(); toast('已更新') },
    onError: (e: Error) => toast(`更新失败：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: deleteOutput,
    onSuccess: () => { invalidate(); toast('已删除') },
    onError: (e: Error) => toast(`删除失败：${e.message}`),
  })
  return { create, update, remove }
}

/* ---------- 学习日志 ---------- */
export function useStudyLogs(limit = 50) {
  return useQuery({ queryKey: learningKeys.logs(limit), queryFn: () => fetchStudyLogs(limit) })
}
export function useStudyLogActions() {
  const qc = useQueryClient()
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['learning', 'log'] }); qc.invalidateQueries({ queryKey: learningKeys.overview() }) }
  const create = useMutation({
    mutationFn: createStudyLog,
    onSuccess: () => { invalidate(); toast('已记录学习') },
    onError: (e: Error) => toast(`记录失败：${e.message}`),
  })
  const remove = useMutation({
    mutationFn: deleteStudyLog,
    onSuccess: () => { invalidate(); toast('已删除') },
    onError: (e: Error) => toast(`删除失败：${e.message}`),
  })
  return { create, remove }
}
