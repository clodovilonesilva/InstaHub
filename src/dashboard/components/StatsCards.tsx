import React from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Heart,
  History,
  Shield,
  Layers,
  UserMinus,
  Handshake,
} from 'lucide-react';
import type { DashboardStats } from '../../db';
import type { FilterCategory } from '../../types';

interface StatsCardsProps {
  stats: DashboardStats;
  currentFilter: FilterCategory;
  onSelectFilter: (category: FilterCategory) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  currentFilter,
  onSelectFilter,
}) => {
  const cards: {
    key: FilterCategory;
    title: string;
    count: number;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    badge?: string;
  }[] = [
    {
      key: 'all',
      title: 'Total na Base',
      count: stats.total,
      description: 'Todos os contatos salvos localmente',
      icon: Layers,
      color: 'text-slate-700',
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-200',
    },
    {
      key: 'cleanUnreciprocal',
      title: '🧹 Limpeza Sugerida',
      count: stats.cleanUnreciprocal,
      description: 'Não te seguem e sem proteção',
      icon: UserMinus,
      color: 'text-rose-700',
      bgColor: 'bg-rose-100/70',
      borderColor: 'border-rose-200',
      badge: 'Prioridade',
    },
    {
      key: 'notFollowingBack',
      title: 'Não Me Seguem',
      count: stats.notFollowingBack,
      description: 'Eu sigo, mas perfil não segue de volta',
      icon: UserX,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      key: 'mutual',
      title: 'Seguimento Mútuo',
      count: stats.mutual,
      description: 'Vocês se seguem reciprocamente',
      icon: Handshake,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      key: 'iFollow',
      title: 'Quem Eu Sigo',
      count: stats.iFollow,
      description: 'Perfis que sigo atualmente',
      icon: UserCheck,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
    },
    {
      key: 'fans',
      title: 'Apenas Me Seguem',
      count: stats.fans,
      description: 'Me seguem, mas eu não sigo de volta',
      icon: Heart,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200',
    },
    {
      key: 'everFollowed',
      title: 'Ex-Seguidos',
      count: stats.everFollowed,
      description: 'Já dei unfollow no passado',
      icon: History,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
    },
    {
      key: 'protected',
      title: 'Protegidos',
      count: stats.protectedCount,
      description: 'Imunes (Sempre ou Temporários)',
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = currentFilter === card.key;

        return (
          <button
            key={card.key}
            onClick={() => onSelectFilter(card.key)}
            className={`text-left p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
              isSelected
                ? 'ring-2 ring-purple-600 border-purple-500 shadow-md bg-white'
                : 'bg-white hover:bg-slate-50/80 border-slate-200/90 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 truncate">
                {card.title}
              </span>
              <div className={`p-1 rounded-lg ${card.bgColor} ${card.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900 tracking-tight">
                {card.count}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5 leading-tight">
                {card.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
