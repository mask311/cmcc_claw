import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, User, Bot, Paperclip, RefreshCw, Brain, Plus, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, Attachment } from '../services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';
import { translations } from '../translations';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageBubbleProps {
  msg: Message;
  idx: number;
  language: string;
}

function MessageBubble({ msg, idx, language }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-4 group",
        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden",
        msg.role === 'user' ? "bg-gray-200 dark:bg-gray-700" : "bg-white border border-[var(--border-color)]"
      )}>
        {msg.role === 'user' ? (
          <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        ) : (
          <Bot className="w-4 h-4 text-blue-500" />
        )}
      </div>
      
      <div className={cn(
        "max-w-[80%] space-y-1 relative",
        msg.role === 'user' ? "text-right" : "text-left"
      )}>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-2 mb-2",
            msg.role === 'user' ? "justify-end" : "justify-start"
          )}>
            {msg.attachments.map((att, i) => (
              <div key={i} className="bg-[var(--card-bg)] p-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2 max-w-[200px]">
                {att.type.startsWith('image/') ? (
                  <img src={att.data} alt={att.name} className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Paperclip className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-[10px] truncate text-[var(--text-primary)]">{att.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="relative group/bubble">
          <div className={cn(
            "p-4 rounded-2xl text-sm leading-relaxed inline-block text-left transition-all duration-200",
            msg.role === 'user' 
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/10 rounded-tr-none" 
              : "bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-sm rounded-tl-none"
          )}>
            <div className={cn(
              "markdown-body prose prose-sm max-w-none",
              msg.role === 'user' ? "prose-invert" : "dark:prose-invert"
            )}>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
          
          <button
            onClick={handleCopy}
            className={cn(
              "absolute top-2 p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] shadow-sm opacity-0 group-hover/bubble:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/5",
              msg.role === 'user' ? "-left-10" : "-right-10"
            )}
            title={language === 'English' ? "Copy message" : "复制消息"}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-mono px-1">
          <span>{new Date(msg.timestamp).toLocaleString()}</span>
          {msg.usage && (
            <>
              <span>•</span>
              <span className="text-blue-500/70">Tokens: {msg.usage.totalTokens}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  isLoading: boolean;
  title: string;
  onUpdateTitle: (title: string) => void;
  models: any[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  language?: string;
}

export function ChatArea({ 
  messages, 
  onSendMessage, 
  isLoading, 
  title, 
  onUpdateTitle,
  models,
  selectedModelId,
  onSelectModel,
  language = '简体中文'
}: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = translations[language]?.chat || translations['简体中文'].chat;

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    setEditTitle(title);
  }, [title]);

  const handleSaveTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onUpdateTitle(editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSendMessage(input, attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || 
                     file.name.endsWith('.txt') || 
                     file.name.endsWith('.md') || 
                     file.name.endsWith('.js') || 
                     file.name.endsWith('.ts') || 
                     file.name.endsWith('.json') ||
                     file.name.endsWith('.py') ||
                     file.name.endsWith('.css') ||
                     file.name.endsWith('.html');

      const reader = new FileReader();
      const data = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        if (isText && !isImage) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
      newAttachments.push({
        name: file.name,
        type: file.type || 'text/plain',
        data
      });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg)] relative transition-colors">
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-[var(--border-color)] bg-[var(--card-bg)]/30 backdrop-blur-md">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isEditingTitle ? (
            <form onSubmit={handleSaveTitle} className="flex-1 max-w-md">
              <input 
                autoFocus
                className="w-full bg-[var(--card-bg)] px-3 py-1 text-sm border border-blue-500 rounded-lg focus:outline-none text-[var(--text-primary)]"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
              />
            </form>
          ) : (
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setIsEditingTitle(true)}
            >
              <h3 className="font-serif text-lg truncate max-w-md text-[var(--text-primary)]">{title}</h3>
              <Plus className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 rotate-45 transition-all" />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-2 bg-[var(--card-bg)]/50 px-3 py-1.5 rounded-full border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--card-bg)] transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-blue-500" />
              <span>{language === 'English' ? 'Model' : '当前模型'}: <span className="font-bold text-[var(--text-primary)]">{selectedModel?.name}</span></span>
            </button>

            <AnimatePresence>
              {showModelSelector && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowModelSelector(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-xl z-20 overflow-hidden"
                  >
                    <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {models.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            onSelectModel(m.id);
                            setShowModelSelector(false);
                          }}
                          className={cn(
                            "w-full flex flex-col items-start p-3 rounded-xl transition-colors text-left",
                            selectedModelId === m.id 
                              ? "bg-blue-500/10 border border-blue-500/20" 
                              : "hover:bg-black/5 dark:hover:bg-white/5"
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className={cn(
                              "text-sm font-bold",
                              selectedModelId === m.id ? "text-blue-500" : "text-[var(--text-primary)]"
                            )}>
                              {m.name}
                            </span>
                            {selectedModelId === m.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          </div>
                          <span className="text-[10px] text-[var(--text-secondary)] line-clamp-1">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
          <button className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full transition-colors">
            <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
            <h1 className="text-5xl font-serif text-[var(--text-primary)] tracking-tight">
              {language === 'English' ? "How can I help you?" : "我能为你做些什么？"}
            </h1>
            <div className="flex gap-3">
              <button className="pill-button text-[var(--text-primary)]">{language === 'English' ? 'Process Tasks' : '处理任务'}</button>
              <button className="pill-button text-[var(--text-primary)]">{language === 'English' ? 'Continuous Execution' : '持续执行'}</button>
              <button className="pill-button text-[var(--text-primary)]">{language === 'English' ? 'Multi-Agent Parallel' : '多智能体并行'}</button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} msg={msg} idx={idx} language={language} />
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t.loading}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 pb-10">
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="max-w-3xl mx-auto mb-4 flex flex-wrap gap-2"
            >
              {attachments.map((att, i) => (
                <div key={i} className="bg-[var(--card-bg)] p-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2 relative group">
                  {att.type.startsWith('image/') ? (
                    <img src={att.data} alt={att.name} className="w-10 h-10 rounded object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Paperclip className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="max-w-[100px]">
                    <p className="text-[10px] font-medium truncate text-[var(--text-primary)]">{att.name}</p>
                    <p className="text-[8px] text-[var(--text-secondary)] uppercase">{att.type.split('/')[1] || 'FILE'}</p>
                  </div>
                  <button 
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="floating-input">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <Paperclip className="w-5 h-5 text-gray-400" />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-[var(--text-primary)] resize-none py-2 custom-scrollbar"
            style={{ maxHeight: '200px' }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors disabled:opacity-30"
          >
            <Send className={cn("w-5 h-5", input.trim() ? "text-blue-500" : "text-gray-300")} />
          </button>
        </form>
        
        <div className="max-w-3xl mx-auto mt-4 flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{language === 'English' ? 'gateway connected' : 'gateway 已连接'} | port: 18789 | pid: 68630</span>
        </div>
      </div>
    </div>
  );
}
