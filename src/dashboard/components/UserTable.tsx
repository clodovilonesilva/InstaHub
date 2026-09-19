import React, { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  UserX,
  CheckSquare,
  Square,
  UserPlus,
  Calendar,
  Clock,
  UserMinus,
  Sparkles,
} from 'lucide-react';
import type { UserRecord, FilterCategory, ProtectionType } from '../../types';
import { db, toggleUserProtected, setUserProtection, bulkSetProtection } from '../../db';
import {
  getProtectionInfo,
  isBadContactForCleaning,
  formatFollowDate,
  calculateDaysFollowing,
} from '../../utils/protection';

interface UserTableProps {
  users: UserRecord[];
  currentFilter: FilterCategory;
  temporaryDays?: number;
  onEditUser: (user: UserRecord) => void;
  onNewUser?: () => void;
  onRefresh?: () => void;
  onOpenCleaningAssistant?: () => void;
}

type SortField = 'username' | 'name' | 'updatedAt' | 'followedAt';
type SortOrder = 'asc' | 'desc';

export const UserTable: React.FC<UserTableProps> = ({
  users,
  currentFilter,
  temporaryDays = 7,
  onEditUser,
  onNewUser,
  onRefresh,
  onOpenCleaningAssistant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set());
  const pageSize = 25;

  // 1. Filter by category & search term
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Category filter
      switch (currentFilter) {
        case 'iFollow':
          if (!u.iFollow) return false;
          break;
        case 'followsMe':
          if (!u.followsMe) return false;
          break;
        case 'notFollowingBack':
          if (!(u.iFollow && !u.followsMe)) return false;
          break;
        case 'cleanUnreciprocal':
          if (!isBadContactForCleaning(u, temporaryDays)) return false;
          break;
        case 'mutual':
          if (!(u.iFollow && u.followsMe)) return false;
          break;
        case 'fans':
          if (!(u.followsMe && !u.iFollow)) return false;
          break;
        case 'everFollowed':
          if (!(u.everFollowed && !u.iFollow)) return false;
          break;
        case 'protected':
          if (!getProtectionInfo(u, temporaryDays).isProtected) return false;
          break;
        case 'all':
        default:
          break;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesUser = u.username.toLowerCase().includes(query);
        const matchesName = (u.name || '').toLowerCase().includes(query);
        const matchesNotes = (u.notes || '').toLowerCase().includes(query);
        if (!matchesUser && !matchesName && !matchesNotes) return false;
      }

      return true;
    });
  }, [users, currentFilter, searchQuery, temporaryDays]);

  // 2. Sort users
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let comp = 0;
      if (sortField === 'username') {
        comp = a.username.localeCompare(b.username);
      } else if (sortField === 'name') {
        comp = (a.name || '').localeCompare(b.name || '');
      } else if (sortField === 'updatedAt') {
        comp = (a.updatedAt || 0) - (b.updatedAt || 0);
      } else if (sortField === 'followedAt') {
        comp = (a.followedAt || 0) - (b.followedAt || 0);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [filteredUsers, sortField, sortOrder]);

  // 3. Paginate
  const totalPages = Math.ceil(sortedUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, currentPage, pageSize]);

  // Handle Sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Cycle protection: none -> forever -> temporary -> none
  const handleCycleProtection = async (user: UserRecord) => {
    const current = getProtectionInfo(user, temporaryDays);
    let nextType: ProtectionType;
    if (current.type === 'none') nextType = 'forever';
    else if (current.type === 'forever') nextType = 'temporary';
    else nextType = 'none';

    await setUserProtection(user.username, nextType);
    if (onRefresh) onRefresh();
  };

  // Single delete
  const handleDeleteUser = async (username: string) => {
    if (window.confirm(`Tem certeza que deseja remover @${username} da sua base?`)) {
      await db.users.delete(username);
      setSelectedUsernames((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
      if (onRefresh) onRefresh();
    }
  };

  // Bulk selection
  const allVisibleSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((u) => selectedUsernames.has(u.username));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedUsernames(new Set());
    } else {
      const next = new Set(selectedUsernames);
      paginatedUsers.forEach((u) => next.add(u.username));
      setSelectedUsernames(next);
    }
  };

  const handleToggleSelectOne = (username: string) => {
    setSelectedUsernames((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  // Bulk actions
  const handleBulkSetProtection = async (protectionType: ProtectionType) => {
    const usernames = Array.from(selectedUsernames);
    if (usernames.length === 0) return;

    await bulkSetProtection(usernames, protectionType);
    setSelectedUsernames(new Set());
    if (onRefresh) onRefresh();
  };

  const handleBulkDelete = async () => {
    const usernames = Array.from(selectedUsernames);
    if (usernames.length === 0) return;

    if (
      window.confirm(
        `Tem certeza que deseja remover ${usernames.length} usuários selecionados da base?`
      )
    ) {
      await db.users.bulkDelete(usernames);
      setSelectedUsernames(new Set());
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner especial para o filtro de Limpeza de Não Recíprocos */}
      {currentFilter === 'cleanUnreciprocal' && (
        <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-white/20 rounded-lg text-white">
                <UserMinus className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold">
                Perfis Não Recíprocos para Limpeza ({filteredUsers.length})
              </h3>
            </div>
            <p className="text-xs text-rose-100 max-w-2xl leading-relaxed">
              Estes são os contatos que <strong>você segue</strong>, <strong>não te seguem de volta</strong> e{' '}
              <strong>não possuem proteção pra sempre</strong>. Perfis que ainda estão dentro do período de carência temporária ({temporaryDays} dias) foram preservados automaticamente.
            </p>
          </div>

          {onOpenCleaningAssistant && (
            <button
              onClick={onOpenCleaningAssistant}
              className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-800 font-extrabold text-xs rounded-xl shadow-md transition shrink-0 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="w-4 h-4 text-rose-600" />
              <span>Abrir Assistente de Limpeza</span>
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Pesquisar por @username ou nome..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition text-slate-800"
            />
          </div>

          {/* Bulk Action Controls */}
          {selectedUsernames.size > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap animate-in fade-in">
              <span className="text-xs font-semibold text-slate-500 mr-1">
                {selectedUsernames.size} selecionado(s):
              </span>
              <button
                onClick={() => handleBulkSetProtection('forever')}
                className="text-xs px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
                title="Proteger permanentemente"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Pra Sempre</span>
              </button>
              <button
                onClick={() => handleBulkSetProtection('temporary')}
                className="text-xs px-2.5 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
                title={`Proteger temporariamente por ${temporaryDays} dias`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Temporária</span>
              </button>
              <button
                onClick={() => handleBulkSetProtection('none')}
                className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
                title="Remover proteção"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Desproteger</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-xs px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            </div>
          )}

          {onNewUser && (
            <button
              onClick={onNewUser}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto"
              title="Cadastrar Novo Usuário Manualmente"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Novo Usuário</span>
            </button>
          )}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-purple-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    onClick={() => handleSort('username')}
                    className="flex items-center gap-1 hover:text-slate-800 transition cursor-pointer"
                  >
                    <span>Perfil</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Eu Sigo</th>
                <th className="py-3 px-4">Me Segue</th>
                <th className="py-3 px-4">
                  <button
                    onClick={() => handleSort('followedAt')}
                    className="flex items-center gap-1 hover:text-slate-800 transition cursor-pointer"
                  >
                    <span>Comecei a Seguir</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Já Segui</th>
                <th className="py-3 px-4 text-center">Proteção (Whitelist)</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserX className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">
                        Nenhum usuário encontrado
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchQuery
                          ? 'Nenhum resultado para os termos pesquisados.'
                          : 'Não há registros nesta categoria. Adicione usuários ou sincronize com o Instagram.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const isSelected = selectedUsernames.has(user.username);
                  const protInfo = getProtectionInfo(user, temporaryDays);
                  const daysFollowing = calculateDaysFollowing(user.followedAt);

                  return (
                    <tr
                      key={user.username}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleSelectOne(user.username)}
                          className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Profile */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[1.5px] shrink-0">
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-[11px] text-purple-700 uppercase">
                              {user.username.slice(0, 2)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900">
                                @{user.username}
                              </span>
                              <a
                                href={`https://www.instagram.com/${user.username}/`}
                                target="_blank"
                                rel="noreferrer"
                                title="Ver perfil no Instagram"
                                className="text-slate-300 hover:text-slate-600 transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {user.name || user.username}
                            </div>
                            {user.notes && (
                              <div className="text-[10px] text-purple-600 font-mono mt-0.5">
                                {user.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Eu Sigo */}
                      <td className="py-3 px-4">
                        {user.iFollow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                            ✓ Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                            Não
                          </span>
                        )}
                      </td>

                      {/* Me Segue */}
                      <td className="py-3 px-4">
                        {user.followsMe ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                            ✓ Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                            Não
                          </span>
                        )}
                      </td>

                      {/* Comecei a Seguir */}
                      <td className="py-3 px-4">
                        {user.followedAt ? (
                          <div className="flex items-center gap-1 text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <div className="font-medium text-[11px]">
                                {formatFollowDate(user.followedAt)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {daysFollowing === 0 ? 'Hoje' : `Há ${daysFollowing}d`}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">–</span>
                        )}
                      </td>

                      {/* Já Segui */}
                      <td className="py-3 px-4">
                        {user.everFollowed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                            ↺ Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                            Não
                          </span>
                        )}
                      </td>

                      {/* Whitelist (Protegido) */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleCycleProtection(user)}
                          title="Clique para alternar proteção: Pra Sempre -> Temporária -> Nenhuma"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${protInfo.badgeColor}`}
                        >
                          {protInfo.type === 'forever' && <Shield className="w-3 h-3" />}
                          {protInfo.type === 'temporary_active' && <Clock className="w-3 h-3" />}
                          {protInfo.type === 'temporary_expired' && <ShieldAlert className="w-3 h-3" />}
                          {protInfo.type === 'none' && <Shield className="w-3 h-3 opacity-40" />}
                          <span>
                            {protInfo.type === 'forever' && 'Pra Sempre'}
                            {protInfo.type === 'temporary_active' && `Temp (${protInfo.daysRemaining}d)`}
                            {protInfo.type === 'temporary_expired' && 'Liberado'}
                            {protInfo.type === 'none' && 'Proteger'}
                          </span>
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditUser(user)}
                            title="Editar usuário"
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            title="Excluir da base"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
            {Math.min(currentPage * pageSize, sortedUsers.length)} de{' '}
            {sortedUsers.length} usuários
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-700">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
