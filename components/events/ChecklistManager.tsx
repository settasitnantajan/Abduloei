'use client'

import { useState } from 'react'
import { EventChecklistItem } from '@/lib/types/events'
import { addChecklistItem } from '@/app/actions/events'
import ChecklistItem from './ChecklistItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlusIcon, CheckSquareIcon } from 'lucide-react'
import { toast } from 'sonner'

interface ChecklistManagerProps {
  eventId: string
  items: EventChecklistItem[]
  onItemsChange?: (items: EventChecklistItem[]) => void
  editable?: boolean
}

export default function ChecklistManager({
  eventId,
  items: initialItems,
  onItemsChange,
  editable = true
}: ChecklistManagerProps) {
  const [items, setItems] = useState<EventChecklistItem[]>(initialItems)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Add new item
  const handleAddItem = async () => {
    if (!newItemTitle.trim()) {
      toast.error('กรุณากรอกข้อความ')
      return
    }

    setIsAdding(true)

    const { success, item, error } = await addChecklistItem(
      eventId,
      newItemTitle.trim()
    )

    setIsAdding(false)

    if (success && item) {
      const updatedItems = [...items, item]
      setItems(updatedItems)
      onItemsChange?.(updatedItems)
      setNewItemTitle('')
      toast.success('เพิ่มรายการแล้ว')
    } else {
      toast.error(error || 'ไม่สามารถเพิ่มรายการได้')
    }
  }

  // Handle item update
  const handleItemUpdate = (updatedItem: EventChecklistItem) => {
    const updatedItems = items.map(item =>
      item.id === updatedItem.id ? updatedItem : item
    )
    setItems(updatedItems)
    onItemsChange?.(updatedItems)
  }

  // Handle item delete
  const handleItemDelete = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId)
    setItems(updatedItems)
    onItemsChange?.(updatedItems)
  }

  // Calculate completion stats
  const completedCount = items.filter(item => item.completed).length
  const totalCount = items.length
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3">
          <CheckSquareIcon className="w-5 h-5 text-gray-400" />
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 font-medium">
                รายการ ({completedCount}/{totalCount})
              </span>
              <span className="text-gray-400">
                {Math.round(completionPercentage)}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-1">
        {items.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            ยังไม่มีรายการ
          </div>
        ) : (
          items.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              onUpdate={handleItemUpdate}
              onDelete={handleItemDelete}
              editable={editable}
            />
          ))
        )}
      </div>

      {/* Add new item input */}
      {editable && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
          <Input
            placeholder="เพิ่มรายการใหม่..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem()
            }}
            disabled={isAdding}
            className="flex-1 h-9"
          />
          <Button
            size="sm"
            onClick={handleAddItem}
            disabled={isAdding || !newItemTitle.trim()}
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            เพิ่ม
          </Button>
        </div>
      )}
    </div>
  )
}
