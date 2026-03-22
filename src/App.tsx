import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Settings, 
  Maximize2, 
  Share2, 
  History, 
  BookOpen, 
  Bookmark, 
  GraduationCap, 
  PlusCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Languages,
  Info,
  Heart
} from 'lucide-react';
import { analyzePoetry, generateTTS, PoetryAnalysis, getCachedResult, setCachedResult } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Navbar = ({ lang, setLang }: { lang: 'cn' | 'en', setLang: (l: 'cn' | 'en') => void }) => (
  <nav className="fixed top-0 w-full z-50 glass shadow-sm shadow-emerald-900/5">
    <div className="flex justify-between items-center px-8 h-20 w-full max-w-screen-2xl mx-auto">
      <div className="flex items-center gap-2">
        <span className="font-headline text-2xl font-bold text-primary">Scholar’s Pavilion</span>
      </div>
      <div className="hidden md:flex items-center gap-12 font-headline text-lg tracking-tight font-medium">
        <a className="text-stone-600 hover:text-primary transition-all" href="#">{lang === 'cn' ? '画廊' : 'Gallery'}</a>
        <a className="text-stone-600 hover:text-primary transition-all" href="#">{lang === 'cn' ? '图书馆' : 'Library'}</a>
        <a className="text-primary border-b-2 border-primary pb-1" href="#">{lang === 'cn' ? '创作' : 'Compose'}</a>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setLang(lang === 'cn' ? 'en' : 'cn')}
          className="px-4 py-2 rounded-full glass ghost-border text-xs font-bold text-primary hover:scale-105 transition-all flex items-center gap-2"
        >
          <Languages size={14} />
          {lang === 'cn' ? 'EN' : '中文'}
        </button>
        <button className="p-2 rounded-full hover:bg-primary/10 transition-all text-stone-600">
          <Sparkles size={20} />
        </button>
        <div className="h-10 w-10 rounded-full overflow-hidden bg-surface-container-high border border-stone-200">
          <img 
            src="https://picsum.photos/seed/scholar/100/100" 
            alt="Profile" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  </nav>
);

const Sidebar = ({ lang }: { lang: 'cn' | 'en' }) => (
  <aside className="hidden lg:flex h-screen w-72 fixed left-0 top-0 pt-24 bg-stone-100 flex-col gap-2 z-40">
    <div className="px-6 py-4 mb-4">
      <h3 className="font-headline text-xl text-primary">{lang === 'cn' ? '档案库' : 'Archives'}</h3>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{lang === 'cn' ? '您的创作之旅' : 'Your Creative Journey'}</p>
    </div>
    <nav className="flex flex-col gap-1">
      {[
        { icon: History, label: lang === 'cn' ? '最近卷轴' : 'Recent Scrolls' },
        { icon: BookOpen, label: lang === 'cn' ? '经典主题' : 'Classical Themes' },
        { icon: Bookmark, label: lang === 'cn' ? '已存诗句' : 'Saved Verse' },
        { icon: GraduationCap, label: lang === 'cn' ? '教程' : 'Tutorials' },
      ].map((item) => (
        <a key={item.label} className="flex items-center gap-3 text-stone-500 px-6 py-3 hover:translate-x-1 transition-transform" href="#">
          <item.icon size={18} />
          <span className="font-semibold text-sm">{item.label}</span>
        </a>
      ))}
    </nav>
    <div className="mt-auto px-6 py-8 border-t border-stone-200">
      <button className="w-full bg-primary text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all">
        <PlusCircle size={18} />
        {lang === 'cn' ? '新建动画' : 'New Animation'}
      </button>
    </div>
  </aside>
);

// --- Main App ---

