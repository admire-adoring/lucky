/**
 * 学习域数据访问层。全部走真实后端。
 * 6 张表：目标 / 技能 / 资源 / 复习 / 输出 / 学习日志。
 */
import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/* ============ 学习目标 ============ */

export interface LearningGoal {
  id: string
  title: string
  description: string
  progress: number
  targetDate: string
  status: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface LearningGoalInput {
  title: string
  description: string
  progress: number
  targetDate: string
  status: string
}

export function fetchGoals() {
  return call<LearningGoal[]>(() => invoke<LearningGoal[]>('goal_list'))
}
export function createGoal(input: LearningGoalInput) {
  return call<LearningGoal>(() => invoke<LearningGoal>('goal_create', { input }))
}
export function updateGoal(id: string, input: LearningGoalInput) {
  return call<LearningGoal>(() => invoke<LearningGoal>('goal_update', { id, input }))
}
export function deleteGoal(id: string) {
  return call<void>(() => invoke<void>('goal_delete', { id }))
}

/* ============ 技能 ============ */

export interface LearningSkill {
  id: string
  name: string
  level: number
  category: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface LearningSkillInput {
  name: string
  level: number
  category: string
}

export function fetchSkills() {
  return call<LearningSkill[]>(() => invoke<LearningSkill[]>('skill_list'))
}
export function createSkill(input: LearningSkillInput) {
  return call<LearningSkill>(() => invoke<LearningSkill>('skill_create', { input }))
}
export function updateSkill(id: string, input: LearningSkillInput) {
  return call<LearningSkill>(() => invoke<LearningSkill>('skill_update', { id, input }))
}
export function deleteSkill(id: string) {
  return call<void>(() => invoke<void>('skill_delete', { id }))
}

/* ============ 学习资源 ============ */

export interface LearningResource {
  id: string
  title: string
  kind: string
  progress: number
  tags: string
  status: string
  lastStudyAt: string
  ownerId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface LearningResourceInput {
  title: string
  kind: string
  progress: number
  tags: string
  status: string
  lastStudyAt: string
  ownerId: string
}

export function fetchResources() {
  return call<LearningResource[]>(() => invoke<LearningResource[]>('learning_resource_list'))
}
export function createResource(input: LearningResourceInput) {
  return call<LearningResource>(() => invoke<LearningResource>('learning_resource_create', { input }))
}
export function updateResource(id: string, input: LearningResourceInput) {
  return call<LearningResource>(() => invoke<LearningResource>('learning_resource_update', { id, input }))
}
export function deleteResource(id: string) {
  return call<void>(() => invoke<void>('learning_resource_delete', { id }))
}

/* ============ 复习卡片 ============ */

export interface LearningReview {
  id: string
  question: string
  answer: string
  tag: string
  dueDate: string
  intervalDays: number
  easeFactor: number
  reviewedCount: number
  ownerId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface LearningReviewInput {
  question: string
  answer: string
  tag: string
  dueDate: string
  ownerId: string
}

export function fetchReviews() {
  return call<LearningReview[]>(() => invoke<LearningReview[]>('review_list'))
}
export function fetchReviewsDue(today: string) {
  return call<LearningReview[]>(() => invoke<LearningReview[]>('review_due', { today }))
}
export function createReview(input: LearningReviewInput) {
  return call<LearningReview>(() => invoke<LearningReview>('review_create', { input }))
}
export function updateReview(id: string, input: LearningReviewInput) {
  return call<LearningReview>(() => invoke<LearningReview>('review_update', { id, input }))
}
export function deleteReview(id: string) {
  return call<void>(() => invoke<void>('review_delete', { id }))
}
/** SM-2 评分：grade 0-3 */
export function gradeReview(id: string, grade: number) {
  return call<LearningReview>(() => invoke<LearningReview>('review_grade', { id, grade }))
}

/* ============ 输出作品 ============ */

export interface LearningOutput {
  id: string
  title: string
  kind: string
  status: string
  publishedAt: string
  url: string
  summary: string
  ownerId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface LearningOutputInput {
  title: string
  kind: string
  status: string
  publishedAt: string
  url: string
  summary: string
  ownerId: string
}

export function fetchOutputs() {
  return call<LearningOutput[]>(() => invoke<LearningOutput[]>('output_list'))
}
export function createOutput(input: LearningOutputInput) {
  return call<LearningOutput>(() => invoke<LearningOutput>('output_create', { input }))
}
export function updateOutput(id: string, input: LearningOutputInput) {
  return call<LearningOutput>(() => invoke<LearningOutput>('output_update', { id, input }))
}
export function deleteOutput(id: string) {
  return call<void>(() => invoke<void>('output_delete', { id }))
}

/* ============ 学习日志 ============ */

export interface LearningStudyLog {
  id: string
  logDate: string
  durationMin: number
  resourceId: string
  note: string
  ownerId: string
  createdAt: string
}

export interface LearningStudyLogInput {
  logDate: string
  durationMin: number
  resourceId: string
  note: string
  ownerId: string
}

export function fetchStudyLogs(limit = 50) {
  return call<LearningStudyLog[]>(() => invoke<LearningStudyLog[]>('study_log_list', { limit }))
}
export function createStudyLog(input: LearningStudyLogInput) {
  return call<LearningStudyLog>(() => invoke<LearningStudyLog>('study_log_create', { input }))
}
export function deleteStudyLog(id: string) {
  return call<void>(() => invoke<void>('study_log_delete', { id }))
}

/* ============ 概览统计 ============ */

export interface LearningOverview {
  weekMinutes: number
  pendingReview: number
  activeResource: number
  todayReview: number
  totalOutput: number
  activeGoal: number
}

export function fetchLearningOverview() {
  return call<LearningOverview>(() => invoke<LearningOverview>('learning_overview'))
}

export const learningKeys = {
  all: ['learning'] as const,
  overview: () => [...learningKeys.all, 'overview'] as const,
  goals: () => [...learningKeys.all, 'goals'] as const,
  skills: () => [...learningKeys.all, 'skills'] as const,
  resources: () => [...learningKeys.all, 'resources'] as const,
  reviews: () => [...learningKeys.all, 'review', 'all'] as const,
  reviewsDue: (today: string) => [...learningKeys.all, 'review', 'due', today] as const,
  outputs: () => [...learningKeys.all, 'outputs'] as const,
  logs: (limit: number) => [...learningKeys.all, 'log', limit] as const,
}
