import React, { useState, useMemo } from 'react';
import {
  X,
  UserMinus,
  ExternalLink,
  Shield,
  Trash2,
  Copy,
  Check,
  Calendar,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { UserRecord } from '../../types';
import { db, setUserProtection } from '../../db';
import {
  isBadContactForCleaning,
  formatFollowDate,
  calculateDaysFollowing,
  getProtectionInfo,
} from '../../utils/protection';

interface CleanUnreciprocalModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserRecord[];
  temporaryDays: number;
  onRefresh?: () => void;
}

export const CleanUnreciprocalModal: React.FC<CleanUnreciprocalModalProps> = ({
  isOpen,
  onClose,
  users,
  temporaryDays,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set());
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [batchOpeningFeedback, setBatchOpeningFeedback] = useState('');

  // 1. Filter all non-reciprocal unprotected users
  const eligibleUsers = useMemo(() => {
    return users.filter((u) => isBadContactForCleaning(u, temporaryDays));
  }, [users, temporaryDays]);

  // 2. Search filter
  const displayedUsers = useMemo(() => {
    if (!searchQuery.trim()) return eligibleUsers;
    const q = searchQuery.toLowerCase().trim();
    return eligibleUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
    );
  }, [eligibleUsers, searchQuery]);

  if (!isOpen) return null;

  // Toggle selection
  const handleToggleSelectOne = (username: string) => {
    setSelectedUsernames((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const allVisibleSelected =
    displayedUsers.length > 0 &&
    displayedUsers.every((u) => selectedUsernames.has(u.username));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedUsernames(new Set());
    } else {
      const next = new Set(selectedUsernames);
      displayedUsers.forEach((u) => next.add(u.username));
      setSelectedUsernames(next);
    }
  };

  // Copy usernames
  const handleCopyUsernames = () => {
    const list = eligibleUsers.map((u) => `@${u.username}`).join('\n');
    navigator.clipboard.writeText(list);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  };

  // Open up to 5 profiles in background tabs
  const handleOpenBatchInInstagram = () => {
    const toOpen = displayedUsers.slice(0, 5);
    if (toOpen.length === 0) return;

    toOpen.forEach((u) => {
      window.open(`https://www.instagram.com/${u.username}/`, '_blank');
    });

    setBatchOpeningFeedback(`Abrindo 5 perfis no Instagram...`);
    setTimeout(() => setBatchOpeningFeedback(''), 3000);
  };

  // Single protect forever
  const handleProtectForever = async (username: string) => {
    await setUserProtection(username, 'forever');
    setSelectedUsernames((prev) => {
      const next = new Set(prev);
      next.delete(username);
      return next;
    });
    if (onRefresh) onRefresh();
  };

  // Single delete from local database
  const handleDeleteFromDatabase = async (username: string) => {
    if (window.confirm(`Remover @${username} da base de dados local do InstaHub?`)) {
      await db.users.delete(username);
      setSelectedUsernames((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
      if (onRefresh) onRefresh();
    }
  };

  // Bulk protect forever
  const handleBulkProtect = async () => {
    const list = Array.from(selectedUsernames);
    if (list.length === 0) return;

    for (const u of list) {
      await setUserProtection(u, 'forever');
    }
    setSelectedUsernames(new Set());
    if (onRefresh) onRefresh();
  };

  // Bulk delete from DB
  const handleBulkDelete = async () => {
    const list = Array.from(selectedUsernames);
    if (list.length === 0) return;

    if (
      window.confirm(
        `Remover ${list.length} perfis selecionados da sua base de dados local?`
      )
    ) {
      await db.users.bulkDelete(list);
      setSelectedUsernames(new Set());
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-rose-50/70 via-amber-50/50 to-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200">
              <UserMinus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Assistente de Limpeza de Contatos Não Recíprocos
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                  {eligibleUsers.length} encontrados
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Perfis que você segue, não te seguem de volta e <strong>não possuem proteção permanente</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explain Box */}
        <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-100 text-amber-900 text-xs flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Critério seguro:</strong> Foram excluídos automaticamente todos os contatos que te seguem,
              todos com proteção <strong>Pra Sempre</strong> e todos com proteção temporária <strong>dentro do prazo de {temporaryDays} dias</strong>.
            </span>
          </div>
          <button
            onClick={handleCopyUsernames}
            className="shrink-0 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-950 rounded-xl font-semibold text-xs border border-amber-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {copiedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-700" />
                <span>Copiar Lista ({eligibleUsers.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Action Bar & Search */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-slate-50/50">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar por @username ou nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedUsernames.size > 0 && (
              <div className="flex items-center gap-1.5 animate-in fade-in">
                <span className="text-xs font-bold text-slate-600 mr-1">
                  {selectedUsernames.size} selecionado(s):
                </span>
                <button
                  onClick={handleBulkProtect}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Proteger Pra Sempre</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir da Base</span>
                </button>
              </div>
            )}

            <button
              onClick={handleOpenBatchInInstagram}
              disabled={displayedUsers.length === 0}
              title="Abre os primeiros 5 perfis em novas abas para unfollow manual rápido"
              className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir 5 no Instagram</span>
            </button>
          </div>
        </div>

        {batchOpeningFeedback && (
          <div className="px-6 py-2 bg-emerald-50 text-emerald-800 text-xs font-medium border-b border-emerald-200 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{batchOpeningFeedback}</span>
          </div>
        )}

        {/* Table list */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-rose-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Perfil</th>
                <th className="py-3 px-4">Comecei a Seguir</th>
                <th className="py-3 px-4">Status de Carência</th>
                <th className="py-3 px-4 text-right">Ações Recomendadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Check className="w-10 h-10 text-emerald-500 bg-emerald-50 p-2 rounded-full" />
                      <p className="text-base font-bold text-slate-700">
                        Nenhum contato pendente de limpeza!
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Todos os perfis que você segue ou te seguem de volta, ou estão protegidos na whitelist permanente, ou estão no período temporário.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedUsers.map((user) => {
                  const isSelected = selectedUsernames.has(user.username);
                  const protInfo = getProtectionInfo(user, temporaryDays);
                  const daysFollowing = calculateDaysFollowing(user.followedAt);

                  return (
                    <tr
                      key={user.username}
                      className={`hover:bg-slate-50 transition ${
                        isSelected ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleSelectOne(user.username)}
                          className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Profile */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900">
                                @{user.username}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 font-medium">
                                Não te segue
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {user.name || user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Data de início */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <div>
                            <span className="font-medium">
                              {formatFollowDate(user.followedAt)}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {daysFollowing === 0
                                ? 'Começou hoje'
                                : `Seguindo há ${daysFollowing} dias`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Carência */}
                      <td className="py-3 px-4">
                        {protInfo.type === 'temporary_expired' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            <span>🔓 Prazo Expirado ({protInfo.daysFollowing - temporaryDays}d atrás)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            <span>Sem proteção configurada</span>
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`https://www.instagram.com/${user.username}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>Abrir no Insta</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            onClick={() => handleProtectForever(user.username)}
                            title="Mudar de ideia: proteger pra sempre"
                            className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium text-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <Shield className="w-3 h-3" />
                            <span>Proteger</span>
                          </button>

                          <button
                            onClick={() => handleDeleteFromDatabase(user.username)}
                            title="Excluir da base local"
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div>
            Mostrando {displayedUsers.length} de {eligibleUsers.length} perfis elegíveis para limpeza
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition cursor-pointer"
          >
            Concluir / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
