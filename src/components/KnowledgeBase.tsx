import React, { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FileText, Trash2, Upload, Loader2, Search, Plus, X, File, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface KBDocument {
  id: string;
  name: string;
  content: string;
  summary?: string;
  authorUid: string;
  createdAt: any;
  fileUrl?: string;
  fileType: string;
  size: number;
}

export function KnowledgeBase() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'knowledge_base'),
      where('authorUid', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: KBDocument[] = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() } as KBDocument);
      });
      setDocuments(docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, (err) => {
      console.error("Firestore error:", err);
      setError("无法加载知识库文档。请检查权限。");
    });

    return () => unsubscribe();
  }, []);

  const extractText = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    } else if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      return await file.text();
    } else {
      throw new Error("目前仅支持 PDF、TXT 和 Markdown 文件。");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !auth.currentUser) return;

    setIsUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const textContent = await extractText(file);
        
        // 1. Upload to Storage
        const storageRef = ref(storage, `knowledge_base/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // 2. Add to Firestore
        await addDoc(collection(db, 'knowledge_base'), {
          name: file.name,
          content: textContent,
          authorUid: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          fileUrl: downloadUrl,
          fileType: file.type,
          size: file.size,
          summary: textContent.slice(0, 200) + (textContent.length > 200 ? '...' : '')
        });
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "上传失败。");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docObj: KBDocument) => {
    if (!window.confirm(`确定要删除文档 "${docObj.name}" 吗？`)) return;

    try {
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'knowledge_base', docObj.id));
      
      // 2. Delete from Storage if exists
      if (docObj.fileUrl) {
        const fileRef = ref(storage, docObj.fileUrl);
        await deleteObject(fileRef).catch(e => console.warn("Storage delete failed:", e));
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError("删除失败。");
    }
  };

  const filteredDocs = documents.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg)] transition-colors p-8">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-[var(--text-primary)]">知识库</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">上传文档，让 AI 学习你的专属知识。</p>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{isUploading ? '上传中...' : '上传文档'}</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            className="hidden" 
            multiple 
            accept=".pdf,.txt,.md"
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="搜索文档内容..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-[var(--text-primary)]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredDocs.map((doc) => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl hover:shadow-xl transition-all group relative"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <button 
                    onClick={() => handleDelete(doc)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-medium text-[var(--text-primary)] truncate mb-1" title={doc.name}>{doc.name}</h3>
                <p className="text-[var(--text-secondary)] text-xs line-clamp-3 mb-4 h-12">
                  {doc.summary || '无摘要'}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-mono border-top border-[var(--border-color)] pt-3">
                  <span>{(doc.size / 1024).toFixed(1)} KB</span>
                  <span>{doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString() : '刚刚'}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredDocs.length === 0 && !isUploading && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
              <File className="w-12 h-12 text-gray-400" />
              <p className="text-[var(--text-secondary)]">暂无文档，点击右上角上传。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
