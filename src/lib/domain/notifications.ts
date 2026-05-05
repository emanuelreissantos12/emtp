// Tipos de notificação para consistência em toda a app

export const NOTIFICATION_TYPES = {
  CHALLENGE_RECEIVED: 'challenge_received',
  CHALLENGE_PROPOSAL: 'challenge_proposal',
  CHALLENGE_SLOT_ACCEPTED: 'challenge_slot_accepted',
  CHALLENGE_MESSAGE: 'challenge_message',
  CHALLENGE_EXPIRING: 'challenge_expiring',
  CHALLENGE_EXPIRED: 'challenge_expired',
  RESULT_SUBMITTED: 'result_submitted',
  RESULT_VALIDATED: 'result_validated',
  RESULT_REJECTED: 'result_rejected',
  WALKOVER_REQUESTED: 'walkover_requested',
  ADMIN_DECISION: 'admin_decision',
  RANKING_CHANGED: 'ranking_changed',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export interface NotificationPayload {
  type: NotificationType
  title: string
  body: string
  action_url?: string
}

export function buildChallengeReceivedNotification(
  challengerName: string,
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.CHALLENGE_RECEIVED,
    title: 'Novo desafio recebido',
    body: `A dupla ${challengerName} desafiou-vos.`,
    action_url: `/challenges/${challengeId}`,
  }
}

export function buildResultSubmittedNotification(
  teamName: string,
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.RESULT_SUBMITTED,
    title: 'Resultado submetido para validação',
    body: `A dupla ${teamName} submeteu o resultado do jogo.`,
    action_url: `/challenges/${challengeId}`,
  }
}

export function buildResultValidatedNotification(
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.RESULT_VALIDATED,
    title: 'Resultado validado',
    body: 'O resultado foi validado. O ranking foi atualizado.',
    action_url: `/challenges/${challengeId}`,
  }
}

export function buildProposalReceivedNotification(
  teamName: string,
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.CHALLENGE_PROPOSAL,
    title: 'Nova proposta de horário',
    body: `A dupla ${teamName} propôs um horário para o jogo.`,
    action_url: `/challenges/${challengeId}`,
  }
}

export function buildProposalAcceptedNotification(
  teamName: string,
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.CHALLENGE_SLOT_ACCEPTED,
    title: 'Horário aceite',
    body: `A dupla ${teamName} aceitou o horário proposto. A aguardar confirmação do admin.`,
    action_url: `/challenges/${challengeId}`,
  }
}

export function buildMatchConfirmedNotification(
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.CHALLENGE_SLOT_ACCEPTED,
    title: 'Jogo confirmado',
    body: 'O horário foi confirmado pelo admin. Bom jogo!',
    action_url: `/challenges/${challengeId}`,
  }
}

export function buildChallengeCancelledNotification(
  cancellerName: string,
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.CHALLENGE_RECEIVED,
    title: 'Desafio anulado',
    body: `O desafio foi anulado por ${cancellerName}.`,
    action_url: `/challenges/${challengeId}`,
  }
}

export function buildChallengeExpiringNotification(
  daysLeft: number,
  challengeId: string
): NotificationPayload {
  return {
    type: NOTIFICATION_TYPES.CHALLENGE_EXPIRING,
    title: `Desafio expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
    body: 'Acorda um horário antes do prazo terminar.',
    action_url: `/challenges/${challengeId}`,
  }
}
