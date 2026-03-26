'use server'

import * as notesDb from '@/lib/db/notes'
import { CreateNoteInput, UpdateNoteInput } from '@/lib/types/notes'

export async function createNote(data: CreateNoteInput) {
  return notesDb.createNote(data)
}

export async function getUserNotes() {
  return notesDb.getUserNotes()
}

export async function updateNote(noteId: string, data: UpdateNoteInput) {
  return notesDb.updateNote(noteId, data)
}

export async function deleteNote(noteId: string) {
  return notesDb.deleteNote(noteId)
}
