'use server'

import * as db from '@/lib/db/expiry'
import type { ExpiryItemInput } from '@/lib/db/expiry'

export async function getExpiryItems() {
  return db.getExpiryItems()
}

export async function createExpiryItem(input: ExpiryItemInput) {
  return db.createExpiryItem(input)
}

export async function updateExpiryItem(itemId: string, input: ExpiryItemInput) {
  return db.updateExpiryItem(itemId, input)
}

export async function deleteExpiryItem(itemId: string) {
  return db.deleteExpiryItem(itemId)
}
