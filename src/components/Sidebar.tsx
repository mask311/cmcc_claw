import React, { useState } from 'react';
import { Settings, MessageSquare, Cpu, Box, Share2, Zap, Clock, ExternalLink, PanelLeftClose, PanelLeftOpen, Plus, ChevronDown, ChevronRight, BarChart3, Book, Trash2, UserCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { translations } from '../translations';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  activeItem: string;
  onSelectItem: (id: string) => void;
  recentHistory?: { id: string, title: string }[];
  onLoadChat?: (chat: any) => void;
  onDeleteChat?: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  language: string;
}

export function Sidebar({ activeItem, onSelectItem, recentHistory = [], onLoadChat, onDeleteChat, isCollapsed, onToggleCollapse, language }: SidebarProps) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const t = translations[language]?.sidebar || translations['简体中文'].sidebar;

  const MENU_ITEMS = [
    { id: 'new', name: t.new, icon: <Plus className="w-4 h-4" /> },
    { id: 'knowledge', name: t.knowledge, icon: <Book className="w-4 h-4" /> },
    { id: 'history', name: t.history, icon: <Clock className="w-4 h-4" /> },
    { id: 'model', name: t.model, icon: <Cpu className="w-4 h-4" /> },
    { id: 'agent', name: t.agent, icon: <UserCircle className="w-4 h-4" /> },
    { id: 'skills', name: t.skills, icon: <Zap className="w-4 h-4" /> },
    { id: 'tasks', name: t.tasks, icon: <Clock className="w-4 h-4" /> },
    { id: 'usage', name: t.usage, icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'logs', name: language === 'English' ? 'System Logs' : '系统日志', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <div className={cn(
      "flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16 p-2" : "w-64 p-4"
    )}>
      <div className={cn("flex items-center mb-6 px-2", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-[var(--border-color)] overflow-hidden shrink-0">
              <img 
                src="https://www.10086.cn/favicon.ico" 
                alt="CMCC Logo" 
                className="w-full h-full object-contain p-1"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://img.icons8.com/color/48/china-mobile.png';
                }}
              />
            </div>
            <span className="font-bold text-sm text-[var(--text-primary)] truncate">CMCC_Claw</span>
          </div>
        )}
        {isCollapsed ? (
          <button 
            onClick={onToggleCollapse}
            className="p-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title="展开侧边栏"
          >
            <PanelLeftOpen className="w-4 h-4 text-blue-500" />
          </button>
        ) : (
          <button 
            onClick={onToggleCollapse}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
          >
            <PanelLeftClose className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        {MENU_ITEMS.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center group">
              <button
                onClick={() => onSelectItem(item.id)}
                className={cn(
                  "flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  activeItem === item.id ? "bg-[var(--active-bg)] font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                {item.icon}
                {!isCollapsed && <span>{item.name}</span>}
              </button>
              {!isCollapsed && item.id === 'history' && recentHistory.length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHistoryExpanded(!isHistoryExpanded);
                  }}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-md text-gray-400 transition-colors"
                >
                  {isHistoryExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
            </div>
            
            {!isCollapsed && item.id === 'history' && recentHistory.length > 0 && isHistoryExpanded && (
              <div className="ml-7 space-y-0.5 pb-2">
                {recentHistory.map(chat => (
                  <div key={chat.id} className="group/item relative flex items-center">
                    <button
                      onClick={() => onLoadChat?.(chat)}
                      className="flex-1 text-left px-2 py-1.5 rounded-md text-[11px] text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 truncate transition-colors pr-8"
                    >
                      {chat.title}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat?.(chat.id);
                      }}
                      className="absolute right-1 p-1 opacity-0 group-hover/item:opacity-100 hover:text-red-500 transition-all text-gray-400"
                      title="删除对话"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-1 pt-4">
        <button 
          onClick={() => onSelectItem('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
            activeItem === 'settings' ? "bg-[var(--active-bg)] font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5",
            isCollapsed && "justify-center px-0"
          )}
          title={isCollapsed ? t.settings : undefined}
        >
          <Settings className="w-4 h-4" />
          {!isCollapsed && <span>{t.settings}</span>}
        </button>
      </div>
    </div>
  );
}

function Terminal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
