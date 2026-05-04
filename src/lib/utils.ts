import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TZ = 'Europe/Lisbon'

/** Formata data+hora em fuso de Portugal — funciona em servidor (UTC) e cliente */
export function formatPT(
  datetime: string | Date,
  opts: { weekday?: boolean; date?: boolean; time?: boolean } = { date: true, time: true }
): string {
  const d = typeof datetime === 'string' ? new Date(datetime) : datetime
  const fmt: Intl.DateTimeFormatOptions = { timeZone: TZ }
  if (opts.weekday) fmt.weekday = 'long'
  if (opts.date) { fmt.day = '2-digit'; fmt.month = 'short'; fmt.year = 'numeric' }
  if (opts.time) { fmt.hour = '2-digit'; fmt.minute = '2-digit'; fmt.hour12 = false }
  return d.toLocaleString('pt-PT', fmt)
}
