import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  contactKeys,
  createContact,
  deleteContact,
  listContacts,
  updateContact,
  type ContactInput,
} from '../api/contacts'
import type { Contact } from '../api/contacts'

/** 页面要的两档角色：客户 / 团队（合作方归团队）。 */
export type ContactSide = 'client' | 'team'

export interface ContactRow {
  id: string
  name: string
  /** 头像用的那一字（姓名首字） */
  avatar: string
  /** 副标题：职务，或"公司 · 职务" */
  meta: string
  side: ContactSide
  org: string
}

export function sideOf(contact: Contact): ContactSide {
  return contact.roleCode === 'customer' ? 'client' : 'team'
}

export function useContacts(): ContactRow[] {
  const { data } = useQuery({
    queryKey: contactKeys.list(),
    queryFn: () => listContacts(),
    staleTime: 60 * 1000,
  })
  return (data ?? []).map((contact) => ({
    id: contact.id,
    name: contact.name,
    avatar: contact.name.slice(0, 1),
    meta: [contact.org, contact.title].filter(Boolean).join(' · ') || contact.note || '—',
    side: sideOf(contact),
    org: contact.org,
  }))
}

export function useContactMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: contactKeys.all })

  return {
    create: useMutation({ mutationFn: (input: ContactInput) => createContact(input), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ContactInput }) => updateContact(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteContact(id), onSuccess: invalidate }),
  }
}
