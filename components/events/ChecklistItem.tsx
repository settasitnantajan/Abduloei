'use client'

import { useState } from 'react'
import { EventChecklistItem } from '@/lib/types/events'
import { updateChecklistItem, deleteChecklistItem } from '@/app/actions/events'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Trash2Icon, EditIcon, CheckIcon, XIcon, UserIcon } from 'lucide-react'
import { toast } from 'sonner'

interface ChecklistItemProps {
  item: EventChecklistItem
  onUpdate?: (updatedItem: EventChecklistItem) => void
  onDelete?: (itemId: string) => void
  editable?: boolean
}

export default function ChecklistItem({
  item,
  onUpdate,
  onDelete,
  editable = true
}: ChecklistItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const [isUpdating, setIsUpdating] = useState(false)

  // Toggle completed status
  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true)

    const { success, item: updatedItem, error } = await updateChecklistItem(item.id, {
      completed: checked
    })

    setIsUpdating(false)

    if (success && updatedItem) {
      onUpdate?.(updatedItem)
      toast.success(checked ? 'ทำเสร็จแล้ว!' : 'ยังไม่เสร็จ')
    } else {
      toast.error(error || 'ไม่สามารถอัพเดทได้')
    }
  }

  // Save edited title
  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      toast.error('กรุณากรอกข้อความ')
      return
    }

    setIsUpdating(true)

    const { success, item: updatedItem, error } = await updateChecklistItem(item.id, {
      title: editTitle.trim()
    })

    setIsUpdating(false)

    if (success && updatedItem) {
      onUpdate?.(updatedItem)
      setIsEditing(false)
      toast.success('แก้ไขเรียบร้อย')
    } else {
      toast.error(error || 'ไม่สามารถแก้ไขได้')
    }
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditTitle(item.title)
    setIsEditing(false)
  }

  // Delete item
  const handleDelete = async () => {
    if (!confirm('ต้องการลบรายการนี้หรือไม่?')) {
      return
    }

    setIsUpdating(true)

    const { success, error } = await deleteChecklistItem(item.id)

    setIsUpdating(false)

    if (success) {
      onDelete?.(item.id)
      toast.success('ลบเรียบร้อย')
    } else {
      toast.error(error || 'ไม่สามารถลบได้')
    }
  }

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
      {/* Checkbox - Wrapped for better touch target */}
      <div className="flex items-center justify-center w-11 h-11 flex-shrink-0">
        <Checkbox
          checked={item.completed}
          onCheckedChange={handleToggle}
          disabled={isUpdating}
          className="w-5 h-5"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit()
                if (e.key === 'Escape') handleCancelEdit()
              }}
              disabled={isUpdating}
              className="h-8 text-sm"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSaveEdit}
              disabled={isUpdating}
            >
              <CheckIcon className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              disabled={isUpdating}
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm ${
                item.completed
                  ? 'line-through text-gray-500'
                  : 'text-gray-200'
              }`}
            >
              {item.title}
            </span>

            {/* Assignee Badge */}
            {item.assignee && (
              <Badge variant="secondary" className="text-xs gap-1">
                <UserIcon className="w-3 h-3" />
                {item.assignee}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Actions (visible on hover) - Larger touch targets */}
      {editable && !isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            disabled={isUpdating}
            className="h-11 w-11"
          >
            <EditIcon className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            disabled={isUpdating}
            className="h-11 w-11 text-red-400 hover:text-red-300"
          >
            <Trash2Icon className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  )
}
