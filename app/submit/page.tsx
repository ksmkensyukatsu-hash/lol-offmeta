import Link from "next/link";

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <Link href="/" className="text-green-500 hover:text-green-400 font-medium mb-4 inline-block">
            ← トップページに戻る
          </Link>
          <h1 className="text-3xl font-bold text-white">新しいオフメタビルドを投稿</h1>
        </header>

        <form className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg space-y-6">
          
          {/* チャンピオン名入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">チャンピオン名</label>
            <input 
              type="text" 
              placeholder="例: マルファイト"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          {/* ロール選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">ロール</label>
            <select className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500 transition-colors appearance-none">
              <option value="">選択してください</option>
              <option value="Top">Top</option>
              <option value="Jungle">Jungle</option>
              <option value="Mid">Mid</option>
              <option value="ADC">ADC</option>
              <option value="Support">Support</option>
            </select>
          </div>

          {/* ビルドの解説 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">ビルドの解説・立ち回り</label>
            <textarea 
              rows={4}
              placeholder="どんなルーン？どんなアイテム？どうやって勝つ？"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
            ></textarea>
          </div>

          {/* 投稿者名 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">サモナーネーム（または匿名）</label>
            <input 
              type="text" 
              placeholder="例: 名無しブロンズ"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          {/* 送信ボタン */}
          <button 
            type="button"
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors mt-4"
          >
            投稿する（現在はデザインのみ）
          </button>
        </form>
      </div>
    </main>
  );
}