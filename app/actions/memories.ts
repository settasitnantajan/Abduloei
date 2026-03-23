'use server';

import { createClient } from '@/lib/supabase/server';
import { retrieveMemories } from '@/lib/db/memories';

import * as memoriesDb from '@/lib/db/memories';

export async function processMessageForMemories(text: string, messageId: string) {
  return memoriesDb.processMessageForMemories(text, messageId);
}

/**
 * Get all memories for current user
 */
export async function getUserMemories(category?: 'personal' | 'family' | 'preferences' | 'important_dates' | 'habits' | 'goals') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { memories: [], error: 'Not authenticated' };
  }

  return retrieveMemories(user.id, category);
}

/**
 * Add new memory manually
 */
export async function addMemory(
  category: 'personal' | 'family' | 'preferences' | 'important_dates' | 'habits' | 'goals',
  key: string,
  value: string
) {
  const { storeMemory } = await import('@/lib/db/memories');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  return storeMemory(user.id, category, key, value, 1.0);
}

/**
 * Update existing memory
 */
export async function editMemory(
  memoryId: string,
  value: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('user_memories')
    .update({ value, confidence: 1.0 })
    .eq('id', memoryId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Remove memory
 */
export async function removeMemory(memoryId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('user_memories')
    .delete()
    .eq('id', memoryId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