export default function App() {
  const [lang, setLang] = useState<'cn' | 'en'>('cn');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PoetryAnalysis | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<{ analysis: PoetryAnalysis; audioUrl: string | null }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('interpretation');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const navigateToPoem = (poemTitle: string) => {
    setInput(poemTitle);
    handleGenerate(poemTitle);
  };

  const handleGenerate = async (overrideInput?: string) => {
    const targetInput = overrideInput || input;
    if (!targetInput.trim()) return;
    
    // Save current state to history before navigating forward
    if (analysis) {
      setHistory(prev => [...prev, { analysis, audioUrl }]);
    }

    // Reset states
    setAnalysis(null);
    setAudioUrl(null);
    setIsGenerating(true);
    setIsAudioLoading(true);
    setIsPlaying(false);

    try {
      // Check Cache
      const cached = getCachedResult(targetInput);
      if (cached) {
        setAnalysis(cached.analysis);
        setAudioUrl(cached.audioUrl);
        setIsGenerating(false);
        setIsAudioLoading(false);
        return;
      }

      // 1. Text Analysis (Instant)
      const result = await analyzePoetry(targetInput);
      setAnalysis(result);
      setIsGenerating(false);

      // 2. Audio Synthesis (Async, ~2s)
      const aUrl = await generateTTS(result.content.join(' '));
      setAudioUrl(aUrl);
      setIsAudioLoading(false);

      // Cache the full result
      setCachedResult(targetInput, { analysis: result, audioUrl: aUrl });

    } catch (error) {
      console.error("Generation failed:", error);
      setIsGenerating(false);
      setIsAudioLoading(false);
    }
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setAnalysis(last.analysis);
    setAudioUrl(last.audioUrl);
    setIsPlaying(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const t = {
    heroTitle: lang === 'cn' ? '赋予古诗' : 'Bring Ancient Verses',
    heroSubtitle: lang === 'cn' ? '新的生命' : 'to Life',
    heroDesc: lang === 'cn' ? '极速古诗词学习引擎。深度解析、专业朗诵、知识互联。' : 'High-speed ancient poetry learning engine. Deep analysis, professional narration, and knowledge interconnectivity.',
    placeholder: lang === 'cn' ? '在此输入唐诗或宋词...' : 'Enter your Tang or Song poetry here...',
    generate: lang === 'cn' ? '生成' : 'Generate',
    generating: lang === 'cn' ? '生成中...' : 'Generating...',
    suggested: lang === 'cn' ? '推荐：李白《静夜思》' : 'Suggested: Li Bai\'s "Quiet Night Thought"',
    viewExamples: lang === 'cn' ? '查看示例' : 'View Examples',
    features: [
      { title: lang === 'cn' ? '极速引擎' : 'High-Speed Engine', desc: lang === 'cn' ? '毫秒级文本解析与专业级普通话朗诵。' : 'Millisecond text analysis and professional Mandarin narration.' },
      { title: lang === 'cn' ? '知识互联' : 'Knowledge Interlink', desc: lang === 'cn' ? '诗人、作品、意象深度关联，构建知识图谱。' : 'Deeply link authors, works, and imagery to build a knowledge graph.' },
      { title: lang === 'cn' ? '词语解析' : 'Keyword Analysis', desc: lang === 'cn' ? '精准提取难点词汇，提供双语注释与拼音。' : 'Precisely extract difficult vocabulary with bilingual annotations and Pinyin.' },
    ],
    tabs: [
      { id: 'interpretation', label: lang === 'cn' ? '诗词解析' : 'Interpretation' },
      { id: 'keywords', label: lang === 'cn' ? '词语解析' : 'Keywords' },
      { id: 'author', label: lang === 'cn' ? '诗人档案' : 'Author Profile' },
      { id: 'related', label: lang === 'cn' ? '相似诗词' : 'Related' },
    ],
    authorLabels: {
      dynasty: lang === 'cn' ? '朝代' : 'Dynasty',
      dates: lang === 'cn' ? '生卒' : 'Dates',
      titles: lang === 'cn' ? '官职/称号' : 'Titles',
      works: lang === 'cn' ? '代表作' : 'Representative Works',
    },
    audioActive: lang === 'cn' ? '专业朗诵已就绪' : 'Professional Narration Ready',
    startNew: lang === 'cn' ? '开始新旅程' : 'Start New Journey',
  };

  return (
    <div className="min-h-screen">
      <Navbar lang={lang} setLang={setLang} />
      <Sidebar lang={lang} />

      {/* Navigation History - Back Button */}
      <AnimatePresence>
        {history.length > 0 && (
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={handleBack}
            className="fixed top-24 left-8 lg:left-80 z-40 p-3 rounded-full glass border border-white/20 shadow-lg text-primary hover:scale-110 transition-all flex items-center gap-2 group"
            title={lang === 'cn' ? '返回' : 'Back'}
          >
            <ChevronLeft size={20} />
            <span className="text-xs font-bold uppercase tracking-widest hidden group-hover:block transition-all pr-2">
              {lang === 'cn' ? '返回' : 'Back'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <main className="pt-28 pb-12 lg:ml-72 min-h-screen px-6 md:px-12 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {!analysis ? (
            <motion.section 
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto space-y-12 py-12"
            >
              <div className="text-center space-y-4">
                <h1 className="font-headline text-5xl font-bold text-primary tracking-tight leading-tight">
                  {t.heroTitle} <br/>
                  <span className="text-secondary italic">{t.heroSubtitle}</span>
                </h1>
                <p className="text-stone-600 max-w-xl mx-auto text-lg">
                  {t.heroDesc}
                </p>
              </div>

              <div className="relative group">
                <div className="bg-surface-container-highest rounded-full p-2 flex items-center shadow-lg shadow-emerald-900/5 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                  <div className="pl-6 text-primary">
                    <Search size={24} />
                  </div>
                  <input 
                    className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-4 text-lg font-body text-on-surface placeholder:text-stone-400" 
                    placeholder={t.placeholder}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                  <div className="flex items-center gap-4 mr-2">
                    <button 
                      onClick={() => handleGenerate()}
                      disabled={isGenerating}
                      className="flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-full font-bold shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Sparkles size={20} />
                        </motion.div>
                      ) : (
                        <Sparkles size={20} />
                      )}
                      {isGenerating ? t.generating : t.generate}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between px-6 mt-3">
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">{t.suggested}</span>
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest cursor-pointer hover:underline">{t.viewExamples}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                {t.features.map((feature, i) => {
                  const Icon = [Sparkles, Languages, Maximize2][i];
                  return (
                    <div key={i} className="bg-white p-8 rounded-xl border border-stone-200 shadow-sm space-y-4">
                      <Icon 
                        className={cn(i === 0 ? 'text-secondary' : i === 1 ? 'text-primary' : 'text-tertiary')} 
                        size={32} 
                      />
                      <h3 className="font-headline text-xl font-bold">{feature.title}</h3>
                      <p className="text-sm text-stone-600 leading-relaxed">{feature.desc}</p>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Main Content Section */}
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white rounded-2xl p-12 shadow-sm border border-stone-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <BookOpen size={200} />
                  </div>
                  
                  <div className="max-w-2xl mx-auto space-y-12 text-center">
                    <div className="space-y-4">
                      <h2 className="font-headline text-4xl font-bold text-primary tracking-tight">
                        {analysis.title[lang]}
                      </h2>
                      <p className="text-stone-400 font-headline text-lg">
                        {analysis.author.dynasty[lang]} · {analysis.author.name[lang]}
                      </p>
                    </div>

                    <div className="space-y-6">
                      {analysis.content.map((line, i) => (
                        <div key={i} className="space-y-2">
                          <p className="font-headline text-2xl text-on-surface leading-relaxed tracking-wide">
                            {line}
                          </p>
                          <p className="text-sm font-body text-stone-400 font-medium tracking-widest">
                            {analysis.pinyin[i]}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-12 border-t border-stone-100 flex flex-col items-center gap-6">
                      <button 
                        onClick={togglePlay}
                        className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
                      </button>
                      <p className="text-xs font-bold text-primary uppercase tracking-[0.2em]">
                        {isAudioLoading ? t.generating : t.audioActive}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Quick Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 space-y-4">
                    <h4 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
                      <Languages size={18} />
                      {lang === 'cn' ? '现代汉语翻译' : 'Modern Translation'}
                    </h4>
                    <p className="text-stone-600 leading-relaxed italic">
                      "{analysis.translation[lang]}"
                    </p>
                  </div>
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 space-y-4">
                    <h4 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
                      <Heart size={18} />
                      {lang === 'cn' ? '情感意境' : 'Emotional Landscape'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.emotionalTags[lang].map((tag) => (
                        <span key={tag} className="px-3 py-1 rounded-full bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-wider">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      {analysis.sentiment[lang]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sidebar Analysis Section */}
              <aside className="space-y-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg overflow-hidden">
                    <img src="https://picsum.photos/seed/ai/100/100" alt="AI" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-primary text-lg leading-tight">{lang === 'cn' ? '诗词解析' : 'Poetry Analysis'}</h3>
                    <p className="font-body text-xs text-stone-500 font-medium">{lang === 'cn' ? '数字学者 AI' : 'Digital Scholar AI'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {t.tabs.map((tab, i) => {
                    const Icon = [BookOpen, Sparkles, Info, History][i];
                    return (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3 rounded-xl font-body text-sm font-medium transition-all",
                          activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-stone-500 hover:bg-stone-200/50"
                        )}
                      >
                        <Icon size={18} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 min-h-[300px]">
                  {activeTab === 'author' && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="space-y-6"
                    >
                      <div className="flex gap-4 items-start">
                        <img 
                          src={analysis.author.portraitUrl} 
                          alt={analysis.author.name[lang]} 
                          className="w-24 h-32 object-cover rounded-xl shadow-md border border-stone-200"
                          referrerPolicy="no-referrer"
                        />
                        <div className="space-y-1">
                          <h3 className="text-xl font-headline font-bold text-primary">{analysis.author.name[lang]}</h3>
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{analysis.author.dynasty[lang]} · {analysis.author.dates[lang]}</p>
                          <div className="flex flex-wrap gap-1 pt-2">
                            {analysis.author.titles[lang].slice(0, 3).map((title, i) => (
                              <span key={i} className="px-2 py-0.5 bg-primary/5 rounded-md text-[10px] font-bold text-primary uppercase">
                                {title}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm text-stone-700 leading-relaxed italic border-l-2 border-primary/20 pl-4">
                          {analysis.author.bio[lang]}
                        </p>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{t.authorLabels.works}</p>
                          <div className="flex flex-col gap-2">
                            {analysis.author.works[lang].map((work, i) => (
                              <button 
                                key={i} 
                                onClick={() => navigateToPoem(work)}
                                className="text-left px-3 py-2 bg-stone-50 hover:bg-primary/5 hover:text-primary rounded-lg text-xs font-medium text-stone-600 transition-all flex justify-between items-center group"
                              >
                                {work}
                                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'interpretation' && (
                    <div className="space-y-6">
                      <h4 className="font-headline text-xl font-bold text-primary">{lang === 'cn' ? '深度赏析' : 'Deep Interpretation'}</h4>
                      <p className="text-sm text-stone-600 leading-relaxed">
                        {analysis.interpretation[lang]}
                      </p>
                      <div className="space-y-4 pt-4 border-t border-stone-100">
                        <h5 className="text-xs font-bold text-stone-400 uppercase tracking-widest">{lang === 'cn' ? '意象分析' : 'Imagery Analysis'}</h5>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          {analysis.imagery[lang]}
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'keywords' && (
                    <div className="space-y-6">
                      <h4 className="font-headline text-xl font-bold text-primary">{lang === 'cn' ? '词语解析' : 'Keyword Analysis'}</h4>
                      <div className="space-y-4">
                        {analysis.keywords.map((kw, i) => (
                          <div key={i} className="p-4 bg-stone-50 rounded-xl space-y-1">
                            <div className="flex justify-between items-baseline">
                              <span className="font-headline text-lg font-bold text-on-surface">{kw.word}</span>
                              <span className="text-xs font-mono text-primary">{kw.pinyin}</span>
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">
                              {kw.annotation[lang]}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'related' && (
                    <div className="space-y-6">
                      <h4 className="font-headline text-xl font-bold text-primary">{lang === 'cn' ? '相似诗词' : 'Related Poems'}</h4>
                      <div className="space-y-4">
                        {analysis.relatedPoems.map((poem, i) => (
                          <button 
                            key={i} 
                            onClick={() => navigateToPoem(poem.title.cn)}
                            className="w-full text-left p-4 bg-stone-50 hover:bg-primary/5 rounded-xl space-y-2 transition-all group"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-headline text-lg font-bold text-on-surface group-hover:text-primary transition-colors">{poem.title[lang]}</span>
                              <ChevronRight size={16} className="text-stone-400 group-hover:text-primary transition-colors" />
                            </div>
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{poem.author}</p>
                            <p className="text-sm text-stone-600 leading-relaxed italic">
                              {poem.reason[lang]}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => { 
                    if (analysis) setHistory(prev => [...prev, { analysis, audioUrl }]);
                    setAnalysis(null); 
                    setInput(''); 
                  }}
                  className="w-full py-3 text-stone-400 hover:text-primary transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} />
                  {t.startNew}
                </button>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="w-full py-12 px-8 mt-auto bg-stone-50 border-t border-stone-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 max-w-screen-2xl mx-auto">
          <div className="text-stone-400 font-body text-xs uppercase tracking-widest">
            © 742–2024 The Scholar’s Pavilion. Cultivating Wisdom through AI.
          </div>
          <div className="flex gap-8">
            {['Curriculum Standards', 'Poetry Database', 'Privacy Scroll', 'Contact Sage'].map((link) => (
              <a key={link} className="text-xs uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-all" href="#">{link}</a>
            ))}
          </div>
        </div>
      </footer>

      {/* Audio Elements */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)} 
          preload="auto"
        />
      )}
    </div>
  );
}
