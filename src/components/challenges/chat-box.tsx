'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendMessage } from '@/actions/challenges'
import { toast } from 'sonner'
import { MessageSquare, Send } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  message: string
  created_at: string
  author_profile_id: string
  author: { name: string } | null
}

interface Props {
  challengeId: string
  messages: Message[]
  profileId: string
  profileName: string
  canMessage: boolean
}

export function ChatBox({
  challengeId,
  messages,
  profileId,
  profileName,
  canMessage,
}: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    if (!text.trim()) return
    setLoading(true)
    try {
      await sendMessage(challengeId, text)
      setText('')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao enviar mensagem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <MessageSquare className="size-4" />
        Chat do desafio
      </h2>

      <div className="space-y-2 mb-3 max-h-80 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem mensagens ainda.
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.author_profile_id === profileId
          return (
            <div
              key={msg.id}
              className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                  isMe
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted rounded-tl-sm'
                )}
              >
                {!isMe && (
                  <p className="text-xs font-medium mb-0.5 opacity-70">
                    {msg.author?.name ?? 'Organização'}
                  </p>
                )}
                <p>{msg.message}</p>
                <p
                  className={cn(
                    'text-[10px] mt-0.5',
                    isMe ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'
                  )}
                >
                  {format(new Date(msg.created_at), 'HH:mm')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {canMessage && (
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreve uma mensagem..."
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !text.trim()}
            size="icon"
            className="shrink-0 self-end"
          >
            <Send className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
