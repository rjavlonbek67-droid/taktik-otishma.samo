import { useState } from 'react'

const POST = {
  id: '1000-dread',
  index: '01',
  tag: '1000+',
  title: '1000 — bu tugash emas',
  excerpt: 'Arvohing, vaqt qarzi, qora quti va devordagi ko‘z. Chegara ochiladi. Oxiri yo‘q.',
}

export default function Blog({ onClose }) {
  const [open, setOpen] = useState(false)
  const back = (event) => {
    event.stopPropagation()
    if (open) setOpen(false)
    else onClose()
  }
  const read = (event) => {
    event.stopPropagation()
    setOpen(true)
  }

  return (
    <div className="blog">
      <header className="blog-bar">
        <button className="blog-back" type="button" onPointerDown={back}>
          {open ? 'RO‘YXAT' : 'YOPISH'}
        </button>
        <span>SBP // YOZUVLAR</span>
      </header>

      {!open && (
        <section className="blog-list">
          <p className="blog-kicker">KONTUR ARXIV</p>
          <h1>Yozuvlar</h1>
          <button className="blog-card" type="button" onPointerDown={read}>
            <small>{POST.index} · {POST.tag}</small>
            <strong>{POST.title}</strong>
            <em>{POST.excerpt}</em>
          </button>
        </section>
      )}

      {open && (
        <article className="blog-post">
          <p className="blog-kicker">YOZUV {POST.index} · {POST.tag}</p>
          <h1>{POST.title}</h1>
          <p className="blog-lead">
            Bu endi yugurish emas. Tasodifiy to‘siqdan qochish ham emas.
            1000 — chiziq. Undan o‘tish uchun o‘z eski harakating bilan musobaqalashasan,
            vaqtdan qarz olasan va o‘sha qarzni foizi bilan qaytarasan,
            yashirin o‘lchamni ochasan. Chegara buziladi. Sen qolasan.
          </p>

          <section>
            <p className="blog-code">&gt; SIGNAL 01 · ARVOH</p>
            <h2>O‘zingning arvohing</h2>
            <p>
              Oldingi urinish o‘chmaydi. U tunnel devorida kontur soyadek qaytadi:
              sen turgan joyda emas, sen qilgan harakatda. Arvoh sening ritmingni eslaydi.
              Undan o‘tib ketsang, iz sinxronlanadi va qisqa kuch beradi — xuddi o‘tgan
              xatong shu safar senga ishlagandek.
            </p>
            <p>
              Ortda qolsang, bosim o‘zgaradi. Arvoh oldinda turadi. Ekran jim emas:
              sen kecha o‘zingni yutqaza olmaganingni ko‘rib turasan. Bu dushman emas.
              Bu sen. Va u seni kutmaydi.
            </p>
          </section>

          <section>
            <p className="blog-code">&gt; SIGNAL 02 · QARZ</p>
            <h2>Vaqt qarzi</h2>
            <p>
              Xavfli lahzada vaqtni ushlab qolish mumkin. Tunnel sekinlashadi,
              devor yaqinlashishi to‘xtagandek bo‘ladi, nafas ochiladi. Bu yordam emas.
              Bu qarz.
            </p>
            <p>
              Bir necha soniyadan keyin qarz qaytadi. Tezlik foizi bilan oshadi,
              boshqaruv og‘irlashadi, ritm seni oldinga itaradi. To‘g‘ri o‘tsang, qarz
              yopiladi va ball keladi. Adashsang, zarba oddiy to‘qnashuvdan og‘irroq
              seziladi. Vaqtni sotib olgansan. Narxini tunnel yozib qo‘yadi.
            </p>
          </section>

          <section>
            <p className="blog-code">&gt; SIGNAL 03 · QORA QUTI</p>
            <h2>Yashirin signal / qora quti</h2>
            <p>
              Eng qaltis nuqtalarda shifr bo‘lagi yotadi. U baland ovozda chaqirmaydi.
              Kontur chiziq titraydi, signal yolg‘on ko‘rinishi mumkin, qora quti esa
              jim qoladi. Bo‘lakni olish uchun xavf ichidan o‘tish kerak. Chetlab o‘tish
              osonroq. Lekin arxiv ochilmaydi.
            </p>
            <p>
              Bo‘laklar yig‘ilganda maxfiy muhit ochiladi: tunnelning ko‘rinmagan qatlami,
              oddiy yugurishda yo‘q qoida. Bu mukofot emas, ruxsat. Ko‘rganingdan keyin
              eski yo‘l torayadi. Signal bir marta yolg‘on bo‘lishi mumkin. Qora quti yolg‘on gapirmaydi.
            </p>
          </section>

          <section>
            <p className="blog-code">&gt; SIGNAL 04 · KO‘Z</p>
            <h2>Kuzatuvchi bilan ko‘z urushtirish</h2>
            <p>
              Devorda siluet bor. U to‘siq emas. U qaramaydi — toki sen tikilmaguningcha,
              toki sonar unga tegmaguncha. O‘sha lahza u uyg‘onadi. Kontur jonlanadi.
              Kuzatuvchi keyingi burilishingni taxmin qilishga urinadi.
            </p>
            <p>
              Ko‘z urushtirish jasoratdek tuyuladi. Aslida bu ma’lumot almashinuvi.
              Sen uni ko‘rding. U seni o‘qidi. Sonar yuborilsa, u jimlikdan chiqadi va
              yo‘lni oldindan ushlashga harakat qiladi. Qarama. Yoki qara va oqibatini yut.
            </p>
          </section>

          <section>
            <p className="blog-code">&gt; CHEGARA · 1000+</p>
            <h2>Mingdan keyin</h2>
            <p>
              1000 ga yetish tugash emas. Ekran larzaga tushadi, chetlar qorayadi,
              yolg‘on signal tez-tez yonadi. Mukofot bor: ball tezroq yig‘iladi.
              La’nat ham bor: har bir xato og‘irroq, har bir jimlik qisqaroq.
              Yiqilsang, oddiy menyu emas — dahshat yakuni ochiladi.
              Yozuv shu yerda to‘xtamaydi. Oxiri yo‘q.
            </p>
          </section>

          <aside className="blog-warn">
            <span>KONTUR</span>
            <span>OGOHLANTIRISH</span>
            <p>Sen necha ballgacha chidaysan?</p>
          </aside>
        </article>
      )}
    </div>
  )
}
