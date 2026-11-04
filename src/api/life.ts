/**
 * 生活域数据访问层。全部走真实后端。
 */
import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

export interface LifeHabit {
  id: string
  name: string
  icon: string
  color: string
  targetPerWeek: number
  enabled: boolean
  sortOrder: number
  createdAt: string
}

export interface LifeHabitInput {
  name: string
  icon: string
  color: string
  targetPerWeek: number
  enabled: boolean
}

export interface LifeHabitLog {
  id: string
  habitId: string
  logDate: string
  done: boolean
}

export interface LifeFinance {
  id: string
  kind: string
  amountCents: number
  category: string
  note: string
  logDate: string
  sortOrder: number
  createdAt: string
}

export interface LifeFinanceInput {
  kind: string
  amountCents: number
  category: string
  note: string
  logDate: string
}

export interface LifeWorkout {
  id: string
  kind: string
  durationMin: number
  distanceKm: number
  calories: number
  note: string
  logDate: string
  sortOrder: number
  createdAt: string
}

export interface LifeWorkoutInput {
  kind: string
  durationMin: number
  distanceKm: number
  calories: number
  note: string
  logDate: string
}

export interface LifeRecipe {
  id: string
  name: string
  ingredients: string
  steps: string
  tags: string
  sortOrder: number
  createdAt: string
}

export interface LifeRecipeInput {
  name: string
  ingredients: string
  steps: string
  tags: string
}

export interface LifePet {
  id: string
  name: string
  species: string
  birthDate: string
  reminder: string
  sortOrder: number
  createdAt: string
}

export interface LifePetInput {
  name: string
  species: string
  birthDate: string
  reminder: string
}

export interface LifeJournal {
  id: string
  logDate: string
  mood: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface LifeJournalInput {
  logDate: string
  mood: string
  content: string
}

export const lifeKeys = {
  all: ['life'] as const,
  habits: () => [...lifeKeys.all, 'habits'] as const,
  finance: (limit: number) => [...lifeKeys.all, 'finance', limit] as const,
  workouts: (limit: number) => [...lifeKeys.all, 'workouts', limit] as const,
  recipes: () => [...lifeKeys.all, 'recipes'] as const,
  pets: () => [...lifeKeys.all, 'pets'] as const,
  journal: (limit: number) => [...lifeKeys.all, 'journal', limit] as const,
}

function invokeList<T>(cmd: string, args?: Record<string, unknown>): Promise<T[]> {
  return call(() => invoke<T[]>(cmd, args))
}

export const fetchHabits = () => invokeList<LifeHabit>('habit_list')
export const createHabit = (input: LifeHabitInput) => call(() => invoke<LifeHabit>('habit_create', { input }))
export const updateHabit = (id: string, input: LifeHabitInput) => call(() => invoke<LifeHabit>('habit_update', { id, input }))
export const deleteHabit = (id: string) => call(() => invoke<void>('habit_delete', { id }))
export const toggleHabitLog = (habitId: string, logDate: string) => call(() => invoke<void>('habit_toggle_log', { habitId, logDate }))

export const fetchFinance = (limit = 100) => invokeList<LifeFinance>('finance_list', { limit })
export const createFinance = (input: LifeFinanceInput) => call(() => invoke<LifeFinance>('finance_create', { input }))
export const deleteFinance = (id: string) => call(() => invoke<void>('finance_delete', { id }))

export const fetchWorkouts = (limit = 50) => invokeList<LifeWorkout>('workout_list', { limit })
export const createWorkout = (input: LifeWorkoutInput) => call(() => invoke<LifeWorkout>('workout_create', { input }))
export const deleteWorkout = (id: string) => call(() => invoke<void>('workout_delete', { id }))

export const fetchRecipes = () => invokeList<LifeRecipe>('recipe_list')
export const createRecipe = (input: LifeRecipeInput) => call(() => invoke<LifeRecipe>('recipe_create', { input }))
export const updateRecipe = (id: string, input: LifeRecipeInput) => call(() => invoke<LifeRecipe>('recipe_update', { id, input }))
export const deleteRecipe = (id: string) => call(() => invoke<void>('recipe_delete', { id }))

export const fetchPets = () => invokeList<LifePet>('pet_list')
export const createPet = (input: LifePetInput) => call(() => invoke<LifePet>('pet_create', { input }))
export const updatePet = (id: string, input: LifePetInput) => call(() => invoke<LifePet>('pet_update', { id, input }))
export const deletePet = (id: string) => call(() => invoke<void>('pet_delete', { id }))

export const fetchJournal = (limit = 30) => invokeList<LifeJournal>('journal_list', { limit })
export const getJournalByDate = (logDate: string) => call(() => invoke<LifeJournal | null>('journal_get_by_date', { logDate }))
export const upsertJournal = (input: LifeJournalInput) => call(() => invoke<LifeJournal>('journal_upsert', { input }))
export const deleteJournal = (id: string) => call(() => invoke<void>('journal_delete', { id }))
