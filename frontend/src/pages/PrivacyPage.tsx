import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-16">
        <Link to="/dashboard" className="text-cosmic-cyan/50 hover:text-cosmic-cyan text-sm transition-colors mb-8 inline-block">
          戻る
        </Link>

        <h1 className="font-display text-3xl font-bold text-star-white mb-8 tracking-wide">
          プライバシーポリシー
        </h1>

        <div className="cosmic-card prose prose-invert max-w-none space-y-6 text-star-white/70 text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-lg text-star-white mb-3">1. はじめに</h2>
            <p>ft_transcendence Pong（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。本プライバシーポリシーは、本サービスが収集する情報とその利用方法について説明します。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">2. 収集する情報</h2>
            <p>本サービスは、以下の情報を収集する場合があります：</p>
            <ul className="list-disc list-inside space-y-1 pl-4 text-star-white/60">
              <li>アカウント情報（ニックネーム、メールアドレス）</li>
              <li>認証情報（パスワードのハッシュ値、OAuth認証トークン）</li>
              <li>プロフィール情報（アバター画像）</li>
              <li>ゲームデータ（対戦履歴、スコア、ランキング情報）</li>
              <li>利用状況データ（ログイン日時、オンラインステータス）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">3. 情報の利用目的</h2>
            <p>収集した情報は、以下の目的で利用します：</p>
            <ul className="list-disc list-inside space-y-1 pl-4 text-star-white/60">
              <li>ユーザー認証およびアカウント管理</li>
              <li>ゲームサービスの提供（マッチメイキング、ランキング表示）</li>
              <li>サービスの改善および新機能の開発</li>
              <li>ユーザーサポートの提供</li>
              <li>セキュリティの確保および不正利用の防止</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">4. 情報の共有</h2>
            <p>本サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません：</p>
            <ul className="list-disc list-inside space-y-1 pl-4 text-star-white/60">
              <li>ユーザーの同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要がある場合</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">5. データの保管</h2>
            <p>ユーザーの個人情報は、適切なセキュリティ対策を講じた上で保管します。パスワードはハッシュ化して保存し、通信は暗号化（HTTPS）を使用します。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">6. ユーザーの権利</h2>
            <p>ユーザーは、以下の権利を有します：</p>
            <ul className="list-disc list-inside space-y-1 pl-4 text-star-white/60">
              <li>自己の個人情報の開示を求める権利</li>
              <li>個人情報の訂正・削除を求める権利</li>
              <li>個人情報の利用停止を求める権利</li>
              <li>アカウントの削除を求める権利</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">7. Cookieの使用</h2>
            <p>本サービスは、ユーザー体験の向上のためにCookieおよびセッションストレージを使用する場合があります。これらは認証状態の維持に利用されます。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">8. 子どものプライバシー</h2>
            <p>本サービスは、13歳未満の子どもから意図的に個人情報を収集することはありません。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">9. プライバシーポリシーの変更</h2>
            <p>本サービスは、必要に応じて本プライバシーポリシーを変更することがあります。変更後のプライバシーポリシーは、本ページにて公開された時点から効力を生じるものとします。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">10. お問い合わせ</h2>
            <p>本プライバシーポリシーに関するお問い合わせは、本サービスの管理者までご連絡ください。</p>
          </section>

          <p className="text-star-white/30 text-xs mt-8">最終更新日: 2025年6月1日</p>
        </div>
      </div>
    </div>
  );
}
