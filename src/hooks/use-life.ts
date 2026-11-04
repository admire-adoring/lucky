/**
 * 生活域 hooks。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFinance,
  createHabit,
  createPet,
  createRecipe,
  createWorkout,
  deleteFinance,
  deleteHabit,
  deleteJournal,
  deletePet,
  deleteRecipe,
  deleteWorkout,
  fetchFinance,
  fetchHabits,
  fetchJournal,
  fetchPets,
  fetchRecipes,
  fetchWorkouts,
  lifeKeys,
  toggleHabitLog,
  updateHabit,
  updatePet,
  updateRecipe,
  upsertJournal,
  type LifeFinanceInput,
  type LifeHabitInput,
  type LifeJournalInput,
  type LifePetInput,
  type LifeRecipeInput,
  type LifeWorkoutInput,
} from '../api/life'
import { toast } from '../stores/toast-store'

export function useHabits() {
  return useQuery({ queryKey: lifeKeys.habits(), queryFn: fetchHabits })
}

export function useFinance(limit = 100) {
  return useQuery({ queryKey: lifeKeys.finance(limit), queryFn: () => fetchFinance(limit) })
}

export function useWorkouts(limit = 50) {
  return useQuery({ queryKey: lifeKeys.workouts(limit), queryFn: () => fetchWorkouts(limit) })
}

export function useRecipes() {
  return useQuery({ queryKey: lifeKeys.recipes(), queryFn: fetchRecipes })
}

export function usePets() {
  return useQuery({ queryKey: lifeKeys.pets(), queryFn: fetchPets })
}

export function useJournal(limit = 30) {
  return useQuery({ queryKey: lifeKeys.journal(limit), queryFn: () => fetchJournal(limit) })
}

export function useLifeActions() {
  const queryClient = useQueryClient()
  const invalidate = (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key })
  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: lifeKeys.all })
  return {
    habit: {
      create: useMutation({
        mutationFn: (input: LifeHabitInput) => createHabit(input),
        onSuccess: () => { invalidate(lifeKeys.habits()); toast('已添加习惯') },
        onError: (e: Error) => toast(`添加失败：${e.message}`),
      }),
      update: useMutation({
        mutationFn: ({ id, input }: { id: string; input: LifeHabitInput }) => updateHabit(id, input),
        onSuccess: () => invalidate(lifeKeys.habits()),
        onError: (e: Error) => toast(`保存失败：${e.message}`),
      }),
      remove: useMutation({
        mutationFn: (id: string) => deleteHabit(id),
        onSuccess: () => { invalidate(lifeKeys.habits()); toast('已删除习惯') },
        onError: (e: Error) => toast(`删除失败：${e.message}`),
      }),
      toggleLog: useMutation({
        mutationFn: ({ habitId, logDate }: { habitId: string; logDate: string }) => toggleHabitLog(habitId, logDate),
        onSuccess: () => invalidate(lifeKeys.habits()),
        onError: (e: Error) => toast(`打卡失败：${e.message}`),
      }),
    },
    finance: {
      create: useMutation({
        mutationFn: (input: LifeFinanceInput) => createFinance(input),
        onSuccess: () => invalidateAll(),
        onError: (e: Error) => toast(`添加失败：${e.message}`),
      }),
      remove: useMutation({
        mutationFn: (id: string) => deleteFinance(id),
        onSuccess: () => invalidateAll(),
        onError: (e: Error) => toast(`删除失败：${e.message}`),
      }),
    },
    workout: {
      create: useMutation({
        mutationFn: (input: LifeWorkoutInput) => createWorkout(input),
        onSuccess: () => invalidateAll(),
        onError: (e: Error) => toast(`添加失败：${e.message}`),
      }),
      remove: useMutation({
        mutationFn: (id: string) => deleteWorkout(id),
        onSuccess: () => invalidateAll(),
        onError: (e: Error) => toast(`删除失败：${e.message}`),
      }),
    },
    recipe: {
      create: useMutation({
        mutationFn: (input: LifeRecipeInput) => createRecipe(input),
        onSuccess: () => invalidate(lifeKeys.recipes()),
        onError: (e: Error) => toast(`添加失败：${e.message}`),
      }),
      update: useMutation({
        mutationFn: ({ id, input }: { id: string; input: LifeRecipeInput }) => updateRecipe(id, input),
        onSuccess: () => invalidate(lifeKeys.recipes()),
        onError: (e: Error) => toast(`保存失败：${e.message}`),
      }),
      remove: useMutation({
        mutationFn: (id: string) => deleteRecipe(id),
        onSuccess: () => { invalidate(lifeKeys.recipes()); toast('已删除食谱') },
        onError: (e: Error) => toast(`删除失败：${e.message}`),
      }),
    },
    pet: {
      create: useMutation({
        mutationFn: (input: LifePetInput) => createPet(input),
        onSuccess: () => invalidate(lifeKeys.pets()),
        onError: (e: Error) => toast(`添加失败：${e.message}`),
      }),
      update: useMutation({
        mutationFn: ({ id, input }: { id: string; input: LifePetInput }) => updatePet(id, input),
        onSuccess: () => invalidate(lifeKeys.pets()),
        onError: (e: Error) => toast(`保存失败：${e.message}`),
      }),
      remove: useMutation({
        mutationFn: (id: string) => deletePet(id),
        onSuccess: () => { invalidate(lifeKeys.pets()); toast('已删除宠物') },
        onError: (e: Error) => toast(`删除失败：${e.message}`),
      }),
    },
    journal: {
      upsert: useMutation({
        mutationFn: (input: LifeJournalInput) => upsertJournal(input),
        onSuccess: () => { invalidate(lifeKeys.journal(30)); toast('已保存日记') },
        onError: (e: Error) => toast(`保存失败：${e.message}`),
      }),
      remove: useMutation({
        mutationFn: (id: string) => deleteJournal(id),
        onSuccess: () => { invalidate(lifeKeys.journal(30)); toast('已删除日记') },
        onError: (e: Error) => toast(`删除失败：${e.message}`),
      }),
    },
  }
}
