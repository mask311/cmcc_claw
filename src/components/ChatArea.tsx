import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, User, Bot, Paperclip, RefreshCw, Brain, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, Attachment } from '../services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  isLoading: boolean;
  title: string;
  onUpdateTitle: (title: string) => void;
}

export function ChatArea({ messages, onSendMessage, isLoading, title, onUpdateTitle }: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSendMessage(input, attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const data = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      newAttachments.push({
        name: file.name,
        type: file.type,
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
          <div className="flex items-center gap-2 bg-[var(--card-bg)]/50 px-3 py-1 rounded-full border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
            <Bot className="w-3 h-3 text-blue-500" />
            <span>当前对话对象: <span className="font-medium">Main</span></span>
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
              我能为你做些什么？
            </h1>
            <div className="flex gap-3">
              <button className="pill-button text-[var(--text-primary)]">处理任务</button>
              <button className="pill-button text-[var(--text-primary)]">持续执行</button>
              <button className="pill-button text-[var(--text-primary)]">多智能体并行</button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4",
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
                      <img 
                        src="https://www.10086.cn/favicon.ico" 
                        alt="CMCC Logo" 
                        className="w-full h-full object-contain p-1"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://img.icons8.com/color/48/china-mobile.png';
                        }}
                      />
                    )}
                  </div>
                  
                  <div className={cn(
                    "max-w-[80%] space-y-1",
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
                    <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed inline-block text-left",
                      msg.role === 'user' ? "bg-[var(--card-bg)] shadow-sm text-[var(--text-primary)]" : "bg-transparent text-[var(--text-primary)]"
                    )}>
                      <div className="markdown-body prose prose-sm max-w-none prose-neutral dark:prose-invert">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
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
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white border border-[var(--border-color)] flex items-center justify-center shrink-0 animate-pulse overflow-hidden">
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
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>思考中...</span>
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
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-[var(--text-primary)]"
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
          <span>gateway 已连接 | port: 18789 | pid: 68630</span>
        </div>
      </div>
    </div>
  );
}
