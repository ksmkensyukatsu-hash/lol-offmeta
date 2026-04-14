"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  onSnapshot, 
  serverTimestamp,
  increment,
  arrayUnion
} from 'firebase/firestore';

/**
 * OFF-GG: LoL Off-Meta Build Sharing Platform
 * --------------------------------------------------
 * [主な変更点]
 * 1. 評価制限: 1人1回まで評価可能（FirebaseのarrayUnionを使用）
 * 2. デザイン刷新: 「カッコよすぎ」を抑えた、清潔感のある実用的なUI
 * 3. 構成の整理: ルーン、アイテム、説明をバランスよく配置
 */

const firebaseConfig = {
  apiKey: "AIzaSyC6qO_0mBrwywgcTwneF2HvZ0Lvhq_opWY",
  authDomain: "off-gg.firebaseapp.com",
  projectId: "off-gg",
  storageBucket: "off-gg.firebasestorage.app",
  messagingSenderId: "76103631899",
  appId: "1:76103631899:web:e8d5fb82c872379a4724be",
  measurementId: "G-L4JMTEE604"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "off-gg-clean-v1"; // バージョンアップ

const DDRAGON_VERSION = '15.1.1';

export default function App() {
  const [view, setView] = useState<'list' | 'detail' | 'post'>('list');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // データ保持
  const [champions, setChampions] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [allRunes, setAllRunes] = useState<any[]>([]);
  const [selectedChamp, setSelectedChamp] = useState<any>(null);
  const [currentBuilds, setCurrentBuilds] = useState<any[]>([]);

  // フォーム用
  const [buildTitle, setBuildTitle] = useState('');
  const [buildDescription, setBuildDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedItems, setSelectedItems] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [primaryPath, setPrimaryPath] = useState<any>(null);
  const [primaryRunes, setPrimaryRunes] = useState<number[]>([]); 
  const [secondaryPath, setSecondaryPath] = useState<any>(null);
  const [secondaryRunes, setSecondaryRunes] = useState<number[]>([]);

  const [itemSearch, setItemSearch] = useState('');
  const [search, setSearch] = useState('');

  // 履歴管理
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => setView(e.state?.view || 'list');
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (next: 'list' | 'detail' | 'post') => {
    window.history.pushState({ view: next }, '');
    setView(next);
  };

  // 1. 初期化
  useEffect(() => {
    const init = async () => {
      const safety = setTimeout(() => setLoading(false), 3000);
      try {
        await signInAnonymously(auth);
        const [c, i, r] = await Promise.all([
          fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/ja_JP/champion.json`).then(r => r.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/ja_JP/item.json`).then(r => r.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/ja_JP/runesReforged.json`).then(r => r.json())
        ]);
        setChampions(Object.values(c.data).sort((a: any, b: any) => a.name.localeCompare(b.name, 'ja')));
        setAllRunes(r);
        const srItems = Object.keys(i.data).map(id => ({ id, ...i.data[id] }))
          .filter(item => item.maps?.["11"] === true && item.gold?.purchasable && item.inStore !== false && !item.requiredChampion);
        setAllItems(srItems);
      } catch (e) { console.error(e); } finally { clearTimeout(safety); setLoading(false); }
    };
    init();
    onAuthStateChanged(auth, setUser);
  }, []);

  // 2. データ同期
  useEffect(() => {
    if (!selectedChamp || view !== 'detail' || !user) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'builds');
    return onSnapshot(colRef, (snap) => {
      const builds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = builds
        .filter((b: any) => b.championId === selectedChamp.id)
        .sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
      setCurrentBuilds(filtered);
    });
  }, [selectedChamp, view, user]);

  const handleOpenDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/ja_JP/champion/${id}.json`);
      const data = await res.json();
      setSelectedChamp(data.data[id]);
      navigate('detail');
      window.scrollTo(0, 0);
    } finally { setLoading(false); }
  };

  const handlePublish = async () => {
    if (!buildTitle || !selectedChamp || !user) return;
    setLoading(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'builds');
      await addDoc(colRef, {
        title: buildTitle,
        description: buildDescription,
        youtubeUrl,
        items: selectedItems.filter(i => i !== null),
        runes: { primaryPathId: primaryPath?.id, primaryRunes, secondaryPathId: secondaryPath?.id, secondaryRunes },
        championId: selectedChamp.id,
        authorId: user.uid,
        likes: 0,
        likedBy: [], // 評価したユーザーのリスト
        createdAt: serverTimestamp(),
      });
      setBuildTitle(''); setBuildDescription(''); setYoutubeUrl('');
      setSelectedItems(new Array(6).fill(null));
      setPrimaryPath(null); setSecondaryPath(null);
      navigate('detail');
    } catch (e) { alert("Error saving build."); } finally { setLoading(false); }
  };

  const handleLike = async (id: string, likedBy: string[]) => {
    if (!user || likedBy?.includes(user.uid)) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'builds', id);
      await updateDoc(docRef, { 
        likes: increment(1),
        likedBy: arrayUnion(user.uid) // ユーザーIDをリストに追加
      });
    } catch (e) { console.error(e); }
  };

  const filteredChamps = useMemo(() => 
    champions.filter(c => c.name.includes(search) || c.id.toLowerCase().includes(search.toLowerCase())),
    [champions, search]
  );

  const filteredItems = useMemo(() => 
    allItems.filter(item => item.name.toLowerCase().includes(itemSearch.toLowerCase())),
    [allItems, itemSearch]
  );

  const getRuneImg = (path: string) => `https://ddragon.canisback.com/img/${path}`;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#212529] font-sans">
      {/* --- ヘッダー --- */}
      <nav className="bg-[#5383e8] h-16 flex items-center px-6 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('list')}>
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#5383e8] font-black italic">OFF</div>
          <span className="text-white font-bold text-xl tracking-tight">OFF.GG</span>
        </div>
        <div className="ml-10 hidden md:flex gap-6 text-white/80 text-sm font-bold">
          <span className="hover:text-white cursor-pointer transition-colors" onClick={() => navigate('list')}>チャンピオン一覧</span>
          <span className="opacity-50">ランキング(準備中)</span>
        </div>
      </nav>

      {/* --- 1. 一覧画面 --- */}
      {view === 'list' && (
        <div className="animate-in">
          <header className="bg-[#1c1c1f] py-20 text-center">
            <h1 className="text-white text-4xl font-bold mb-8">オフメタ、それは可能性。</h1>
            <div className="max-w-xl mx-auto px-4">
              <div className="relative">
                <input 
                  type="text" placeholder="チャンピオンを検索..." 
                  className="w-full bg-white h-14 px-6 rounded shadow-lg outline-none text-lg text-black"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                />
                <span className="absolute right-5 top-4 text-gray-400">🔍</span>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto p-8 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
            {filteredChamps.map(c => (
              <div key={c.id} onClick={() => handleOpenDetail(c.id)} className="cursor-pointer group">
                <div className="relative overflow-hidden rounded border border-gray-200 bg-white p-1 hover:border-[#5383e8] transition-all shadow-sm">
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.image.full}`} className="w-full rounded" />
                </div>
                <p className="text-[11px] font-bold text-center mt-2 text-gray-600 truncate">{c.name}</p>
              </div>
            ))}
          </main>
        </div>
      )}

      {/* --- 2. 詳細画面 --- */}
      {view === 'detail' && selectedChamp && (
        <div className="animate-in pb-20">
          <div className="bg-[#1c1c1f] border-b border-gray-800">
            <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 border-4 border-[#5383e8] rounded-xl overflow-hidden shadow-2xl bg-black">
                <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${selectedChamp.image.full}`} className="w-full h-full object-cover" />
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-white text-5xl font-black">{selectedChamp.name}</h2>
                <p className="text-[#5383e8] font-bold mt-2 uppercase tracking-widest">{selectedChamp.title}</p>
              </div>
              <button onClick={() => navigate('post')} className="ml-auto bg-[#5383e8] hover:bg-[#4171d6] text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-all active:scale-95">
                ビルドを投稿する
              </button>
            </div>
          </div>

          <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <h3 className="text-xl font-bold text-gray-700 border-b pb-2">投稿されたビルド</h3>
              {currentBuilds.length > 0 ? currentBuilds.map((build) => (
                <div key={build.id} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-2xl font-bold text-gray-800 mb-2">{build.title}</h4>
                      {build.youtubeUrl && (
                        <a href={build.youtubeUrl} target="_blank" className="flex items-center gap-1 text-xs text-red-500 font-bold hover:underline">
                          📺 YouTubeで見る
                        </a>
                      )}
                    </div>
                    {/* 評価ボタン: 自分が投票済みなら無効化 */}
                    <button 
                      onClick={() => handleLike(build.id, build.likedBy)} 
                      disabled={build.likedBy?.includes(user?.uid)}
                      className={`px-5 py-2 rounded-full border-2 flex items-center gap-2 transition-all ${build.likedBy?.includes(user?.uid) ? 'bg-gray-100 border-gray-200 text-gray-400' : 'border-[#5383e8] text-[#5383e8] hover:bg-[#5383e8] hover:text-white active:scale-110'}`}
                    >
                      <span>🔥</span>
                      <span className="font-bold text-lg">{build.likes || 0}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-[#f1f3f5] p-6 rounded-lg mb-6 border border-gray-100">
                    {/* ルーン */}
                    <div className="flex flex-col items-center border-r border-gray-200 pr-4">
                       <span className="text-[10px] font-bold text-gray-400 uppercase mb-3">ルーン</span>
                       <div className="flex gap-4">
                         {build.runes?.primaryPathId && (
                           <div className="flex flex-col gap-1 items-center">
                             {build.runes.primaryRunes?.map((rId: number, i: number) => {
                               const path = allRunes.find(r => r.id === build.runes.primaryPathId);
                               const rune = path?.slots.flatMap((s:any) => s.runes).find((ru:any) => ru.id === rId);
                               return rune ? <img key={i} src={getRuneImg(rune.icon)} className={i === 0 ? 'w-8 h-8' : 'w-5 h-5'} alt="r" /> : null;
                             })}
                           </div>
                         )}
                         {build.runes?.secondaryPathId && (
                           <div className="flex flex-col gap-2 items-center border-l border-gray-300 pl-4 opacity-50 grayscale">
                             {build.runes.secondaryRunes?.map((rId: number, i: number) => {
                               const path = allRunes.find(r => r.id === build.runes.secondaryPathId);
                               const rune = path?.slots.flatMap((s:any) => s.runes).find((ru:any) => ru.id === rId);
                               return rune ? <img key={i} src={getRuneImg(rune.icon)} className="w-5 h-5" alt="r" /> : null;
                             })}
                           </div>
                         )}
                       </div>
                    </div>
                    {/* アイテム */}
                    <div className="md:col-span-3">
                       <span className="text-[10px] font-bold text-gray-400 uppercase mb-3 block">ビルドアイテム</span>
                       <div className="flex flex-wrap gap-2">
                         {build.items.map((itemId: string, i: number) => (
                           <img key={i} src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`} className="w-12 h-12 rounded border border-gray-300 shadow-sm" />
                         ))}
                       </div>
                    </div>
                  </div>
                  <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {build.description}
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400 font-bold">まだ投稿がありません。</div>
              )}
            </div>
            
            <aside className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">スキル構成</h4>
                <div className="grid grid-cols-5 gap-2">
                   <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/passive/${selectedChamp.passive.image.full}`} className="rounded border border-gray-100" />
                   {selectedChamp.spells.map((s:any, i:number) => (
                     <img key={i} src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${s.image.full}`} className="rounded border border-gray-100" />
                   ))}
                </div>
              </div>
              <button onClick={() => navigate('list')} className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg font-bold text-sm transition-all uppercase tracking-tighter">← 一覧に戻る</button>
            </aside>
          </main>
        </div>
      )}

      {/* --- 3. 投稿画面 --- */}
      {view === 'post' && selectedChamp && (
        <div className="animate-in max-w-7xl mx-auto py-12 px-6 pb-60">
          <div className="flex items-center gap-6 mb-10 border-b pb-10">
            <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${selectedChamp.image.full}`} className="w-16 h-16 rounded shadow-md border-2 border-[#5383e8]" />
            <h2 className="text-3xl font-bold">{selectedChamp.name} の新規ビルドを投稿</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-10">
              {/* 基本情報 */}
              <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-6">
                <div>
                  <label className="text-xs font-black text-gray-400 mb-2 block uppercase">ビルドタイトル</label>
                  <input 
                    type="text" placeholder="例: ADCをワンパンするタンクAP構成"
                    className="w-full bg-[#f8f9fa] border-2 border-gray-200 focus:border-[#5383e8] h-14 px-4 rounded outline-none text-lg font-bold transition-all"
                    value={buildTitle} onChange={(e) => setBuildTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 mb-2 block uppercase">YouTube URL (任意)</label>
                  <input 
                    type="text" placeholder="https://youtube.com/..."
                    className="w-full bg-[#f8f9fa] border-2 border-gray-200 focus:border-red-400 h-14 px-4 rounded outline-none text-sm transition-all"
                    value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                </div>
              </section>

              {/* ルーンエディタ */}
              <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <label className="text-xs font-black text-gray-400 mb-8 block uppercase text-center border-b pb-4">ルーン選択</label>
                <div className="grid grid-cols-2 gap-8">
                  <div className="border-r pr-6 text-center">
                    <span className="text-[10px] font-bold text-gray-500 mb-6 block">メインパス</span>
                    <div className="flex justify-between gap-1 mb-8">
                       {allRunes.map((p) => (
                         <div key={p.id} onClick={() => { setPrimaryPath(p); setPrimaryRunes([]); }} className={`cursor-pointer w-8 h-8 rounded-full border-2 p-1.5 flex items-center justify-center transition-all ${primaryPath?.id === p.id ? 'border-[#5383e8] bg-[#5383e8]/10' : 'border-gray-200 opacity-40 hover:opacity-100'}`}>
                           <img src={getRuneImg(p.icon)} className="w-full" />
                         </div>
                       ))}
                    </div>
                    {primaryPath?.slots.map((slot: any, sIdx: number) => (
                      <div key={sIdx} className="flex justify-center gap-3 py-1">
                        {slot.runes.map((r: any) => (
                          <div key={r.id} onClick={() => { const n = [...primaryRunes]; n[sIdx] = r.id; setPrimaryRunes(n); }}
                            className={`cursor-pointer transition-all ${primaryRunes[sIdx] === r.id ? 'scale-125 brightness-110 border-2 border-[#5383e8] rounded-full' : 'opacity-10 grayscale hover:opacity-100'}`}>
                            <img src={getRuneImg(r.icon)} className={`${sIdx === 0 ? 'w-8 h-8' : 'w-5 h-5'}`} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-gray-500 mb-6 block">サブパス</span>
                    <div className="flex justify-between gap-1 mb-8">
                       {allRunes.map((p) => (
                         <div key={p.id} onClick={() => { if(p.id !== primaryPath?.id) { setSecondaryPath(p); setSecondaryRunes([]); } }} className={`cursor-pointer w-8 h-8 rounded-full border-2 p-1.5 flex items-center justify-center transition-all ${secondaryPath?.id === p.id ? 'border-gray-800 bg-gray-100' : 'border-gray-200 opacity-40 hover:opacity-100'}`}>
                           <img src={getRuneImg(p.icon)} className="w-full" />
                         </div>
                       ))}
                    </div>
                    {secondaryPath?.slots.slice(1).map((slot: any, sIdx: number) => (
                      <div key={sIdx} className="flex justify-center gap-3 py-1">
                        {slot.runes.map((r: any) => (
                          <div key={r.id} onClick={() => {
                            const n = [...secondaryRunes];
                            if (n.includes(r.id)) setSecondaryRunes(n.filter(id => id !== r.id));
                            else if (n.length < 2) setSecondaryRunes([...n, r.id]);
                          }}
                            className={`cursor-pointer transition-all ${secondaryRunes.includes(r.id) ? 'scale-125 brightness-110 border-2 border-gray-800 rounded-full' : 'opacity-10 grayscale hover:opacity-100'}`}>
                            <img src={getRuneImg(r.icon)} className="w-5 h-5" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* アイテム */}
              <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <label className="text-xs font-black text-gray-400 mb-6 block uppercase">アイテムスロット (最大6個)</label>
                <div className="grid grid-cols-6 gap-3">
                  {selectedItems.map((itemId, idx) => (
                    <div key={idx} onClick={() => { const n = [...selectedItems]; n[idx] = null; setSelectedItems(n); }}
                      className={`aspect-square rounded border-2 border-dashed flex items-center justify-center cursor-pointer transition-all ${itemId ? 'border-transparent shadow' : 'border-gray-200 hover:border-[#5383e8]'}`}>
                      {itemId ? <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`} className="rounded w-full h-full" /> : <span className="text-gray-300 font-bold text-xl">+</span>}
                    </div>
                  ))}
                </div>
              </section>

              {/* 解説 */}
              <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <label className="text-xs font-black text-gray-400 mb-4 block uppercase">立ち回りの解説</label>
                <textarea 
                  placeholder="ビルドの強み、相性の良いチャンピオンなどを解説してください。"
                  className="w-full bg-[#f8f9fa] border-2 border-gray-200 focus:border-[#5383e8] p-4 rounded outline-none h-48 resize-none font-medium text-gray-700 transition-all"
                  value={buildDescription} onChange={(e) => setBuildDescription(e.target.value)}
                />
              </section>

              <div className="flex gap-4">
                <button onClick={() => navigate('detail')} className="flex-1 py-5 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-500 transition-all">キャンセル</button>
                <button onClick={handlePublish} disabled={!buildTitle || !user}
                  className={`flex-[2] py-5 rounded font-bold text-white shadow-xl transition-all ${buildTitle && user ? 'bg-[#5383e8] hover:bg-[#4171d6] active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}>
                  ビルドを公開する
                </button>
              </div>
            </div>

            {/* アイテムライブラリ */}
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[1000px] shadow-lg overflow-hidden sticky top-24">
              <div className="p-6 border-b">
                <h4 className="text-sm font-bold text-gray-500 mb-4">アイテムライブラリ (Map 11)</h4>
                <input 
                  type="text" placeholder="アイテム名で検索..."
                  className="w-full bg-[#f8f9fa] border-2 border-gray-200 focus:border-[#5383e8] h-12 px-4 rounded outline-none font-bold text-sm transition-all"
                  value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-4 sm:grid-cols-5 gap-4 content-start custom-scrollbar">
                {filteredItems.map(item => (
                  <img key={item.id} src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${item.id}.png`} onClick={() => {
                    const n = [...selectedItems]; const i = n.indexOf(null);
                    if (i !== -1) { n[i] = item.id; setSelectedItems(n); }
                  }} className="rounded border border-gray-200 hover:border-[#5383e8] hover:scale-110 transition-all cursor-pointer shadow-sm" title={item.name} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ロード中オーバーレイ --- */}
      {loading && (
        <div className="fixed inset-0 bg-[#f8f9fa]/90 z-[100] flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-[#5383e8] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-[#5383e8] font-bold tracking-widest animate-pulse">CONNECTING...</p>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #5383e8; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}