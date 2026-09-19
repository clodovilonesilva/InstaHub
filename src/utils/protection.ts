import type { UserRecord, ProtectionType } from '../types';

export interface ProtectionInfo {
  isProtected: boolean;
  type: 'forever' | 'temporary_active' | 'temporary_expired' | 'none';
  daysFollowing: number;
  daysRemaining: number;
  followedAt: number | null;
  label: string;
  badgeColor: string;
}

/**
 * Calcula o número de dias decorridos desde um timestamp
 */
export function calculateDaysFollowing(timestamp?: number | null): number {
  if (!timestamp || typeof timestamp !== 'number') return 0;
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Retorna as informações completas de proteção de um perfil
 */
export function getProtectionInfo(
  user: UserRecord,
  tempDays: number = 7
): ProtectionInfo {
  // Determina o tipo de proteção base (com compatibilidade com registros legados)
  let rawType: ProtectionType = user.protectionType || (user.protected ? 'forever' : 'none');

  if (rawType === 'none' || (!user.protected && !user.protectionType)) {
    return {
      isProtected: false,
      type: 'none',
      daysFollowing: calculateDaysFollowing(user.followedAt),
      daysRemaining: 0,
      followedAt: user.followedAt || null,
      label: 'Sem proteção',
      badgeColor: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  }

  if (rawType === 'forever') {
    return {
      isProtected: true,
      type: 'forever',
      daysFollowing: calculateDaysFollowing(user.followedAt),
      daysRemaining: Infinity,
      followedAt: user.followedAt || null,
      label: 'Pra Sempre',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    };
  }

  // Proteção Temporária: compara a data atual com o dia em que começou a seguir
  // Se followedAt não existir, usa updatedAt ou a data atual como fallback
  const followTime = user.followedAt || user.updatedAt || Date.now();
  const daysFollowing = calculateDaysFollowing(followTime);
  const daysRemaining = Math.max(0, tempDays - daysFollowing);
  const isActive = daysFollowing < tempDays;

  if (isActive) {
    return {
      isProtected: true,
      type: 'temporary_active',
      daysFollowing,
      daysRemaining,
      followedAt: user.followedAt || null,
      label: `Temporária (${daysRemaining}d restantes)`,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }

  // Prazo expirado / Liberado
  const daysOverdue = daysFollowing - tempDays;
  return {
    isProtected: false,
    type: 'temporary_expired',
    daysFollowing,
    daysRemaining: 0,
    followedAt: user.followedAt || null,
    label: daysOverdue > 0 ? `Liberado (expirou há ${daysOverdue}d)` : 'Liberado (prazo atingido)',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  };
}

/**
 * Verifica se o contato é considerado "não bom" para remoção/limpeza:
 * - Só eu sigo (iFollow = true)
 * - Não me segue de volta (followsMe = false)
 * - Não é proteção sempre (não tem interesse permanente)
 * - Se tinha proteção temporária, o período de carência já expirou
 */
export function isBadContactForCleaning(
  user: UserRecord,
  tempDays: number = 7
): boolean {
  if (!user.iFollow) return false;
  if (user.followsMe) return false;

  const info = getProtectionInfo(user, tempDays);
  // Se possui proteção sempre ou temporária ativa, não deve ser removido
  if (info.isProtected || info.type === 'forever') {
    return false;
  }

  return true;
}

/**
 * Formata um timestamp de data em formato brasileiro
 */
export function formatFollowDate(timestamp?: number | null): string {
  if (!timestamp) return 'Não registrado';
  try {
    const d = new Date(timestamp);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'Data inválida';
  }
}

/**
 * Formata um timestamp de data com texto relativo amigável
 */
export function formatRelativeFollowTime(timestamp?: number | null): string {
  if (!timestamp) return 'Data não informada';
  const days = calculateDaysFollowing(timestamp);
  if (days === 0) return 'Começou hoje';
  if (days === 1) return 'Começou ontem';
  if (days < 30) return `Há ${days} dias`;
  if (days < 60) return 'Há ~1 mês';
  const months = Math.floor(days / 30);
  return `Há ${months} meses (${days} dias)`;
}
