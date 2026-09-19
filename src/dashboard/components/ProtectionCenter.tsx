import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Sparkles,
  Calendar,
  Search,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Info,
} from 'lucide-react';
import type { UserRecord, ProtectionType } from '../../types';
import {
  db,
  setUserProtection,
  bulkSetProtection,
  normalizeUsername,
  type DashboardStats,
} from '../../db';
import {
  getProtectionInfo,
  formatFollowDate,
  formatRelativeFollowTime,
} from '../../utils/protection';
import { saveExtensionSettings } from '../../utils/storage';

interface ProtectionCenterProps {
  users: UserRecord[];
  stats: DashboardStats;
  temporaryDays: number;
  onUpdateTemporaryDays: (days: number) => void;
  onRefresh?: () => void;
}

type ProtectionFilter = 'all' | 'forever' | 'temporary_active' | 'temporary_expired';

export const ProtectionCenter: React.FC<ProtectionCenterProps> = ({
  users,
  stats,
  temporaryDays,
  onUpdateTemporaryDays,
  onRefresh,
}) => {
  const [subFilter, setSubFilter] = useState<ProtectionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [quickType, setQuickType] = useState<'forever' | 'temporary'>('forever');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Local state for inputting days
  const [tempDaysInput, setTempDaysInput] = useState<string>(String(temporaryDays));
  const [savedDaysFeedback, setSavedDaysFeedback] = useState(false);

  const handleSaveDays = async (daysToSet: number) => {
    if (daysToSet < 1 || isNaN(daysToSet)) return;
    onUpdateTemporaryDays(daysToSet);
    setTempDaysInput(String(daysToSet));
    await saveExtensionSettings({ temporaryProtectionDays: daysToSet });
    setSavedDaysFeedback(true);
    setTimeout(() => setSavedDaysFeedback(false), 2500);
    if (onRefresh) onRefresh();
  };

  // Quick add to protection
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = quickInput.trim();
    if (!raw) return;

    setActionLoading(true);
    setFeedback(null);

    try {
      const usernames = raw
        .split(/[\s,;]+/)
        .map((u) => normalizeUsername(u))
        .filter(Boolean);

      if (usernames.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Por favor, informe ao menos um @username válido.',
        });
        return;
      }

      await bulkSetProtection(usernames, quickType);

      setFeedback({
        type: 'success',
        message: `${usernames.length} perfil(is) marcado(s) com proteção ${
          quickType === 'forever' ? 'Pra Sempre' : `Temporária (${temporaryDays} dias)`
        }!`,
      });
      setQuickInput('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao adicionar proteções.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Change individual user protection type
  const handleChangeProtection = async (
    username: string,
    newType: ProtectionType
  ) => {
    try {
      await setUserProtection(username, newType);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err?.message || 'Falha ao alterar proteção'}`);
    }
  };

  // Filtered users for protection table
  const protectedUsers = useMemo(() => {
    return users.filter((u) => {
      // Must have either protected = true or protectionType !== 'none'
      const info = getProtectionInfo(u, temporaryDays);
      const hasAnyProtectionHistory =
        u.protected ||
        u.protectionType === 'forever' ||
        u.protectionType === 'temporary';

      if (!hasAnyProtectionHistory) return false;

      // Filter by subfilter
      if (subFilter === 'forever' && info.type !== 'forever') return false;
      if (subFilter === 'temporary_active' && info.type !== 'temporary_active') return false;
      if (subFilter === 'temporary_expired' && info.type !== 'temporary_expired') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesUser = u.username.toLowerCase().includes(q);
        const matchesName = (u.name || '').toLowerCase().includes(q);
        const matchesNotes = (u.notes || '').toLowerCase().includes(q);
        if (!matchesUser && !matchesName && !matchesNotes) return false;
      }

      return true;
    });
  }, [users, temporaryDays, subFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
              <span>Central de Proteção & Whitelist</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Controle de Proteção Permanente e Temporária
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Proteja perfis que você tem interesse contra unfollows acidentais.
              Defina o período da <strong>proteção temporária</strong> para aguardar follow-back
              ou marque contatos como <strong>pra sempre</strong> para mantê-los imunes permanentemente.
            </p>
          </div>

          {/* Configuração do Período Temporário */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shrink-0 w-full lg:w-80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-purple-100 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>Prazo da Proteção Temporária</span>
              </label>
              {savedDaysFeedback && (
                <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Salvo!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="365"
                value={tempDaysInput}
                onChange={(e) => setTempDaysInput(e.target.value)}
                onBlur={() => handleSaveDays(parseInt(tempDaysInput, 10) || 7)}
                className="w-20 px-3 py-2 bg-white text-slate-900 font-bold text-center rounded-xl border-0 focus:ring-2 focus:ring-amber-400 text-sm"
              />
              <span className="text-xs text-purple-200 font-medium">dias de carência</span>
              <button
                type="button"
                onClick={() => handleSaveDays(parseInt(tempDaysInput, 10) || 7)}
                className="ml-auto px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Salvar
              </button>
            </div>

            {/* Quick Days Selector */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/15">
              <span className="text-[10px] text-purple-200">Atalhos:</span>
              {[3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSaveDays(d)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                    temporaryDays === d
                      ? 'bg-purple-400 text-slate-950'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas de Proteção */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Protegidos Hoje</span>
            <div className="p-1.5 rounded-xl bg-purple-50 text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats.protectedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Imunes contra unfollow por teclado
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">🛡️ Pra Sempre (Permanente)</span>
            <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-900 tracking-tight">
            {stats.protectedForeverCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Perfis que você tem interesse e nunca serão removidos
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">⏳ Temporários Ativos</span>
            <div className="p-1.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 tracking-tight">
            {stats.protectedTemporaryActiveCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Dentro do prazo de {temporaryDays} dias de carência
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">🔓 Temporários Liberados</span>
            <div className="p-1.5 rounded-xl bg-rose-50 text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 tracking-tight">
            {stats.protectedTemporaryExpiredCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Passaram de {temporaryDays} dias e já podem ser avaliados
          </div>
        </div>
      </div>

      {/* Widget de Adição Rápida com Escolha de Tipo */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 p-5 rounded-2xl border border-purple-100 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-purple-950">
                Adicionar Perfis à Proteção
              </h3>
              <p className="text-xs text-purple-700">
                Digite um ou mais perfis (ex: <span className="font-mono">@amigo, @marca</span>) e escolha o tipo de proteção.
              </p>
            </div>
          </div>

          <form onSubmit={handleQuickAdd} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="@username..."
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              disabled={actionLoading}
              className="px-3.5 py-2 text-xs bg-white rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 w-48 sm:w-56 text-slate-800"
            />

            {/* Select Type */}
            <div className="flex items-center bg-white rounded-xl border border-purple-200 p-0.5">
              <button
                type="button"
                onClick={() => setQuickType('forever')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  quickType === 'forever'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛡️ Pra Sempre
              </button>
              <button
                type="button"
                onClick={() => setQuickType('temporary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  quickType === 'temporary'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⏳ Temporária ({temporaryDays}d)
              </button>
            </div>

            <button
              type="submit"
              disabled={actionLoading || !quickInput.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {actionLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Proteger</span>
            </button>
          </form>
        </div>

        {feedback && (
          <div
            className={`mt-3 flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-xl border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Tabela de Perfis com Proteção */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Header Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Sub-Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSubFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                subFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos Protegidos
            </button>
            <button
              onClick={() => setSubFilter('forever')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                subFilter === 'forever'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🛡️ Pra Sempre ({stats.protectedForeverCount})
            </button>
            <button
              onClick={() => setSubFilter('temporary_active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                subFilter === 'temporary_active'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              ⏳ Temporária Ativa ({stats.protectedTemporaryActiveCount})
            </button>
            <button
              onClick={() => setSubFilter('temporary_expired')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                subFilter === 'temporary_expired'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🔓 Liberados ({stats.protectedTemporaryExpiredCount})
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar nos protegidos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Perfil</th>
                <th className="py-3 px-4">Comecei a Seguir</th>
                <th className="py-3 px-4">Relação</th>
                <th className="py-3 px-4">Tipo de Proteção</th>
                <th className="py-3 px-4 text-right">Alterar Tipo / Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {protectedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Shield className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        Nenhum perfil encontrado nesta categoria de proteção
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Adicione perfis na caixa acima ou use o Gerenciador de Usuários.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                protectedUsers.map((user) => {
                  const protInfo = getProtectionInfo(user, temporaryDays);

                  return (
                    <tr key={user.username} className="hover:bg-slate-50/80 transition">
                      {/* Profile */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white text-[11px] shrink-0">
                            {user.username.slice(0, 2).toUpperCase()}
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
                                title="Abrir no Instagram"
                                className="text-slate-300 hover:text-slate-600 transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {user.name || user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Data em que comecei a seguir */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div>
                            <span className="font-medium">
                              {formatFollowDate(user.followedAt)}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {formatRelativeFollowTime(user.followedAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Relação */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold w-fit ${
                              user.iFollow
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {user.iFollow ? '✓ Eu Sigo' : 'Não Sigo'}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold w-fit ${
                              user.followsMe
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {user.followsMe ? '✓ Me Segue' : '✗ Não Me Segue'}
                          </span>
                        </div>
                      </td>

                      {/* Status de Proteção */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${protInfo.badgeColor}`}
                          >
                            {protInfo.type === 'forever' && <Shield className="w-3.5 h-3.5" />}
                            {protInfo.type === 'temporary_active' && <Clock className="w-3.5 h-3.5" />}
                            {protInfo.type === 'temporary_expired' && <ShieldAlert className="w-3.5 h-3.5" />}
                            <span>{protInfo.label}</span>
                          </span>

                          {protInfo.type === 'temporary_active' && (
                            <div className="text-[10px] text-slate-400">
                              Dia {protInfo.daysFollowing} de {temporaryDays} (libera em{' '}
                              {protInfo.daysRemaining}d)
                            </div>
                          )}
                          {protInfo.type === 'temporary_expired' && (
                            <div className="text-[10px] text-rose-600 font-medium">
                              Prazo de {temporaryDays}d vencido. Pronto para unfollow/revisão.
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {protInfo.type !== 'forever' && (
                            <button
                              onClick={() => handleChangeProtection(user.username, 'forever')}
                              title="Tornar proteção permanente (Pra Sempre)"
                              className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                            >
                              <Shield className="w-3 h-3" />
                              <span>Pra Sempre</span>
                            </button>
                          )}

                          {protInfo.type !== 'temporary_active' && (
                            <button
                              onClick={() => handleChangeProtection(user.username, 'temporary')}
                              title={`Tornar proteção temporária (${temporaryDays} dias)`}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Temporária</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleChangeProtection(user.username, 'none')}
                            title="Remover proteção completamente"
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
      </div>
    </div>
  );
};
