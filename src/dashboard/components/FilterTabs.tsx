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
import type { FilterCategory } from '../../types';
import type { DashboardStats } from '../../db';

interface FilterTabsProps {
  currentFilter: FilterCategory;
  onSelectFilter: (tab: FilterCategory) => void;
  stats: DashboardStats;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  currentFilter,
  onSelectFilter,
  stats,
}) => {
  const tabs: {
    id: FilterCategory;
    label: string;
    icon: React.ElementType;
    count: number;
    badgeStyle?: string;
  }[] = [
    {
      id: 'all',
      label: 'Todos os Contatos',
      icon: Layers,
      count: stats.total,
    },
    {
      id: 'cleanUnreciprocal',
      label: '🧹 Para Limpeza (Não Recíprocos)',
      icon: UserMinus,
      count: stats.cleanUnreciprocal,
      badgeStyle: 'bg-rose-100 text-rose-800 font-bold',
    },
    {
      id: 'notFollowingBack',
      label: 'Não Me Seguem de Volta',
      icon: UserX,
      count: stats.notFollowingBack,
    },
    {
      id: 'mutual',
      label: 'Seguimento Mútuo (Amigos)',
      icon: Handshake,
      count: stats.mutual,
    },
    {
      id: 'iFollow',
      label: 'Quem Eu Sigo',
      icon: UserCheck,
      count: stats.iFollow,
    },
    {
      id: 'fans',
      label: 'Apenas Me Seguem (Fãs)',
      icon: Heart,
      count: stats.fans,
    },
    {
      id: 'followsMe',
      label: 'Quem Me Segue (Geral)',
      icon: Users,
      count: stats.followsMe,
    },
    {
      id: 'everFollowed',
      label: 'Ex-Seguidos (Histórico)',
      icon: History,
      count: stats.everFollowed,
    },
    {
      id: 'protected',
      label: 'Protegidos (Whitelist)',
      icon: Shield,
      count: stats.protectedCount,
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 border-b border-slate-200 scrollbar-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentFilter === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectFilter(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-rose-400' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                isActive
                  ? 'bg-slate-800 text-slate-200'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
