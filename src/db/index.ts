import Dexie, { type Table } from 'dexie';
import type { UserRecord, UserStatusResult, SyncMode, InstagramSyncSummary, ProtectionType } from '../types';
import { getProtectionInfo, isBadContactForCleaning } from '../utils/protection';

export class InstaHubDatabase extends Dexie {
  users!: Table<UserRecord, string>;

  constructor() {
    super('InstaHubDB');
    this.version(1).stores({
      users: 'username, name, iFollow, followsMe, everFollowed, protected, updatedAt',
    });
    this.version(2).stores({
      users: 'username, name, iFollow, followsMe, everFollowed, protected, updatedAt, followedAt, protectionType',
    });
    this.version(3).stores({
      users: 'username, name, iFollow, followsMe, everFollowed, protected, updatedAt, followedAt, protectionType, protectedAt',
    });
  }
}

export const db = new InstaHubDatabase();

export function normalizeUsername(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Quick batch query to check a list of usernames
 */
export async function checkUsersBatch(
  rawUsernames: string[],
  tempDays: number = 7
): Promise<Record<string, UserStatusResult>> {
  const normalizedMap = new Map<string, string>();
  for (const raw of rawUsernames) {
    const norm = normalizeUsername(raw);
    if (norm) {
      normalizedMap.set(norm, raw);
    }
  }

  const queryKeys = Array.from(normalizedMap.keys());
  if (queryKeys.length === 0) return {};

  const existingUsers = await db.users.where('username').anyOf(queryKeys).toArray();
  const existingMap = new Map<string, UserRecord>();
  for (const u of existingUsers) {
    existingMap.set(u.username, u);
  }

  const results: Record<string, UserStatusResult> = {};

  for (const [normUsername] of normalizedMap) {
    const user = existingMap.get(normUsername);
    if (!user) {
      results[normUsername] = {
        username: normUsername,
        found: false,
        status: 'neverFollowed',
        isProtected: false,
        protectionType: 'none',
      };
    } else {
      let status: 'following' | 'previouslyFollowed' | 'neverFollowed' = 'neverFollowed';
      if (user.iFollow) {
        status = 'following';
      } else if (user.everFollowed) {
        status = 'previouslyFollowed';
      }

      const protInfo = getProtectionInfo(user, tempDays);

      results[normUsername] = {
        username: normUsername,
        found: true,
        status,
        isProtected: protInfo.isProtected,
        protectionType: user.protectionType || (user.protected ? 'forever' : 'none'),
        followedAt: user.followedAt,
        protectedAt: user.protectedAt,
        daysRemaining: protInfo.daysRemaining,
        isTemporaryActive: protInfo.type === 'temporary_active',
        user,
      };
    }
  }

  return results;
}

/**
 * Record a follow/unfollow user interaction
 */
export async function recordFollowInteraction(
  usernameRaw: string,
  name?: string,
  action: 'follow' | 'unfollow' = 'follow',
  followedAt?: number
): Promise<UserRecord> {
  const username = normalizeUsername(usernameRaw);
  if (!username) throw new Error('Username inválido');

  const existing = await db.users.get(username);
  const now = Date.now();

  let updatedRecord: UserRecord;

  if (action === 'follow') {
    const followDate = followedAt || existing?.followedAt || now;
    const existingType = existing?.protectionType || (existing?.protected ? 'forever' : 'none');

    updatedRecord = {
      username,
      name: name || existing?.name || username,
      iFollow: true,
      followsMe: existing ? existing.followsMe : false,
      everFollowed: true, // Quando segue, já seguiu vira true
      protected: existingType !== 'none',
      protectionType: existingType,
      followedAt: followDate,
      updatedAt: now,
      notes: existing?.notes,
    };
  } else {
    // Unfollow
    const existingType = existing?.protectionType || (existing?.protected ? 'forever' : 'none');
    updatedRecord = {
      username,
      name: name || existing?.name || username,
      iFollow: false,
      followsMe: existing ? existing.followsMe : false,
      everFollowed: true, // Já segui permanece true mesmo após unfollow
      protected: existingType !== 'none',
      protectionType: existingType,
      followedAt: existing?.followedAt,
      updatedAt: now,
      notes: existing?.notes,
    };
  }

  await db.users.put(updatedRecord);
  return updatedRecord;
}

/**
 * Define explicitamente o tipo de proteção de um perfil
 */
export async function setUserProtection(
  usernameRaw: string,
  protectionType: ProtectionType,
  name?: string
): Promise<UserRecord> {
  const username = normalizeUsername(usernameRaw);
  if (!username) throw new Error('Username inválido');

  const existing = await db.users.get(username);
  const now = Date.now();
  const isProt = protectionType !== 'none';
  const protectedAt =
    protectionType === 'temporary'
      ? existing?.protectionType === 'temporary' && existing?.protectedAt
        ? existing.protectedAt
        : now
      : undefined;

  const updatedRecord: UserRecord = existing
    ? {
        ...existing,
        protected: isProt,
        protectionType,
        protectedAt,
        followedAt: existing.followedAt || (existing.iFollow ? now : undefined),
        updatedAt: now,
      }
    : {
        username,
        name: name || username,
        iFollow: false,
        followsMe: false,
        everFollowed: false,
        protected: isProt,
        protectionType,
        protectedAt,
        updatedAt: now,
      };

  await db.users.put(updatedRecord);
  return updatedRecord;
}

/**
 * Toggle or set protected (whitelist) status
 */
export async function toggleUserProtected(
  usernameRaw: string,
  name?: string,
  preferredType?: ProtectionType
): Promise<UserRecord> {
  const username = normalizeUsername(usernameRaw);
  if (!username) throw new Error('Username inválido');

  const existing = await db.users.get(username);
  const now = Date.now();

  let newProtectionType: ProtectionType;
  if (preferredType) {
    newProtectionType = preferredType;
  } else if (!existing) {
    newProtectionType = 'forever';
  } else {
    const currentType = existing.protectionType || (existing.protected ? 'forever' : 'none');
    newProtectionType = currentType === 'none' ? 'forever' : 'none';
  }

  const isProt = newProtectionType !== 'none';
  const protectedAt =
    newProtectionType === 'temporary'
      ? existing?.protectionType === 'temporary' && existing?.protectedAt
        ? existing.protectedAt
        : now
      : undefined;

  const updatedRecord: UserRecord = existing
    ? {
        ...existing,
        protected: isProt,
        protectionType: newProtectionType,
        protectedAt,
        followedAt: existing.followedAt || (existing.iFollow ? now : undefined),
        updatedAt: now,
      }
    : {
        username,
        name: name || username,
        iFollow: false,
        followsMe: false,
        everFollowed: false,
        protected: isProt,
        protectionType: newProtectionType,
        protectedAt,
        updatedAt: now,
      };

  await db.users.put(updatedRecord);
  return updatedRecord;
}

/**
 * Atualiza em massa o tipo de proteção para uma lista de usernames
 */
export async function bulkSetProtection(
  rawUsernames: string[],
  protectionType: ProtectionType
): Promise<{ modifiedCount: number }> {
  const queryKeys = rawUsernames.map((u) => normalizeUsername(u)).filter(Boolean);
  if (queryKeys.length === 0) return { modifiedCount: 0 };

  const now = Date.now();
  const isProt = protectionType !== 'none';
  const existingUsers = await db.users.where('username').anyOf(queryKeys).toArray();

  const toSave: UserRecord[] = existingUsers.map((u) => ({
    ...u,
    protected: isProt,
    protectionType,
    protectedAt: protectionType === 'temporary' ? now : undefined,
    followedAt: u.followedAt || (u.iFollow ? now : undefined),
    updatedAt: now,
  }));

  if (toSave.length > 0) {
    await db.users.bulkPut(toSave);
  }

  return { modifiedCount: toSave.length };
}

/**
 * Import user records from JSON array
 */
export async function importUsersFromJson(rawJson: unknown): Promise<{
  totalCount: number;
  addedCount: number;
  updatedCount: number;
  errors: string[];
}> {
  let list: unknown[] = [];
  if (Array.isArray(rawJson)) {
    list = rawJson;
  } else if (typeof rawJson === 'object' && rawJson !== null && 'users' in rawJson && Array.isArray((rawJson as { users: unknown[] }).users)) {
    list = (rawJson as { users: unknown[] }).users;
  } else if (typeof rawJson === 'object' && rawJson !== null && 'username' in rawJson) {
    list = [rawJson];
  } else {
    throw new Error('Formato JSON inválido. Esperava-se um array de usuários ou objeto de usuário.');
  }

  const errors: string[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  const now = Date.now();

  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Partial<UserRecord>;
    if (!item || typeof item !== 'object' || !item.username) {
      errors.push(`Item na linha ${i + 1} sem campo "username" obrigatório.`);
      continue;
    }

    const username = normalizeUsername(String(item.username));
    if (!username) {
      errors.push(`Item na linha ${i + 1} possui username inválido.`);
      continue;
    }

    const existing = await db.users.get(username);

    // Business rule: If iFollow is true, everFollowed must be true as well
    const iFollow = Boolean(item.iFollow);
    const everFollowed = iFollow ? true : Boolean(item.everFollowed ?? existing?.everFollowed ?? false);
    const followsMe = Boolean(item.followsMe);

    const hadFollowingRecord = existing && (existing.iFollow || existing.everFollowed);
    const isReciprocalFollow =
      hadFollowingRecord &&
      !existing.followsMe &&
      followsMe &&
      iFollow;

    const rawProtType = item.protectionType;
    let protectionType: ProtectionType;
    let protectedAt = item.protectedAt || existing?.protectedAt;

    if (rawProtType === 'forever' || rawProtType === 'temporary' || rawProtType === 'none') {
      protectionType = rawProtType;
    } else if (item.protected) {
      protectionType = 'forever';
    } else if (isReciprocalFollow) {
      const existingProtType = existing?.protectionType || (existing?.protected ? 'forever' : 'none');
      if (existingProtType !== 'forever') {
        protectionType = 'temporary';
        protectedAt = now;
      } else {
        protectionType = 'forever';
      }
    } else {
      protectionType = existing?.protectionType || (existing?.protected ? 'forever' : 'none');
    }

    if (protectionType === 'temporary' && !protectedAt) {
      protectedAt = now;
    } else if (protectionType !== 'temporary') {
      protectedAt = undefined;
    }

    const followedAt =
      typeof item.followedAt === 'number'
        ? item.followedAt
        : iFollow
        ? existing?.followedAt || now
        : existing?.followedAt;

    const recordToSave: UserRecord = {
      username,
      name: item.name ? String(item.name).trim() : existing?.name || username,
      iFollow,
      followsMe,
      everFollowed,
      protected: protectionType !== 'none',
      protectionType,
      protectedAt,
      followedAt,
      updatedAt: now,
      notes: typeof item.notes === 'string' ? item.notes : existing?.notes,
    };

    if (existing) {
      updatedCount++;
    } else {
      addedCount++;
    }

    await db.users.put(recordToSave);
  }

  return {
    totalCount: list.length,
    addedCount,
    updatedCount,
    errors,
  };
}

export interface DashboardStats {
  total: number;
  iFollow: number;
  followsMe: number;
  notFollowingBack: number;
  cleanUnreciprocal: number;
  mutual: number;
  fans: number;
  everFollowed: number;
  protectedCount: number;
  protectedForeverCount: number;
  protectedTemporaryActiveCount: number;
  protectedTemporaryExpiredCount: number;
}

export async function getDashboardStats(tempDays: number = 7): Promise<DashboardStats> {
  const all = await db.users.toArray();
  let iFollow = 0;
  let followsMe = 0;
  let notFollowingBack = 0;
  let cleanUnreciprocal = 0;
  let mutual = 0;
  let fans = 0;
  let everFollowed = 0;
  let protectedCount = 0;
  let protectedForeverCount = 0;
  let protectedTemporaryActiveCount = 0;
  let protectedTemporaryExpiredCount = 0;

  for (const u of all) {
    if (u.iFollow) iFollow++;
    if (u.followsMe) followsMe++;
    if (u.iFollow && !u.followsMe) notFollowingBack++;
    if (u.iFollow && u.followsMe) mutual++;
    if (u.followsMe && !u.iFollow) fans++;
    if (u.everFollowed && !u.iFollow) everFollowed++;

    const protInfo = getProtectionInfo(u, tempDays);
    if (protInfo.isProtected) {
      protectedCount++;
    }
    if (protInfo.type === 'forever') {
      protectedForeverCount++;
    } else if (protInfo.type === 'temporary_active') {
      protectedTemporaryActiveCount++;
    } else if (protInfo.type === 'temporary_expired') {
      protectedTemporaryExpiredCount++;
    }

    if (isBadContactForCleaning(u, tempDays)) {
      cleanUnreciprocal++;
    }
  }

  return {
    total: all.length,
    iFollow,
    followsMe,
    notFollowingBack,
    cleanUnreciprocal,
    mutual,
    fans,
    everFollowed,
    protectedCount,
    protectedForeverCount,
    protectedTemporaryActiveCount,
    protectedTemporaryExpiredCount,
  };
}

export interface InstagramSyncInput {
  following?: Array<{ username: string; name?: string }>;
  followers?: Array<{ username: string; name?: string }>;
  mode: SyncMode;
}

/**
 * Synchronizes users fetched directly from Instagram Web API with the local Dexie DB.
 * Preserves whitelist (protected) and personal notes, and accurately tracks history (everFollowed).
 */
export async function syncInstagramUsers(
  input: InstagramSyncInput
): Promise<InstagramSyncSummary> {
  const mode = input.mode;
  const now = Date.now();

  const followingMap = new Map<string, string>();
  if (input.following) {
    for (const u of input.following) {
      const norm = normalizeUsername(u.username);
      if (norm) {
        followingMap.set(norm, u.name ? u.name.trim() : norm);
      }
    }
  }

  const followersMap = new Map<string, string>();
  if (input.followers) {
    for (const u of input.followers) {
      const norm = normalizeUsername(u.username);
      if (norm) {
        followersMap.set(norm, u.name ? u.name.trim() : norm);
      }
    }
  }

  const allExistingUsers = await db.users.toArray();
  const existingMap = new Map<string, UserRecord>();
  for (const u of allExistingUsers) {
    existingMap.set(u.username, u);
  }

  const allUsernames = new Set<string>();
  if (mode === 'both' || mode === 'following') {
    for (const u of followingMap.keys()) allUsernames.add(u);
  }
  if (mode === 'both' || mode === 'followers') {
    for (const u of followersMap.keys()) allUsernames.add(u);
  }
  for (const u of existingMap.keys()) allUsernames.add(u);

  const toSave: UserRecord[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  let unfollowedMeCount = 0;
  let unfollowedByMeCount = 0;
  let reciprocalProtectedCount = 0;

  for (const username of allUsernames) {
    const existing = existingMap.get(username);
    const inFollowing = followingMap.has(username);
    const inFollowers = followersMap.has(username);

    let newIFollow: boolean;
    if (mode === 'both' || mode === 'following') {
      newIFollow = inFollowing;
    } else {
      newIFollow = existing ? existing.iFollow : false;
    }

    let newFollowsMe: boolean;
    if (mode === 'both' || mode === 'followers') {
      newFollowsMe = inFollowers;
    } else {
      newFollowsMe = existing ? existing.followsMe : false;
    }

    // everFollowed rule:
    // If currently following -> true
    // If ever was true previously -> remains true!
    const newEverFollowed = newIFollow ? true : Boolean(existing?.everFollowed);

    const displayName =
      (mode === 'both' || mode === 'following' ? followingMap.get(username) : null) ||
      (mode === 'both' || mode === 'followers' ? followersMap.get(username) : null) ||
      existing?.name ||
      username;

    if (existing) {
      if (existing.iFollow && !newIFollow && (mode === 'both' || mode === 'following')) {
        unfollowedByMeCount++;
      }
      if (existing.followsMe && !newFollowsMe && (mode === 'both' || mode === 'followers')) {
        unfollowedMeCount++;
      }

      let newFollowedAt = existing.followedAt;
      if (newIFollow && !existing.iFollow) {
        newFollowedAt = now;
      } else if (newIFollow && !newFollowedAt) {
        newFollowedAt = now;
      }

      const existingProtType =
        existing.protectionType || (existing.protected ? 'forever' : 'none');

      let newProtType = existingProtType;
      let newProtected = existingProtType !== 'none';
      let newProtectedAt = existing.protectedAt;

      // REGRA: "toda vez que eu seguir alguem e essa pessoa me seguir, digo, já existia o registro que eu seguia, depois começou a me seguir, ativa uma proteção de 7 dias"
      const hadFollowingRecord = existing.iFollow || existing.everFollowed;
      const startedFollowingMe = !existing.followsMe && newFollowsMe;
      const isReciprocalFollow =
        (mode === 'both' || mode === 'followers') &&
        hadFollowingRecord &&
        startedFollowingMe &&
        newIFollow;

      if (isReciprocalFollow) {
        // Se já era 'forever', mantém 'forever' para não diminuir proteção permanente
        if (existingProtType !== 'forever') {
          newProtType = 'temporary';
          newProtected = true;
          newProtectedAt = now; // Ativa a proteção de 7 dias a partir de agora
          reciprocalProtectedCount++;
        }
      }

      const changed =
        existing.iFollow !== newIFollow ||
        existing.followsMe !== newFollowsMe ||
        existing.everFollowed !== newEverFollowed ||
        existing.followedAt !== newFollowedAt ||
        existing.protected !== newProtected ||
        existing.protectionType !== newProtType ||
        existing.protectedAt !== newProtectedAt ||
        (displayName && displayName !== username && existing.name !== displayName);

      if (changed) {
        updatedCount++;
        toSave.push({
          ...existing,
          name: displayName || existing.name,
          iFollow: newIFollow,
          followsMe: newFollowsMe,
          everFollowed: newEverFollowed,
          followedAt: newFollowedAt,
          protected: newProtected,
          protectionType: newProtType,
          protectedAt: newProtectedAt,
          updatedAt: now,
        });
      }
    } else {
      addedCount++;
      toSave.push({
        username,
        name: displayName || username,
        iFollow: newIFollow,
        followsMe: newFollowsMe,
        everFollowed: newEverFollowed,
        followedAt: newIFollow ? now : undefined,
        protected: false,
        protectionType: 'none',
        protectedAt: undefined,
        updatedAt: now,
      });
    }
  }

  if (toSave.length > 0) {
    await db.users.bulkPut(toSave);
  }

  const finalTotal = await db.users.count();

  return {
    totalInDatabase: finalTotal,
    addedCount,
    updatedCount,
    followingCount: followingMap.size,
    followersCount: followersMap.size,
    unfollowedMeCount,
    unfollowedByMeCount,
    reciprocalProtectedCount,
  };
}

/**
 * Adiciona todos os usuários que sigo atualmente aos protegidos (whitelist).
 */
export async function protectAllCurrentFollowing(
  protectionType: ProtectionType = 'forever'
): Promise<{ modifiedCount: number }> {
  const allUsers = await db.users.toArray();
  const toProtect = allUsers.filter(
    (u) => u.iFollow && (!u.protectionType || u.protectionType === 'none')
  );

  if (toProtect.length === 0) {
    return { modifiedCount: 0 };
  }

  const now = Date.now();
  const updated: UserRecord[] = toProtect.map((u) => ({
    ...u,
    protected: true,
    protectionType,
    protectedAt: protectionType === 'temporary' ? now : undefined,
    followedAt: u.followedAt || now,
    updatedAt: now,
  }));

  await db.users.bulkPut(updated);
  return { modifiedCount: updated.length };
}

/**
 * Remove o status de protegido de todos os usuários da base de dados.
 */
export async function removeAllProtected(): Promise<{ modifiedCount: number }> {
  const allUsers = await db.users.toArray();
  const toUnprotect = allUsers.filter(
    (u) => u.protected || (u.protectionType && u.protectionType !== 'none')
  );

  if (toUnprotect.length === 0) {
    return { modifiedCount: 0 };
  }

  const now = Date.now();
  const updated: UserRecord[] = toUnprotect.map((u) => ({
    ...u,
    protected: false,
    protectionType: 'none',
    protectedAt: undefined,
    updatedAt: now,
  }));

  await db.users.bulkPut(updated);
  return { modifiedCount: updated.length };
}

/**
 * Retorna os contatos que não me seguiram de volta e não possuem proteção pra sempre
 */
export async function getBadContactsForCleaning(tempDays: number = 7): Promise<UserRecord[]> {
  const all = await db.users.toArray();
  return all.filter((u) => isBadContactForCleaning(u, tempDays));
}

/**
 * Limpa completamente a base de dados local de usuários do InstaHub.
 */
export async function clearDatabase(): Promise<void> {
  await db.users.clear();
}

/**
 * Registra quando um usuário que já seguíamos começou a nos seguir de volta,
 * ativando a proteção temporária de 7 dias.
 */
export async function recordReciprocalFollow(
  usernameRaw: string
): Promise<UserRecord | null> {
  const username = normalizeUsername(usernameRaw);
  if (!username) return null;

  const existing = await db.users.get(username);
  if (!existing) return null;

  // Verifica se já existia registro de que eu seguia e ainda não constava que me seguia
  const hadFollowingRecord = existing.iFollow || existing.everFollowed;
  if (!hadFollowingRecord) return existing;

  const now = Date.now();
  const existingProtType =
    existing.protectionType || (existing.protected ? 'forever' : 'none');
  const newProtType = existingProtType === 'forever' ? 'forever' : 'temporary';
  const newProtectedAt = newProtType === 'temporary' ? now : existing.protectedAt;

  const updatedRecord: UserRecord = {
    ...existing,
    followsMe: true,
    protected: true,
    protectionType: newProtType,
    protectedAt: newProtectedAt,
    updatedAt: now,
  };

  await db.users.put(updatedRecord);
  return updatedRecord;
}



