'use client'

import { useEffect } from 'react'
import { markNotificationsRead } from '@/actions/notifications'

export function AutoMarkRead({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (ids.length > 0) markNotificationsRead(ids)
  }, [])

  return null
}
