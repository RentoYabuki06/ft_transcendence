import { Link } from 'react-router-dom';

export function TermsPage() {
  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-16">
        <Link to="/dashboard" className="text-cosmic-cyan/50 hover:text-cosmic-cyan text-sm transition-colors mb-8 inline-block">
          戻る
        </Link>

        <h1 className="font-display text-3xl font-bold text-star-white mb-8 tracking-wide">
          利用規約
        </h1>

        <div className="cosmic-card prose prose-invert max-w-none space-y-6 text-star-white/70 text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第1条（適用）</h2>
            <p>本利用規約（以下「本規約」）は、ft_transcendence Pong（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆さまには、本規約に従って本サービスをご利用いただきます。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第2条（利用登録）</h2>
            <p>登録希望者が本規約に同意の上、所定の方法によって利用登録を申請し、本サービスがこれを承認することによって利用登録が完了するものとします。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第3条（ユーザーIDおよびパスワードの管理）</h2>
            <p>ユーザーは、自己の責任において、本サービスのユーザーIDおよびパスワードを適切に管理するものとします。ユーザーは、いかなる場合にも、ユーザーIDおよびパスワードを第三者に譲渡または貸与し、もしくは第三者と共用することはできません。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第4条（禁止事項）</h2>
            <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
            <ul className="list-disc list-inside space-y-1 pl-4 text-star-white/60">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>本サービスの内容等、本サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為</li>
              <li>本サービスのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
              <li>不正アクセスをし、またはこれを試みる行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>不正な目的を持って本サービスを利用する行為</li>
              <li>本サービスの他のユーザーまたはその他の第三者に不利益、損害、不快感を与える行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>本サービスのサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第5条（本サービスの提供の停止等）</h2>
            <p>本サービスは、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第6条（利用制限および登録抹消）</h2>
            <p>本サービスは、ユーザーが本規約のいずれかの条項に違反した場合、事前の通知なく、ユーザーに対して本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を抹消することができるものとします。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第7条（免責事項）</h2>
            <p>本サービスは、本サービスに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しておりません。本サービスに起因してユーザーに生じたあらゆる損害について一切の責任を負いません。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第8条（サービス内容の変更等）</h2>
            <p>本サービスは、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第9条（利用規約の変更）</h2>
            <p>本サービスは、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-star-white mb-3">第10条（準拠法・裁判管轄）</h2>
            <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、本サービス所在地を管轄する裁判所を専属的合意管轄とします。</p>
          </section>

          <p className="text-star-white/30 text-xs mt-8">最終更新日: 2025年6月1日</p>
        </div>
      </div>
    </div>
  );
}
