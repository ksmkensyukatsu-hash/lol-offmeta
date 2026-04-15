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
const appId = "off-gg-clean-v1";

const DDRAGON_VERSION = '15.1.1';

export default function App() {
  const [view, setView] = useState<'list' | 'detail' | 'post'>('list');
  const [listTab, setListTab] = useState<'latest' | 'champions'>('latest');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [champions, setChampions] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [allRunes, setAllRunes] = useState<any[]>([]);
  const [selectedChamp, setSelectedChamp] = useState<any>(null);
  const [currentBuilds, setCurrentBuilds] = useState<any[]>([]);
  const [latestBuilds, setLatestBuilds] = useState<any[]>([]);

  // フォーム用ステート
  const [buildTitle, setBuildTitle] = useState('');
  const [buildDescription, setBuildDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedItems, setSelectedItems] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [primaryPath, setPrimaryPath] = useState<any>(null);
  const [primaryRunes, setPrimaryRunes] = useState<number[]>([]); 
  const [secondaryPath, setSecondaryPath] = useState<any>(null);
  const [secondaryRunes, setSecondaryRunes] = useState<number[]>([]);
  const [skillOrder, setSkillOrder] = useState<string[]>(['Q', 'W', 'E']);

  const [itemSearch, setItemSearch] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handlePop = (e: PopStateEvent) => setView(e.state?.view || 'list');
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (next: 'list' | 'detail' | 'post') => {
    window.history.pushState({ view: next }, '');
    setView(next);
  };

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

  useEffect(() => {
    if (!selectedChamp || view !== 'detail' || !user) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'builds');
    return onSnapshot(colRef, (snap) => {
      const builds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = builds
        .filter((b: any) => b.championId === selectedChamp.id)
        .sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
      setCurrentBuilds(filtered);
    }, (err) => console.error("Snapshot error:", err));
  }, [selectedChamp, view, user]);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'builds');
    return onSnapshot(colRef, (snap) => {
      const builds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = builds.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setLatestBuilds(sorted.slice(0, 20));
    }, (err) => console.error("Latest Snapshot error:", err));
  }, [user]);

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
        skillOrder,
        championId: selectedChamp.id,
        authorId: user.uid,
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      });
      setBuildTitle(''); setBuildDescription(''); setYoutubeUrl('');
      setSelectedItems(new Array(6).fill(null));
      setPrimaryPath(null); setSecondaryPath(null);
      setSkillOrder(['Q', 'W', 'E']);
      navigate('detail');
    } catch (e) { alert("Error saving build."); } finally { setLoading(false); }
  };

  const handleLike = async (id: string, likedBy: string[]) => {
    if (!user || likedBy?.includes(user.uid)) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'builds', id);
      await updateDoc(docRef, { 
        likes: increment(1),
        likedBy: arrayUnion(user.uid)
      });
    } catch (e) { console.error(e); }
  };

  const handleShare = (build: any) => {
    const champ = champions.find(c => c.id === build.championId);
    const champName = champ ? champ.name : build.championId;
    const text = encodeURIComponent(`【OFF.GG】${champName}のオフメタ構成「${build.title}」を発見！🔥 #LoL #OFFGG #オフメタ`);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const filteredChamps = useMemo(() => 
    champions.filter(c => c.name.includes(search) || c.id.toLowerCase().includes(search.toLowerCase())),
    [champions, search]
  );

  const filteredItems = useMemo(() => 
    allItems.filter(item => item.name.toLowerCase().includes(itemSearch.toLowerCase())),
    [allItems, itemSearch]
  );

  // ルーン画像の取得先を公式DDragonのCDNに変更
  const getRuneImg = (path: string) => `https://ddragon.leagueoflegends.com/cdn/img/${path}`;

  return (
    <div className="min-h-screen bg-[#e9ecef] text-[#212529] font-sans">
      <nav className="bg-[#5383e8] h-16 flex items-center px-6 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('list')}>
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#5383e8] font-black italic">OFF</div>
          <span className="text-white font-bold text-xl tracking-tight">OFF.GG</span>
        </div>
      </nav>

      {view === 'list' && (
        <div className="animate-in">
          <header className="bg-[#1c1c1f] py-20 text-center relative overflow-hidden shadow-inner">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <h1 className="text-white text-4xl font-black mb-8 italic tracking-tighter relative z-10 drop-shadow-lg">オフメタ、それは可能性。</h1>
            <div className="max-w-xl mx-auto px-4 relative z-10">
              <input 
                type="text" placeholder="研究対象（チャンピオン）を検索..." 
                className="w-full bg-white h-16 px-6 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] outline-none text-xl text-black font-bold focus:ring-4 focus:ring-[#5383e8]/50 transition-all border-none"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex justify-center gap-6 mt-12">
                <button 
                  onClick={() => setListTab('latest')}
                  className={`px-10 py-4 rounded-2xl font-black transition-all shadow-xl ${listTab === 'latest' ? 'bg-[#5383e8] text-white scale-110 ring-4 ring-[#5383e8]/20' : 'bg-white/10 text-white/50 hover:text-white hover:bg-white/20'}`}
                >
                  最新の投稿 🔥
                </button>
                <button 
                  onClick={() => setListTab('champions')}
                  className={`px-10 py-4 rounded-2xl font-black transition-all shadow-xl ${listTab === 'champions' ? 'bg-[#5383e8] text-white scale-110 ring-4 ring-[#5383e8]/20' : 'bg-white/10 text-white/50 hover:text-white hover:bg-white/20'}`}
                >
                  チャンピオン一覧
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto p-8">
            {listTab === 'champions' ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-6">
                {filteredChamps.map(c => (
                  <div key={c.id} onClick={() => handleOpenDetail(c.id)} className="cursor-pointer group">
                    <div className="relative overflow-hidden rounded-2xl border-2 border-transparent bg-white p-1 hover:border-[#5383e8] transition-all shadow-lg group-hover:scale-110 group-hover:shadow-2xl group-hover:z-10">
                      <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${c.image.full}`} className="w-full rounded-xl" />
                    </div>
                    <p className="text-[11px] font-black text-center mt-3 text-gray-500 group-hover:text-gray-900 truncate">{c.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-8">
                {latestBuilds.length > 0 ? latestBuilds.map(build => {
                  const champ = champions.find(c => c.id === build.championId);
                  return (
                    <div key={build.id} onClick={() => handleOpenDetail(build.championId)} className="bg-white p-8 rounded-3xl border-2 border-gray-300 hover:border-[#5383e8] flex items-center gap-10 cursor-pointer shadow-lg hover:shadow-2xl transition-all group">
                      <div className="relative shrink-0">
                        <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${build.championId}.png`} className="w-28 h-28 rounded-3xl shadow-lg border-2 border-gray-100 object-cover" />
                        <div className="absolute -bottom-2 -right-2 bg-[#5383e8] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg">
                          {champ?.name || build.championId}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-3xl text-gray-800 group-hover:text-[#5383e8] transition-colors truncate tracking-tight">{build.title}</h4>
                        <div className="flex items-center gap-5 mt-4">
                          <span className="flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-black shadow-sm">
                            🔥 {build.likes || 0}
                          </span>
                          <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            New Experiment Detected
                          </span>
                        </div>
                      </div>
                      <div className="text-[#5383e8] translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all font-black text-4xl">→</div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-40 text-gray-400 font-black text-2xl border-4 border-dashed rounded-[3rem] border-gray-300">研究データを待機中...</div>
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {view === 'detail' && selectedChamp && (
        <div className="animate-in pb-20">
          <div className="bg-[#1c1c1f] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center gap-12 relative z-10">
              <div className="w-48 h-48 border-4 border-[#5383e8] rounded-[2.5rem] overflow-hidden shadow-[0_0_60px_rgba(83,131,232,0.6)] bg-black rotate-3 hover:rotate-0 transition-transform duration-500">
                <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${selectedChamp.image.full}`} className="w-full h-full object-cover scale-110" />
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-white text-7xl font-black italic tracking-tighter leading-none">{selectedChamp.name}</h2>
                <p className="text-[#5383e8] font-black mt-4 uppercase tracking-[0.5em] text-xs opacity-80">{selectedChamp.title}</p>
              </div>
              <button onClick={() => navigate('post')} className="ml-auto bg-[#5383e8] hover:bg-[#4171d6] text-white px-12 py-5 rounded-2xl font-black shadow-[0_15px_30px_rgba(83,131,232,0.4)] transition-all active:scale-95 hover:-translate-y-2">
                ビルドを投稿する
              </button>
            </div>
          </div>

          <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-16">
            <div className="lg:col-span-3 space-y-16">
              {currentBuilds.length > 0 ? currentBuilds.map((build) => (
                <div key={build.id} className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-gray-300 hover:border-[#5383e8] transition-all overflow-hidden relative">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                    <div className="flex-1 flex gap-6">
                      <div className="w-2 h-16 bg-[#5383e8] rounded-full hidden md:block" />
                      <div>
                        <h4 className="text-4xl font-black text-gray-900 leading-tight mb-6 tracking-tight italic">{build.title}</h4>
                        {build.youtubeUrl && (
                          <a href={build.youtubeUrl} target="_blank" className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-full text-[10px] font-black hover:bg-red-700 transition-colors shadow-lg shadow-red-200 uppercase tracking-widest">
                            📺 WATCH EXPERIMENT
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 shrink-0">
                      <button 
                        onClick={() => handleLike(build.id, build.likedBy)} 
                        disabled={build.likedBy?.includes(user?.uid)}
                        className={`px-8 py-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${build.likedBy?.includes(user?.uid) ? 'bg-gray-100 border-gray-200 text-gray-300' : 'border-[#5383e8] text-[#5383e8] hover:bg-[#5383e8] hover:text-white active:scale-125 shadow-xl shadow-[#5383e8]/10'}`}
                      >
                        <span className="text-2xl">🔥</span>
                        <span className="font-black text-3xl">{build.likes || 0}</span>
                      </button>
                      <button 
                        onClick={() => handleShare(build)}
                        className="bg-black text-white w-16 h-16 rounded-3xl font-black flex items-center justify-center hover:bg-gray-800 transition-all active:scale-95 shadow-xl"
                        title="Share on X"
                      >
                        <span className="text-3xl font-black">𝕏</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-10 bg-[#f8faff] p-10 rounded-[2.5rem] mb-12 border-2 border-[#d6e0f0]">
                    {/* ルーンセクション (〇●〇 形式) */}
                    <div className="flex flex-col items-center border-r-2 border-[#d6e0f0] pr-8">
                       <span className="text-[10px] font-black text-[#5383e8] uppercase mb-10 tracking-[0.4em]">Genetic Path</span>
                       <div className="flex flex-col gap-6 items-center">
                         {build.runes?.primaryPathId && (
                           <div className="space-y-4">
                             {allRunes.find(p => p.id === build.runes.primaryPathId)?.slots.map((slot: any, sIdx: number) => (
                               <div key={sIdx} className="flex gap-3 justify-center items-center">
                                 {slot.runes.map((rune: any) => {
                                   const isSelected = build.runes.primaryRunes[sIdx] === rune.id;
                                   return (
                                     <div key={rune.id} className={`rounded-full flex items-center justify-center transition-all ${isSelected ? 'w-11 h-11 bg-[#1c1c1f] ring-2 ring-[#5383e8] shadow-[0_0_15px_rgba(83,131,232,0.4)] z-10 p-1' : 'w-7 h-7 opacity-20 grayscale'}`}>
                                       <img src={getRuneImg(rune.icon)} className="w-full h-full object-contain" alt="r" />
                                     </div>
                                   );
                                 })}
                               </div>
                             ))}
                           </div>
                         )}
                         {build.runes?.secondaryPathId && (
                           <div className="pt-6 border-t-2 border-[#d6e0f0] w-full flex flex-col items-center">
                             <div className="flex gap-4">
                               {build.runes.secondaryRunes?.map((rId: number, i: number) => {
                                 const path = allRunes.find(r => r.id === build.runes.secondaryPathId);
                                 const rune = path?.slots.flatMap((s:any) => s.runes).find((ru:any) => ru.id === rId);
                                 if (!rune) return null;
                                 return (
                                   <div key={i} className="w-10 h-10 bg-white border-2 border-gray-200 p-1 rounded-full flex items-center justify-center shadow-sm">
                                     <img src={getRuneImg(rune.icon)} className="w-full h-full object-contain aspect-square" alt="rune" />
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         )}
                       </div>
                    </div>

                    {/* アイテム ＆ スキルオーダー */}
                    <div className="md:col-span-3 space-y-10">
                       {/* アイテム */}
                       <div>
                         <span className="text-[10px] font-black text-[#5383e8] uppercase mb-8 tracking-[0.4em] block text-center md:text-left">Core Equipment</span>
                         <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                           {build.items.map((itemId: string, i: number) => (
                             <div key={i} className="w-14 h-14 rounded-xl bg-[#1c1c1f] p-0.5 shadow-xl hover:scale-110 hover:-translate-y-1 transition-all cursor-help ring-4 ring-white border-2 border-transparent hover:border-[#5383e8]">
                               <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`} className="w-full h-full object-cover rounded-lg" alt="item" />
                             </div>
                           ))}
                         </div>
                       </div>

                       {/* スキルオーダー */}
                       <div>
                         <span className="text-[10px] font-black text-[#5383e8] uppercase mb-6 tracking-[0.4em] block text-center md:text-left">Skill Priority</span>
                         <div className="flex items-center justify-center md:justify-start gap-4">
                           {build.skillOrder?.map((skill: string, idx: number) => (
                             <React.Fragment key={idx}>
                               <div className="flex flex-col items-center">
                                 <div className="w-12 h-12 bg-black rounded-xl border-2 border-[#5383e8] flex items-center justify-center overflow-hidden shadow-lg">
                                   {selectedChamp.spells.find((s:any, i:number) => ['Q','W','E','R'][i] === skill) && (
                                     <img 
                                      src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${selectedChamp.spells.find((s:any, i:number) => ['Q','W','E','R'][i] === skill).image.full}`} 
                                      className="w-full h-full object-cover"
                                      alt={skill}
                                     />
                                   )}
                                 </div>
                                 <span className="text-xs font-black mt-2 text-gray-800">{skill}</span>
                               </div>
                               {idx < 2 && <span className="text-2xl font-black text-[#5383e8] mb-6">›</span>}
                             </React.Fragment>
                           ))}
                         </div>
                       </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#fcfcfc] p-12 rounded-[2.5rem] border-2 border-gray-300 shadow-inner relative">
                    <div className="absolute top-0 right-12 -translate-y-1/2 bg-[#5383e8] text-white px-8 py-1.5 rounded-full font-black text-[11px] tracking-widest uppercase italic shadow-lg">Researcher Notes</div>
                    <div className="text-gray-800 text-lg md:text-xl leading-[2.4] whitespace-pre-wrap font-bold">
                      {build.description}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-48 text-center bg-white rounded-[3rem] border-4 border-dashed border-gray-300 text-gray-300 font-black text-2xl uppercase tracking-[0.5em]">No Data Found</div>
              )}
            </div>
            
            <aside className="space-y-12">
              <div className="bg-white p-10 rounded-[2.5rem] border-2 border-gray-300 shadow-2xl sticky top-24">
                <h4 className="text-[10px] font-black text-gray-400 mb-8 pb-3 border-b-2 border-gray-100 uppercase tracking-[0.3em]">Standard Skills</h4>
                <div className="grid grid-cols-5 gap-3">
                   <div className="aspect-square bg-black rounded-xl overflow-hidden shadow-md ring-2 ring-gray-100">
                     <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/passive/${selectedChamp.passive.image.full}`} className="w-full h-full object-cover" title="P" alt="P" />
                   </div>
                   {selectedChamp.spells.map((s:any, i:number) => (
                     <div key={i} className="aspect-square bg-black rounded-xl overflow-hidden shadow-md ring-2 ring-gray-100">
                       <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${s.image.full}`} className="w-full h-full object-cover" title={['Q','W','E','R'][i]} alt={['Q','W','E','R'][i]} />
                     </div>
                   ))}
                </div>
                <button onClick={() => navigate('list')} className="w-full mt-10 py-5 bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-500 rounded-2xl font-black text-sm uppercase transition-all shadow-lg tracking-widest">← Return to Lobby</button>
              </div>
            </aside>
          </main>
        </div>
      )}

      {view === 'post' && selectedChamp && (
        <div className="animate-in max-w-7xl mx-auto py-12 px-6 pb-60">
          <div className="flex items-center gap-10 mb-12 border-b-4 border-gray-300 pb-12">
            <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${selectedChamp.image.full}`} className="w-28 h-28 rounded-[2.5rem] shadow-2xl border-4 border-[#5383e8] object-cover" alt="champ" />
            <h2 className="text-5xl font-black italic tracking-tighter">{selectedChamp.name} <span className="text-[#5383e8] not-italic opacity-40">REPORT</span></h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-12">
              <section className="bg-white p-10 rounded-[3rem] shadow-2xl space-y-10 border-2 border-gray-300">
                <div>
                  <label className="text-xs font-black text-gray-400 mb-4 block uppercase tracking-[0.3em]">Build Title</label>
                  <input 
                    type="text" placeholder="例: ADCをワンパンするタンクAP構成"
                    className="w-full bg-gray-50 border-4 border-transparent focus:border-[#5383e8] focus:bg-white h-20 px-8 rounded-3xl outline-none text-2xl font-black transition-all shadow-inner"
                    value={buildTitle} onChange={(e) => setBuildTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 mb-4 block uppercase tracking-[0.3em]">Video Evidence (YouTube URL)</label>
                  <input 
                    type="text" placeholder="https://youtube.com/..."
                    className="w-full bg-gray-50 border-4 border-transparent focus:border-red-500 focus:bg-white h-16 px-8 rounded-2xl outline-none text-sm font-bold shadow-inner"
                    value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                </div>
              </section>

              <section className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-gray-300">
                <label className="text-xs font-black text-gray-400 mb-8 block uppercase text-center border-b-2 border-gray-100 pb-6 tracking-[0.3em]">Skill Max Order</label>
                <div className="flex justify-center gap-10">
                  {['1st', '2nd', '3rd'].map((label, idx) => (
                    <div key={label} className="flex flex-col items-center gap-4">
                      <span className="text-[10px] font-black text-gray-400">{label}</span>
                      <div className="flex flex-col gap-2">
                        {['Q', 'W', 'E'].map(s => (
                          <button
                            key={s}
                            onClick={() => {
                              const next = [...skillOrder];
                              next[idx] = s;
                              setSkillOrder(next);
                            }}
                            className={`w-12 h-12 rounded-xl font-black transition-all border-2 ${skillOrder[idx] === s ? 'bg-[#5383e8] text-white border-[#5383e8] scale-110 shadow-lg' : 'bg-gray-100 text-gray-400 border-transparent hover:border-gray-300'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ルーン選択セクション: アイコンが見えない問題を修正 */}
              <section className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-gray-300">
                <label className="text-xs font-black text-gray-400 mb-10 block uppercase text-center border-b-2 border-gray-100 pb-6 tracking-[0.3em]">Experimental Runes</label>
                <div className="grid grid-cols-2 gap-12">
                  <div className="border-r-2 border-gray-100 pr-10 text-center">
                    <span className="text-[10px] font-black text-[#5383e8] mb-8 block uppercase tracking-widest">Primary Path</span>
                    
                    {/* ルーンパス選択 (Precision, Domination etc) */}
                    <div className="flex justify-center flex-wrap gap-3 mb-12">
                       {allRunes.length > 0 ? allRunes.map((p) => (
                         <div key={p.id} className="flex flex-col items-center gap-1">
                           <div onClick={() => { setPrimaryPath(p); setPrimaryRunes([]); }} className={`cursor-pointer w-12 h-12 rounded-full border-2 p-2 flex items-center justify-center transition-all bg-[#1c1c1f] ${primaryPath?.id === p.id ? 'border-[#5383e8] scale-125 shadow-[0_0_15px_rgba(83,131,232,0.8)]' : 'border-gray-700 opacity-40 hover:opacity-100'}`}>
                             <img src={getRuneImg(p.icon)} className="w-full h-full object-contain aspect-square" alt={p.name} title={p.name} />
                           </div>
                           <span className="text-[8px] font-bold text-gray-400 uppercase truncate w-12">{p.name}</span>
                         </div>
                       )) : (
                         <div className="text-xs text-gray-300 animate-pulse italic">Loading paths...</div>
                       )}
                    </div>
                    
                    <div className="space-y-5">
                      {primaryPath?.slots.map((slot: any, sIdx: number) => (
                        <div key={sIdx} className="bg-gray-100 p-3 rounded-2xl flex justify-center gap-4 border-2 border-transparent hover:border-gray-200 transition-colors shadow-inner">
                          {slot.runes.map((r: any) => {
                            const isSelected = primaryRunes[sIdx] === r.id;
                            return (
                              <div key={r.id} 
                                onClick={() => { const n = [...primaryRunes]; n[sIdx] = r.id; setPrimaryRunes(n); }}
                                className={`cursor-pointer transition-all rounded-full flex items-center justify-center aspect-square ${isSelected ? 'scale-125 ring-4 ring-[#5383e8] bg-[#1c1c1f] shadow-[0_0_20px_rgba(83,131,232,0.6)] z-10 p-1.5' : 'opacity-20 grayscale hover:opacity-80 hover:grayscale-0 p-1.5'}`}
                              >
                                <img src={getRuneImg(r.icon)} className={`${sIdx === 0 ? 'w-10 h-10' : 'w-7 h-7'} object-contain aspect-square`} alt={r.name} title={r.name} />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <span className="text-[10px] font-black text-gray-500 mb-8 block uppercase tracking-widest">Secondary Path</span>
                    <div className="flex justify-center flex-wrap gap-3 mb-12">
                       {allRunes.length > 0 ? allRunes.map((p) => (
                         <div key={p.id} className="flex flex-col items-center gap-1">
                           <div onClick={() => { if(p.id !== primaryPath?.id) { setSecondaryPath(p); setSecondaryRunes([]); } }} className={`cursor-pointer w-12 h-12 rounded-full border-2 p-2 flex items-center justify-center transition-all bg-[#1c1c1f] ${secondaryPath?.id === p.id ? 'border-gray-300 scale-125 shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border-gray-700 opacity-40 hover:opacity-100'}`}>
                             <img src={getRuneImg(p.icon)} className="w-full h-full object-contain aspect-square" alt={p.name} title={p.name} />
                           </div>
                           <span className="text-[8px] font-bold text-gray-400 uppercase truncate w-12">{p.name}</span>
                         </div>
                       )) : null}
                    </div>

                    <div className="space-y-5">
                      {secondaryPath?.slots.slice(1).map((slot: any, sIdx: number) => (
                        <div key={sIdx} className="bg-gray-100 p-3 rounded-2xl flex justify-center gap-4 border-2 border-transparent hover:border-gray-200 transition-colors shadow-inner">
                          {slot.runes.map((r: any) => {
                            const isSelected = secondaryRunes.includes(r.id);
                            return (
                              <div key={r.id} 
                                onClick={() => {
                                  const n = [...secondaryRunes];
                                  if (n.includes(r.id)) setSecondaryRunes(n.filter(id => id !== r.id));
                                  else if (n.length < 2) setSecondaryRunes([...n, r.id]);
                                }}
                                className={`cursor-pointer transition-all rounded-full flex items-center justify-center aspect-square ${isSelected ? 'scale-125 ring-4 ring-gray-900 bg-[#1c1c1f] shadow-[0_0_20px_rgba(0,0,0,0.5)] z-10 p-1.5' : 'opacity-20 grayscale hover:opacity-80 hover:grayscale-0 p-1.5'}`}
                              >
                                <img src={getRuneImg(r.icon)} className="w-7 h-7 object-contain aspect-square" alt={r.name} title={r.name} />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-gray-300">
                <label className="text-xs font-black text-gray-400 mb-8 block uppercase tracking-[0.3em]">Loadout Assignment (Max 6)</label>
                <div className="grid grid-cols-6 gap-6">
                  {selectedItems.map((itemId, idx) => (
                    <div key={idx} onClick={() => { const n = [...selectedItems]; n[idx] = null; setSelectedItems(n); }}
                      className={`aspect-square rounded-[2rem] border-4 border-dashed flex items-center justify-center cursor-pointer transition-all ${itemId ? 'border-transparent shadow-2xl scale-105' : 'border-gray-100 hover:border-[#5383e8] hover:bg-[#5383e8]/5'}`}>
                      {itemId ? <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`} className="rounded-2xl w-full h-full object-cover" alt="item" /> : <span className="text-gray-100 font-black text-5xl">+</span>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-gray-300">
                <label className="text-xs font-black text-gray-400 mb-6 block uppercase tracking-[0.3em]">Theory & Analysis</label>
                <textarea 
                  placeholder="このビルドがなぜ「刺さる」のか、具体的な立ち回りを含めて徹底解説してください..."
                  className="w-full bg-gray-50 border-4 border-transparent p-10 rounded-[2.5rem] outline-none h-80 resize-none font-bold text-xl transition-all focus:border-[#5383e8] focus:bg-white shadow-inner leading-relaxed"
                  value={buildDescription} onChange={(e) => setBuildDescription(e.target.value)}
                />
              </section>

              <div className="flex gap-8">
                <button onClick={() => navigate('detail')} className="flex-1 py-8 bg-gray-100 hover:bg-gray-200 rounded-3xl font-black text-gray-400 transition-all uppercase tracking-[0.2em] shadow-lg">Abort</button>
                <button onClick={handlePublish} disabled={!buildTitle || !user}
                  className={`flex-[2] py-8 rounded-3xl font-black text-white shadow-2xl transition-all uppercase tracking-[0.2em] ${buildTitle && user ? 'bg-[#5383e8] hover:bg-[#4171d6] active:scale-95 shadow-[#5383e8]/40' : 'bg-gray-200 cursor-not-allowed'}`}>
                  Push Report
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[3.5rem] border-2 border-gray-300 flex flex-col h-[1150px] shadow-2xl overflow-hidden sticky top-24">
              <div className="p-10 border-b-2 border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 mb-6 uppercase tracking-[0.3em]">Component Database</h4>
                <input 
                  type="text" placeholder="アイテムを検索..."
                  className="w-full bg-gray-50 border-4 border-transparent h-16 px-8 rounded-2xl outline-none font-black text-lg focus:border-[#5383e8] focus:bg-white transition-all shadow-inner"
                  value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-12 grid grid-cols-4 sm:grid-cols-5 gap-8 content-start custom-scrollbar bg-[#fafafa]">
                {filteredItems.map(item => (
                  <img key={item.id} src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${item.id}.png`} onClick={() => {
                    const n = [...selectedItems]; const i = n.indexOf(null);
                    if (i !== -1) { n[i] = item.id; setSelectedItems(n); }
                  }} className="rounded-2xl border-4 border-white hover:border-[#5383e8] hover:scale-125 transition-all cursor-pointer shadow-xl bg-white aspect-square object-cover" title={item.name} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-[#0c0d0f] z-[100] flex flex-col items-center justify-center">
          <div className="w-24 h-24 border-8 border-[#5383e8] border-t-transparent rounded-full animate-spin shadow-[0_0_80px_rgba(83,131,232,0.6)]"></div>
          <p className="mt-12 text-white font-black text-3xl tracking-[0.8em] animate-pulse uppercase italic">Booting Labs</p>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ced4da; border-radius: 20px; border: 4px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #5383e8; background-clip: content-box; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 1s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}