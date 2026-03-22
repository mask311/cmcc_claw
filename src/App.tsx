import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { KnowledgeBase } from './components/KnowledgeBase';
import { Message, chatWithAI, AIModelConfig, Attachment, AgentSettings } from './services/gemini';
import { Cpu, Box, Share2, Zap, Clock, Settings, Plus, Trash2, Check, AlertCircle, MessageSquare, PanelLeftOpen, Loader2, LogIn, User as UserIcon, Book, Sparkles, UserCircle, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { translations } from './translations';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInAnonymously, signOut, User } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import cronParser from 'cron-parser';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

interface ModelConfig {
  id: string;
  name: string;
  desc: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  speed: string;
  power: string;
}

interface Skill {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  isBuiltIn?: boolean;
}

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  status: 'pending' | 'running' | 'completed';
  lastRun?: number;
}

interface UsageLog {
  id: string;
  content: string;
  timestamp: number;
  tokens: number;
}

// --- Views ---

function HistoryView({ history, onLoadChat, onDeleteChat, onUpdateTitle }: { 
  history: ChatHistory[], 
  onLoadChat: (chat: ChatHistory) => void,
  onDeleteChat: (id: string) => void,
  onUpdateTitle: (id: string, title: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = (e: React.MouseEvent, chat: ChatHistory) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveEdit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onUpdateTitle(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-serif mb-8 text-[var(--text-primary)]">历史对话记录</h2>
        {history.length === 0 ? (
          <div className="text-center py-20 bg-[var(--card-bg)]/30 rounded-3xl border border-dashed border-[var(--border-color)]">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">暂无历史记录</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {history.sort((a, b) => b.timestamp - a.timestamp).map(chat => (
              <div 
                key={chat.id}
                className="group bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer"
                onClick={() => onLoadChat(chat)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === chat.id ? (
                      <form onSubmit={(e) => handleSaveEdit(e, chat.id)} className="flex items-center gap-2">
                        <input 
                          autoFocus
                          className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded-md focus:outline-none bg-[var(--card-bg)] text-[var(--text-primary)]"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onBlur={(e) => handleSaveEdit(e as any, chat.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </form>
                    ) : (
                      <div className="flex items-center gap-2 group/title">
                        <h4 className="font-bold text-sm truncate max-w-[400px] text-[var(--text-primary)]">{chat.title}</h4>
                        <button 
                          onClick={(e) => handleStartEdit(e, chat)}
                          className="p-1 opacity-0 group-hover/title:opacity-100 text-gray-400 hover:text-blue-500 transition-all"
                        >
                          <Plus className="w-3 h-3 rotate-45" />
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                      {new Date(chat.timestamp).toLocaleString()} • {chat.messages.length} 条消息
                    </p>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentConfigView({ 
  agentSettings, 
  onUpdateAgentSettings 
}: { 
  agentSettings: AgentSettings, 
  onUpdateAgentSettings: (settings: AgentSettings) => void 
}) {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] custom-scrollbar">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">智能体配置</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">定义智能体的人格、回复风格和行为准则</p>
        </div>
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-[var(--card-bg)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <UserCircle className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)]">人格设定</h3>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">描述智能体的人格特征、背景故事或专业领域</label>
              <textarea 
                className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none"
                placeholder="例如：你是一个资深的移动端开发专家，说话简洁明了，喜欢用技术术语，但对初学者非常耐心..."
                value={agentSettings.personality}
                onChange={e => onUpdateAgentSettings({...agentSettings, personality: e.target.value})}
              />
            </div>

            <div className="flex items-center gap-3 mb-2 pt-4">
              <div className="p-2 bg-amber-500/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)]">回复风格</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {['简洁明了', '幽默风趣', '严谨专业', '热情亲切', '极简主义', '富有创意'].map(style => (
                <button
                  key={style}
                  onClick={() => onUpdateAgentSettings({...agentSettings, style})}
                  className={cn(
                    "px-4 py-3 rounded-2xl border text-sm transition-all text-left",
                    agentSettings.style === style 
                      ? "border-blue-500 bg-blue-500/5 text-blue-500 font-medium" 
                      : "border-[var(--border-color)] hover:border-gray-400 text-[var(--text-secondary)]"
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">自定义风格描述</label>
              <input 
                type="text"
                className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="或输入自定义风格..."
                value={agentSettings.style}
                onChange={e => onUpdateAgentSettings({...agentSettings, style: e.target.value})}
              />
            </div>

            <div className="flex items-center gap-3 mb-2 pt-4">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <Settings className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="font-bold text-[var(--text-primary)]">额外指令</h3>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">任何你希望 AI 始终遵循的特定规则</label>
              <textarea 
                className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
                placeholder="例如：始终使用中文回复；在代码块后附带简短解释..."
                value={agentSettings.customInstructions}
                onChange={e => onUpdateAgentSettings({...agentSettings, customInstructions: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelManagementView({ 
  models, 
  setModels, 
  selectedId, 
  onSelect 
}: { 
  models: ModelConfig[], 
  setModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>,
  selectedId: string,
  onSelect: (id: string) => void
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newModel, setNewModel] = useState({ 
    name: '', 
    desc: '', 
    provider: 'Google', 
    apiKey: '', 
    baseUrl: '', 
    modelName: '' 
  });

  const addModel = () => {
    if (!newModel.name || !newModel.apiKey || !newModel.modelName) return;
    
    const trimmedModel = {
      ...newModel,
      apiKey: newModel.apiKey.trim(),
      baseUrl: newModel.baseUrl.trim(),
      modelName: newModel.modelName.trim()
    };

    if (editingId) {
      setModels(models.map(m => m.id === editingId ? { ...trimmedModel, id: editingId, speed: m.speed, power: m.power } as ModelConfig : m));
      setEditingId(null);
    } else {
      const id = trimmedModel.name.toLowerCase().replace(/\s+/g, '-');
      setModels([...models, { ...trimmedModel, id, speed: 'Custom', power: 'Unknown', desc: trimmedModel.desc || `接入 ${trimmedModel.provider} 模型` } as ModelConfig]);
    }
    
    setNewModel({ name: '', desc: '', provider: 'Google', apiKey: '', baseUrl: '', modelName: '' });
    setIsAdding(false);
  };

  const deleteModel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (models.length <= 1) return;
    const newModels = models.filter(m => m.id !== id);
    setModels(newModels);
    if (selectedId === id) {
      onSelect(newModels[0].id);
    }
  };

  const startEdit = (model: ModelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setNewModel({
      name: model.name,
      desc: model.desc,
      provider: model.provider,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      modelName: model.modelName
    });
    setEditingId(model.id);
    setIsAdding(true);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] custom-scrollbar">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">模型管理</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">管理和配置您的 AI 模型接入</p>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setNewModel({ name: '', desc: '', provider: 'Google', apiKey: '', baseUrl: '', modelName: '' });
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            增加模型
          </button>
        </div>

        {isAdding && (
          <div className="mb-8 bg-[var(--card-bg)] p-6 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">
              {editingId ? '编辑模型配置' : '新增自定义模型接入'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">模型显示名称</label>
                <input 
                  type="text" 
                  placeholder="如: GPT-4o" 
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newModel.name}
                  onChange={e => setNewModel({...newModel, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">供应商类型</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newModel.provider}
                  onChange={e => {
                    const provider = e.target.value;
                    let baseUrl = '';
                    if (provider === 'OpenAI') baseUrl = 'https://api.openai.com/v1';
                    else if (provider === 'DeepSeek') baseUrl = 'https://api.deepseek.com';
                    else if (provider === 'Anthropic') baseUrl = 'https://api.anthropic.com/v1';
                    else if (provider === 'Local (Ollama)') baseUrl = 'http://localhost:11434/v1';
                    else if (provider === 'Google') baseUrl = '';
                    
                    setNewModel({...newModel, provider, baseUrl});
                  }}
                >
                  <option value="Google">Google Gemini</option>
                  <option value="OpenAI">OpenAI</option>
                  <option value="DeepSeek">DeepSeek</option>
                  <option value="Anthropic">Anthropic</option>
                  <option value="Local (Ollama)">Local (Ollama)</option>
                  <option value="Custom">自定义 (OpenAI 兼容中转)</option>
                </select>
              </div>
              {newModel.provider !== 'Google' && (
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">接口地址 (Base URL)</label>
                  <input 
                    type="text" 
                    placeholder="例如: https://api.openai-proxy.com/v1" 
                    className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newModel.baseUrl}
                    onChange={e => setNewModel({...newModel, baseUrl: e.target.value})}
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">API Key</label>
                <input 
                  type="password" 
                  placeholder="sk-..." 
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newModel.apiKey}
                  onChange={e => setNewModel({...newModel, apiKey: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">模型标识符 (Model ID)</label>
                <input 
                  type="text" 
                  placeholder={
                    newModel.provider === 'DeepSeek' ? 'deepseek-chat' : 
                    newModel.provider === 'Anthropic' ? 'claude-3-5-sonnet-20240620' : 
                    'gpt-4o'
                  } 
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newModel.modelName}
                  onChange={e => setNewModel({...newModel, modelName: e.target.value})}
                />
                <p className="text-[10px] text-gray-400">
                  {newModel.provider === 'DeepSeek' ? '提示: 官方模型通常为 deepseek-chat 或 deepseek-reasoner' : 
                   newModel.provider === 'Google' ? '提示: 常用模型如 gemini-1.5-flash-latest' :
                   '提示: 请确保模型名称与供应商文档一致'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={addModel}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
              >
                {editingId ? '保存修改' : '确认添加'}
              </button>
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {models.map(m => (
            <div key={m.id} className="relative group/card">
              <button 
                onClick={() => onSelect(m.id)}
                className={cn(
                  "w-full text-left p-6 rounded-2xl border transition-all relative",
                  selectedId === m.id ? "bg-[var(--card-bg)] border-blue-500 shadow-md ring-1 ring-blue-500" : "bg-[var(--card-bg)]/50 border-[var(--border-color)] hover:bg-[var(--card-bg)]"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[var(--text-primary)]">{m.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">{m.provider}</span>
                  </div>
                  <div className="flex gap-2 pr-16">
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full font-mono uppercase text-gray-500">{m.speed}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full font-mono uppercase">{m.power}</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{m.desc || `ID: ${m.modelName}`}</p>
                {selectedId === m.id && <Check className="absolute top-4 right-4 w-4 h-4 text-blue-500" />}
              </button>
              <div className="absolute top-4 right-12 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
                <button
                  onClick={(e) => startEdit(m, e)}
                  className="p-2 text-gray-400 hover:text-blue-500 transition-all"
                  title="编辑模型"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {m.id !== 'gemini-3-flash' && m.id !== 'gemini-3.1-pro' && (
                  <button
                    onClick={(e) => deleteModel(m.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-all"
                    title="删除模型"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsView({ skills, setSkills, onNavigateToChat }: { 
  skills: Skill[], 
  setSkills: React.Dispatch<React.SetStateAction<Skill[]>>,
  onNavigateToChat: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const toggleSkill = (id: string) => {
    setSkills(skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const deleteSkill = (id: string) => {
    setSkills(skills.filter(s => s.id !== id));
  };

  const startEdit = (skill: Skill) => {
    setEditingSkillId(skill.id);
    setEditName(skill.name);
    setEditDesc(skill.desc);
  };

  const saveEdit = () => {
    if (!editingSkillId) return;
    setSkills(skills.map(s => s.id === editingSkillId ? { ...s, name: editName, desc: editDesc } : s));
    setEditingSkillId(null);
  };

  const handleGithubImport = async () => {
    if (!githubUrl.trim()) return;
    setIsImporting(true);
    
    // Simulate fetching from GitHub
    setTimeout(() => {
      const repoName = githubUrl.split('/').pop()?.replace('.git', '') || 'github-skill';
      const newSkill: Skill = {
        id: Date.now().toString(),
        name: repoName,
        desc: `Imported from ${githubUrl}. This skill provides specialized functions from the repository.`,
        enabled: true
      };
      setSkills(prev => [...prev, newSkill]);
      setIsImporting(false);
      setIsGithubModalOpen(false);
      setGithubUrl('');
    }, 1500);
  };

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] custom-scrollbar">
      <div className="max-w-4xl mx-auto">
        <div className="mb-2">
          <h2 className="text-3xl font-serif text-[var(--text-primary)]">技能管理</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2">为您的智能体提供预封装且可重复的最佳实践与工具</p>
        </div>

        <div className="flex gap-4 mb-8 mt-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索已经安装的技能" 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              添加技能
            </button>
            
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-xl z-20 overflow-hidden"
                  >
                    <button 
                      onClick={() => {
                        onNavigateToChat();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-start gap-3 p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">通过对话创建</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">描述你的需求，AI 帮你生成</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => {
                        setIsGithubModalOpen(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-start gap-3 p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left border-t border-[var(--border-color)]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-[var(--text-primary)] shrink-0">
                        <GithubIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">从 GitHub 导入</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">粘贴一个仓库连接以开始</p>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSkills.map(skill => (
            <div 
              key={skill.id}
              className={cn(
                "p-6 rounded-2xl border transition-all bg-[var(--card-bg)] border-[var(--border-color)] shadow-sm group relative",
                !skill.enabled && "opacity-60"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500">
                  <PuzzleIcon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleSkill(skill.id)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      skill.enabled ? "bg-black dark:bg-white" : "bg-gray-200 dark:bg-gray-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full transition-all",
                      skill.enabled ? "right-0.5 bg-white dark:bg-black" : "left-0.5 bg-white"
                    )} />
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                {editingSkillId === skill.id ? (
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      className="w-full bg-[var(--bg)] px-3 py-1.5 text-sm border border-blue-500 rounded-lg focus:outline-none text-[var(--text-primary)] font-bold"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      autoFocus
                    />
                    <textarea 
                      className="w-full bg-[var(--bg)] px-3 py-1.5 text-xs border border-blue-500 rounded-lg focus:outline-none text-[var(--text-secondary)] leading-relaxed resize-none h-20"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={saveEdit}
                        className="px-3 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        保存
                      </button>
                      <button 
                        onClick={() => setEditingSkillId(null)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] text-[10px] font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="font-bold text-[var(--text-primary)] mb-1">{skill.name}</h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">{skill.desc}</p>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                <span className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 font-medium">
                  {skill.isBuiltIn ? '内置技能' : '自定义技能'}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => startEdit(skill)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                    title="编辑技能"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteSkill(skill.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="删除技能"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredSkills.length === 0 && (
          <div className="text-center py-20 bg-[var(--card-bg)]/30 rounded-3xl border border-dashed border-[var(--border-color)]">
            <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">未找到匹配的技能</p>
          </div>
        )}
      </div>

      {/* GitHub Import Modal */}
      <AnimatePresence>
        {isGithubModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isImporting && setIsGithubModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">从 GitHub 导入技能</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">粘贴 GitHub 仓库链接，系统将自动解析并安装技能插件。</p>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">仓库链接</label>
                  <input 
                    type="text" 
                    placeholder="https://github.com/user/repo" 
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={githubUrl}
                    onChange={e => setGithubUrl(e.target.value)}
                    disabled={isImporting}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={handleGithubImport}
                    disabled={isImporting || !githubUrl.trim()}
                    className="flex-1 py-3 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        正在解析...
                      </>
                    ) : '开始导入'}
                  </button>
                  <button 
                    onClick={() => setIsGithubModalOpen(false)}
                    disabled={isImporting}
                    className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-bold"
                  >
                    取消
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PuzzleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c0-1.1-.9-2-2-2h-2.98c-.54 0-1.03-.3-1.24-.81-.38-.91-1.28-1.54-2.33-1.54s-1.95.63-2.33 1.54c-.21.51-.71.81-1.24.81H4.339c-1.1 0-2 .9-2 2v2.98c0 .54.3 1.03.81 1.24.91.38 1.54 1.28 1.54 2.33s-.63 1.95-1.54 2.33c-.51.21-.81.71-.81 1.24v2.98c0 1.1.9 2 2 2h2.98c.54 0 1.03.3 1.24.81.38.91 1.28 1.54 2.33 1.54s1.95-.63 2.33-1.54c.21-.51.71-.81 1.24-.81h2.98c1.1 0 2-.9 2-2v-2.98c0-.54-.3-1.03-.81-1.24-.91-.38-1.54-1.28-1.54-2.33s.63-1.95 1.54-2.33c.51-.21.81-.71.81-1.24V7.85Z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function Search({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function TasksView({ tasks, setTasks }: { tasks: ScheduledTask[], setTasks: React.Dispatch<React.SetStateAction<ScheduledTask[]>> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', schedule: '' });

  const addTask = () => {
    if (!newTask.name || !newTask.schedule) return;
    const id = Date.now().toString();
    setTasks([...tasks, { ...newTask, id, status: 'pending', lastRun: 0 } as ScheduledTask]);
    setNewTask({ name: '', schedule: '' });
    setIsAdding(false);
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const runTaskNow = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: 'running' as const, lastRun: Date.now() } : t
    ));
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] custom-scrollbar">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-serif text-[var(--text-primary)]">定时任务</h2>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增任务
          </button>
        </div>

        {isAdding && (
          <div className="mb-8 bg-[var(--card-bg)] p-6 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">创建定时任务</h3>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="任务名称 (如: 每日总结)" 
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={newTask.name}
                onChange={e => setNewTask({...newTask, name: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Cron 表达式或时间 (如: 0 9 * * *)" 
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={newTask.schedule}
                onChange={e => setNewTask({...newTask, schedule: e.target.value})}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={addTask} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">确认</button>
              <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium">取消</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-20 bg-[var(--card-bg)]/30 rounded-3xl border border-dashed border-[var(--border-color)]">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">暂无定时任务</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{task.name}</h4>
                    <p className="text-xs text-[var(--text-secondary)]">计划: {task.schedule}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-mono uppercase",
                    task.status === 'pending' ? "bg-gray-100 dark:bg-gray-800 text-gray-500" :
                    task.status === 'running' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-500" :
                    "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500"
                  )}>
                    {task.status}
                  </span>
                  <button 
                    onClick={() => runTaskNow(task.id)} 
                    className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                    title="立即运行"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function UsageView({ logs }: { logs: UsageLog[] }) {
  const totalConversations = new Set(logs.map(l => l.id.split('-')[0])).size;
  const totalMessages = logs.length;
  
  const today = new Date().setHours(0, 0, 0, 0);
  const todayLogs = logs.filter(l => l.timestamp >= today);
  const todayTokens = todayLogs.reduce((acc, curr) => acc + curr.tokens, 0);
  const dailyLimit = 40000000;
  const remainingTokens = Math.max(0, dailyLimit - todayTokens);

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] custom-scrollbar">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-serif text-[var(--text-primary)]">用量统计</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-8">仅统计默认大模型的用量数据；不包含自定义模型数据</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: '总会话数', value: totalConversations.toLocaleString() },
            { label: '总对话次数', value: totalMessages.toLocaleString() },
            { label: '今日消耗Token', value: todayTokens.toLocaleString() },
            { label: '今日剩余Token', value: remainingTokens.toLocaleString(), hasInfo: true },
          ].map((stat, i) => (
            <div key={i} className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
              <p className="text-2xl font-bold text-[var(--text-primary)] mb-2">{stat.value}</p>
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                {stat.label}
                {stat.hasInfo && <AlertCircle className="w-3 h-3" />}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Token使用详情</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5">
                  <th className="px-6 py-4 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">对话内容</th>
                  <th className="px-6 py-4 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">对话时间</th>
                  <th className="px-6 py-4 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Token消耗</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-sm text-[var(--text-secondary)]">暂无用量记录</td>
                  </tr>
                ) : (
                  [...logs].reverse().map((log, i) => (
                    <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-[var(--text-primary)] max-w-md truncate">{log.content}</td>
                      <td className="px-6 py-4 text-sm text-[var(--text-secondary)] font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-red-500 font-medium">-{log.tokens.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ 
  fileProtection, 
  onToggleFileProtection,
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  version,
  useMirror,
  onMirrorToggle
}: { 
  fileProtection: boolean, 
  onToggleFileProtection: () => void,
  theme: string,
  onThemeChange: (theme: string) => void,
  language: string,
  onLanguageChange: (lang: string) => void,
  version: string,
  useMirror: boolean,
  onMirrorToggle: () => void
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'latest' | 'available' | 'error'>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const t = translations[language]?.settings || translations['简体中文'].settings;

  const handleCheckUpdate = async () => {
    // Check cooldown (prevent spamming)
    const lastCheck = localStorage.getItem('last_update_check');
    const now = Date.now();
    if (lastCheck && now - parseInt(lastCheck) < 10000 && updateStatus !== 'idle') {
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);
    try {
      // 尝试获取最新的 Release
      // 注意：API 镜像较少且不稳定，此处仍主要请求 GitHub API，但增加了更友好的失败处理
      let response = await fetch('https://api.github.com/repos/OpenClaw/OpenClaw/releases/latest');
      let remoteVersion = '';

      if (response.ok) {
        const data = await response.json();
        remoteVersion = data.tag_name.replace('v', '');
      } else {
        const tagsResponse = await fetch('https://api.github.com/repos/OpenClaw/OpenClaw/tags');
        if (!tagsResponse.ok) {
          throw new Error(tagsResponse.status === 403 ? 'GitHub API 访问频率受限' : '无法连接到 GitHub');
        }
        const tags = await tagsResponse.json();
        remoteVersion = tags[0]?.name.replace('v', '') || '';
      }

      if (!remoteVersion) throw new Error('未能获取到版本号');

      setLatestVersion(remoteVersion);
      localStorage.setItem('last_update_check', now.toString());

      if (remoteVersion !== version) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('latest');
      }
    } catch (error) {
      console.error('检查更新失败:', error);
      setUpdateStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '检查更新失败');
    } finally {
      setIsChecking(false);
    }
  };

  const getDownloadUrl = () => {
    const baseUrl = 'https://github.com/OpenClaw/OpenClaw/releases/latest';
    return useMirror ? `https://ghproxy.com/${baseUrl}` : baseUrl;
  };

  const themes = [
    { id: 'light', name: t.themes.light, colors: 'bg-[#F2F0E9] border-[#E6E4DD]' },
    { id: 'dark', name: t.themes.dark, colors: 'bg-[#1A1A1A] border-[#2D2D2D]' },
    { id: 'solarized', name: t.themes.solarized, colors: 'bg-[#FDF6E3] border-[#EEE8D5]' },
    { id: 'monokai', name: t.themes.monokai, colors: 'bg-[#272822] border-[#3E3D32]' },
    { id: 'github-dark', name: t.themes.githubDark, colors: 'bg-[#0D1117] border-[#30363D]' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg)] custom-scrollbar">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-serif mb-8 text-[var(--text-primary)]">{t.title}</h2>
        <div className="space-y-6">
          <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
            <h3 className="font-bold text-sm mb-4 text-[var(--text-primary)]">{t.appearance}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => onThemeChange(t.id)}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    theme === t.id 
                      ? "border-blue-500 ring-2 ring-blue-500/20" 
                      : "border-[var(--border-color)] hover:border-gray-400"
                  )}
                >
                  <div className={cn("w-full h-12 rounded-lg border", t.colors)} />
                  <span className="text-xs font-medium text-[var(--text-primary)]">{t.name}</span>
                  {theme === t.id && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
            <h3 className="font-bold text-sm mb-4 text-[var(--text-primary)]">{t.general}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t.language}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{t.selectLanguage}</p>
                </div>
                <select 
                  value={language}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  className="px-3 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>English</option>
                  <option>简体中文</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
            <h3 className="font-bold text-sm mb-4 text-[var(--text-primary)]">{t.version}</h3>
            
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--border-color)]/50">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t.mirror}</p>
                <p className="text-xs text-[var(--text-secondary)]">{t.mirrorDesc}</p>
              </div>
              <button 
                onClick={onMirrorToggle}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  useMirror ? "bg-blue-500" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  useMirror ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t.currentVersion}: v{version}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {updateStatus === 'latest' ? t.latest : t.checkUpdate}
                </p>
              </div>
              <button 
                onClick={
                  updateStatus === 'available' || updateStatus === 'error' 
                    ? () => window.open(getDownloadUrl(), '_blank') 
                    : handleCheckUpdate
                }
                disabled={isChecking}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2",
                  updateStatus === 'latest' 
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : updateStatus === 'available'
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : updateStatus === 'error'
                    ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                    : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                )}
              >
                {isChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {updateStatus === 'latest' ? t.latest : updateStatus === 'available' ? t.updateAvailable : updateStatus === 'error' ? t.error : t.checkUpdate}
              </button>
            </div>
            {updateStatus === 'error' && (
              <div className="mt-4 p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                <p className="text-[10px] text-red-500 leading-relaxed">
                  {errorMessage || t.error}
                </p>
              </div>
            )}
            {updateStatus === 'available' && (
              <div className="mt-4 p-3 bg-orange-500/5 rounded-xl border border-orange-500/10">
                <p className="text-xs text-orange-600 font-medium mb-1">{t.updateAvailable}: v{latestVersion}</p>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  检测到 OpenClaw 有新版本发布。请点击上方按钮前往 GitHub 下载最新源码或安装包。
                </p>
              </div>
            )}
            {updateStatus === 'latest' && (
              <div className="mt-4 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  提示：如果您在本地使用打包后的版本，请在 AI Studio 中点击“导出项目”并重新打包以同步最新代码。
                </p>
              </div>
            )}
          </div>

          <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
            <h3 className="font-bold text-sm mb-4 text-[var(--text-primary)]">安全与隐私</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">文件系统保护</p>
                <p className="text-xs text-[var(--text-secondary)]">防止模型直接访问敏感系统文件</p>
              </div>
              <button 
                onClick={onToggleFileProtection}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  fileProtection ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                  fileProtection ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('new');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fileProtection, setFileProtection] = useState(true);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => {
    const saved = localStorage.getItem('agent_settings');
    if (saved) return JSON.parse(saved);
    return {
      personality: '你是一个 CMCC_Claw 智能助手，由中国移动开发。你专业、高效、礼貌，擅长解决移动通信、网络技术及日常办公问题。你具备强大的文件分析能力，可以处理用户上传的文档、图片和代码。',
      style: '严谨专业',
      customInstructions: '始终使用中文回复；如果涉及代码，请提供清晰的注释。对于用户提到的本地文件路径，请引导用户通过上传功能或知识库进行分析。'
    };
  });

  useEffect(() => {
    localStorage.setItem('agent_settings', JSON.stringify(agentSettings));
  }, [agentSettings]);
  
  const [history, setHistory] = useState<ChatHistory[]>(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [models, setModels] = useState<ModelConfig[]>(() => {
    const saved = localStorage.getItem('ai_models');
    return saved ? JSON.parse(saved) : [
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', desc: '速度极快，适合日常对话', provider: 'Google', apiKey: '********', baseUrl: '', modelName: 'gemini-3-flash-preview', speed: 'Fast', power: 'Medium' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', desc: '推理能力强，适合复杂任务', provider: 'Google', apiKey: '********', baseUrl: '', modelName: 'gemini-3.1-pro-preview', speed: 'Normal', power: 'High' },
      { id: 'gemini-3.1-lite', name: 'Gemini 3.1 Flash Lite', desc: '极低延迟，轻量级任务首选', provider: 'Google', apiKey: '********', baseUrl: '', modelName: 'gemini-3.1-flash-lite-preview', speed: 'Ultra Fast', power: 'Low' },
    ];
  });
  
  const [skills, setSkills] = useState<Skill[]>(() => {
    const saved = localStorage.getItem('ai_skills');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Web Search', desc: 'Search the web for real-time information', enabled: true, isBuiltIn: true },
      { id: '2', name: 'Code Interpreter', desc: 'Execute Python code to solve complex problems', enabled: false, isBuiltIn: true },
      { id: '3', name: 'Image Generation', desc: 'Create images from text descriptions', enabled: true, isBuiltIn: true },
      { id: '6', name: 'File Analysis', desc: 'Analyze uploaded files and documents', enabled: true, isBuiltIn: true },
      { id: '4', name: 'agent-mbti', desc: 'AI Agent personality diagnosis and configuration tool.', enabled: true },
      { id: '5', name: 'cloud-upload-backup', desc: 'Cloud file upload and backup tool. Upload local files to cloud storage.', enabled: false },
    ];
  });
  
  const [tasks, setTasks] = useState<ScheduledTask[]>(() => {
    const saved = localStorage.getItem('scheduled_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>(() => {
    const saved = localStorage.getItem('usage_logs');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        signInAnonymously(auth).catch(err => console.error("Anonymous sign-in error:", err));
      } else {
        setUser(u);
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // After sign out, the onAuthStateChanged will trigger and sign in anonymously again
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getKnowledgeContext = async (queryText: string) => {
    if (!user) return "";
    
    try {
      const response = await fetch('/api/kb/list');
      if (!response.ok) throw new Error("Failed to fetch knowledge base");
      const data = await response.json();
      
      const userDocs = data.filter((d: any) => d.authorUid === user.uid);
      let context = "";
      const keywords = queryText.toLowerCase().split(/\s+/).filter(k => k.length > 1);

      userDocs.forEach((doc: any) => {
        const matches = keywords.some(k => 
          doc.content.toLowerCase().includes(k) || 
          doc.name.toLowerCase().includes(k)
        );
        
        if (matches) {
          context += `\n\n--- Document: ${doc.name} ---\n${doc.content.slice(0, 2000)}\n`;
        }
      });
      
      return context ? `\n\nRelevant information from your Knowledge Base:\n${context}` : "";
    } catch (error) {
      console.error("Knowledge search error:", error);
      return "";
    }
  };

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(() => {
    return localStorage.getItem('selected_model_id') || 'gemini-3-flash';
  });

  useEffect(() => {
    localStorage.setItem('selected_model_id', selectedModelId);
  }, [selectedModelId]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'light';
  });
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'English';
  });
  const [useMirror, setUseMirror] = useState(() => {
    return localStorage.getItem('use_mirror') === 'true';
  });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('ai_models', JSON.stringify(models));
  }, [models]);

  useEffect(() => {
    localStorage.setItem('ai_skills', JSON.stringify(skills));
  }, [skills]);

  useEffect(() => {
    localStorage.setItem('scheduled_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('usage_logs', JSON.stringify(usageLogs));
  }, [usageLogs]);

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark' || theme === 'github-dark' || theme === 'monokai') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('use_mirror', useMirror.toString());
  }, [useMirror]);

  const handleSelectItem = useCallback((id: string) => {
    setActiveItem(id);
    if (id === 'new') {
      setMessages([]);
      setCurrentChatId(null);
    }
  }, []);

  const handleSendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Auto-save to history on first message
    if (!currentChatId && messages.length === 0) {
      const newId = Date.now().toString();
      setCurrentChatId(newId);
      const newChat: ChatHistory = {
        id: newId,
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: newMessages,
        timestamp: Date.now()
      };
      setHistory(prev => [newChat, ...prev]);
    } else if (currentChatId) {
      setHistory(prev => prev.map(chat => 
        chat.id === currentChatId ? { ...chat, messages: newMessages, timestamp: Date.now() } : chat
      ));
    }

    try {
      const selectedModel = models.find(m => m.id === selectedModelId) || models[0];
      const enabledSkills = skills.filter(s => s.enabled).map(s => ({ name: s.name, desc: s.desc }));
      
      // Search knowledge base
      const knowledgeContext = await getKnowledgeContext(content);
      const enhancedContent = knowledgeContext 
        ? `${content}\n\n[CONTEXT FROM KNOWLEDGE BASE]\n${knowledgeContext}`
        : content;
      
      // Update last message with context for AI
      const messagesWithContext = [...newMessages];
      messagesWithContext[messagesWithContext.length - 1] = {
        ...messagesWithContext[messagesWithContext.length - 1],
        content: enhancedContent
      };

      const aiResponse = await chatWithAI(messagesWithContext, selectedModel as AIModelConfig, fileProtection, enabledSkills, agentSettings);
      const { text: response, usage } = aiResponse;
      
      // Log usage
      const tokens = usage?.totalTokens || Math.floor((content.length + response.length) * 0.75 + 100);
      const newLog: UsageLog = {
        id: `${currentChatId || Date.now()}-${Date.now()}`,
        content: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
        timestamp: Date.now(),
        tokens: tokens
      };
      setUsageLogs(prev => [...prev, newLog]);

      const aiMessage: Message = {
        role: 'model',
        content: response,
        timestamp: Date.now(),
        usage: usage
      };
      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      
      // Check for skill generation in response
      const skillMatch = response.match(/\[NEW_SKILL:\s*(.*?)\s*\|\s*(.*?)\s*\]/);
      if (skillMatch) {
        const [, name, desc] = skillMatch;
        const newSkill: Skill = {
          id: Date.now().toString(),
          name: name.trim(),
          desc: desc.trim(),
          enabled: true
        };
        setSkills(prev => [...prev, newSkill]);
      }

      // Check for task generation in response
      const taskMatch = response.match(/\[NEW_TASK:\s*(.*?)\s*\|\s*(.*?)\s*\]/);
      if (taskMatch) {
        const [, name, schedule] = taskMatch;
        const newTask: ScheduledTask = {
          id: Date.now().toString(),
          name: name.trim(),
          schedule: schedule.trim(),
          status: 'pending',
          lastRun: 0
        };
        setTasks(prev => [...prev, newTask]);
      }

      if (currentChatId) {
        setHistory(prev => prev.map(chat => 
          chat.id === currentChatId ? { ...chat, messages: finalMessages, timestamp: Date.now() } : chat
        ));
      }
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, fileProtection, currentChatId]);

  const loadChat = (chat: ChatHistory) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setActiveItem('new');
  };

  const deleteChat = (id: string) => {
    setHistory(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const updateChatTitle = (id: string, title: string) => {
    setHistory(prev => prev.map(chat => 
      chat.id === id ? { ...chat, title } : chat
    ));
  };

  // Task Scheduler
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      setTasks(prevTasks => {
        let hasChanges = false;
        const updatedTasks = prevTasks.map(task => {
          if (task.status === 'running') return task;
          
          try {
            const interval = (cronParser as any).parseExpression(task.schedule);
            const nextRun = interval.next().getTime();
            const prevRun = task.lastRun || 0;
            
            // If it's time to run and we haven't run it in this minute
            if (now >= nextRun && (now - prevRun) > 60000) {
              hasChanges = true;
              
              // Trigger task execution
              console.log(`Executing task: ${task.name}`);
              
              // We can't easily call handleSendMessage here because of closures
              // but we can update the status and let another effect handle it or just log it
              // For now, let's just mark it as running and update lastRun
              return { ...task, status: 'running' as const, lastRun: now };
            }
          } catch (e) {
            // Not a valid cron expression, maybe it's a simple time?
            // For now, we only support cron
          }
          return task;
        });
        
        return hasChanges ? updatedTasks : prevTasks;
      });
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Handle running tasks
  useEffect(() => {
    const runningTasks = tasks.filter(t => t.status === 'running');
    if (runningTasks.length > 0) {
      runningTasks.forEach(task => {
        // Execute the task: Send a message to the AI
        handleSendMessage(`[SYSTEM_TASK_EXECUTION] 正在执行定时任务: ${task.name}`);
        
        // Mark as completed (or pending if it's recurring)
        setTasks(prev => prev.map(t => 
          t.id === task.id ? { ...t, status: 'pending' } : t
        ));
      });
    }
  }, [tasks, handleSendMessage]);

  const renderContent = () => {
    switch (activeItem) {
      case 'new':
        return (
          <ChatArea 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading} 
            title={history.find(c => c.id === currentChatId)?.title || (language === 'English' ? 'New Chat' : '新对话')}
            onUpdateTitle={(title) => currentChatId && updateChatTitle(currentChatId, title)}
            models={models}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            language={language}
          />
        );
      case 'knowledge':
        return <KnowledgeBase language={language} />;
      case 'history':
        return <HistoryView history={history} onLoadChat={loadChat} onDeleteChat={deleteChat} onUpdateTitle={updateChatTitle} />;
      case 'model':
        return <ModelManagementView models={models} setModels={setModels} selectedId={selectedModelId} onSelect={setSelectedModelId} />;
      case 'agent':
        return <AgentConfigView agentSettings={agentSettings} onUpdateAgentSettings={setAgentSettings} />;
      case 'skills':
        return <SkillsView skills={skills} setSkills={setSkills} onNavigateToChat={() => handleSelectItem('new')} />;
      case 'tasks':
        return <TasksView tasks={tasks} setTasks={setTasks} />;
      case 'usage':
        return <UsageView logs={usageLogs} />;
      case 'settings':
        return (
          <SettingsView 
            fileProtection={fileProtection} 
            onToggleFileProtection={() => setFileProtection(!fileProtection)}
            theme={theme}
            onThemeChange={setTheme}
            language={language}
            onLanguageChange={setLanguage}
            version="2026.3.22"
            useMirror={useMirror}
            onMirrorToggle={() => setUseMirror(!useMirror)}
          />
        );
      default:
        return (
          <ChatArea 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading} 
            title={history.find(c => c.id === currentChatId)?.title || '新对话'}
            onUpdateTitle={(title) => currentChatId && updateChatTitle(currentChatId, title)}
            models={models}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
          />
        );
    }
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] transition-colors relative">
      <Sidebar 
        activeItem={activeItem} 
        onSelectItem={handleSelectItem} 
        recentHistory={history.slice(0, 5)}
        onLoadChat={loadChat}
        onDeleteChat={deleteChat}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        language={language}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        {renderContent()}
      </main>
    </div>
  );
}

function PlaceholderView({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[var(--bg)]">
      <div className="mb-6 p-6 bg-[var(--card-bg)] rounded-3xl shadow-sm border border-[var(--border-color)]">
        {icon}
      </div>
      <h2 className="text-2xl font-serif mb-2">{title}</h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-xs leading-relaxed">{description}</p>
      <button className="mt-8 pill-button">
        立即配置
      </button>
    </div>
  );
}

function StatItem({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-mono uppercase opacity-60">{label}</span>
      </div>
      <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function LogEntry({ time, msg }: { time: string, msg: string }) {
  return (
    <div className="flex gap-2">
      <span className="opacity-40">[{time}]</span>
      <span className="tracking-tighter">{msg}</span>
    </div>
  );
}
