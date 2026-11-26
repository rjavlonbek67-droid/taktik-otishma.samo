import { useEffect, useRef, useState } from 'react'
import { COURSES } from './courses.js'

const POST = {
  id: '1000-dread',
  index: '01',
  tag: '1000–3000',
  title: '1000 — bu tugash emas',
  excerpt: 'Arvoh, qarz, qora quti va ko‘z. 1000 dan keyin hisob 2000 va 3000 ga boradi. Tezlik esa sekinlashadi.',
}

export default function Blog({ onClose }) {
  const [openId, setOpenId] = useState(null)
  const [selectedId, setSelectedId] = useState(COURSES[0]?.id || null)
  const scroller = useRef(null)
  const stamp = useRef(0)
  const course = COURSES.find((item) => item.id === openId) || null
  const back = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (openId) setOpenId(null)
    else onClose()
  }
  const openLesson = (event, id) => {
    event.preventDefault()
    event.stopPropagation()
    const lessonId = id || event.currentTarget?.getAttribute?.('data-lesson') || selectedId
    const known = lessonId === 'archive' || COURSES.some((item) => item.id === lessonId)
    if (!known) return
    const now = performance.now()
    if (now - stamp.current < 350) return
    stamp.current = now
    setSelectedId(lessonId)
    setOpenId(lessonId)
  }

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [openId])

  return (
    <div className="blog" ref={scroller}>
      <header className="blog-bar">
        <button className="blog-back" type="button" onClick={back}>
          {openId ? 'RO‘YXAT' : 'YOPISH'}
        </button>
        <span>SBP // YOZUVLAR</span>
      </header>

      {!openId && (
        <section className="blog-list">
          <p className="blog-kicker">KONTUR ARXIV</p>
          <h1>Yozuvlar</h1>
          <button className="blog-card" type="button" data-lesson="archive" onClick={(event) => openLesson(event, 'archive')}>
            <small>{POST.index} · {POST.tag}</small>
            <strong>{POST.title}</strong>
            <em>{POST.excerpt}</em>
          </button>

          <p className="blog-kicker blog-kicker-next">KURS</p>
          <h2 className="blog-sub">Modullar</h2>
          {COURSES.map((item) => (
            <article
              key={item.id}
              className={`blog-card${selectedId === item.id ? ' is-on' : ''}`}
            >
              <small>{item.index} · {item.tag}</small>
              <strong>{item.title}</strong>
              <em>{item.excerpt}</em>
              <button
                className="course-start"
                type="button"
                data-lesson={item.id}
                onClick={(event) => openLesson(event, item.id)}
              >
                BOSHLASH
              </button>
            </article>
          ))}
        </section>
      )}

      {openId === 'archive' && (
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
            <p className="blog-code">&gt; CHEGARA · LA'NAT</p>
            <h2>1000+ mukofot va la’nat</h2>
            <p>
              Chiziqni kesgan lahzada tunnel sovg‘a bermaydi. U bitim qiladi.
              Ball shu yerdan tezroq yoziladi, xavfli darvoza va yaqin o‘tish
              qo‘shimcha iz qoldiradi. Bu mukofot. La’nat shu bitimning ikkinchi yarmi:
              chetlar qorayadi, yolg‘on signal tezroq qaytadi, kuzatuvchi jim turmaydi,
              xato og‘irroq uriladi.
            </p>
            <p>
              1000 dan o‘tib yiqilsang, oddiy chaqmoq va menyu emas. Dahshat yakuni ochiladi.
              Yozuv o‘zgaradi: chegarani buzding, lekin oxiri yo‘q. Ekranda yakuniy ball
              va mingdan qancha uzoqlagani turadi. Qayta bosish o‘qiladi. O‘yin to‘xtamaydi —
              sen to‘xtagansan.
            </p>
          </section>

          <section>
            <p className="blog-code">&gt; MASSHTAB · 3000</p>
            <h2>1000 dan 2000 ga, 2000 dan 3000 ga</h2>
            <p>
              Hisob 1000 da birinchi bosqichga qaytmaydi va nolga tushmaydi.
              1500, 2000, 2500, 3000 — shu raqamlar yangi xarita emas, shu yugurishning
              davomi. Har besh yuzda yengil belgi yonadi. Devor qo‘yilmaydi.
              O‘yin pauzaga tushmaydi. Raqam shunchaki oldinga yozilaveradi.
            </p>
            <p>
              1000 gacha tezlik va bosim avvalgidek tiklanadi. Undan keyin o‘sish
              yumshoq egri chiziqqa o‘tadi: qo‘shimcha tezlik shiftga yaqinlashadi va
              to‘xtaydi, darvozalar biroz nafas oladi, ovoz xom ball bilan birga
              qichqirmaydi. Surge va qarzning o‘z zarbasi qoladi. Tunnel esa
              2000 yoki 3000 da birdan adolatsiz xiralikka aylanmaydi.
              Tajribali qo‘l shu raqamlarga yetishi mumkin. Sabrsiz qo‘l emas.
            </p>
          </section>

          <section>
            <p className="blog-code">&gt; QATLAMLAR · v3.0–v3.7</p>
            <h2>Bitta tajriba, yetti qatlam</h2>
            <p>
              Logo endi yozuv emas. Kontur-Montur chizmasi: o‘qlar, kesilgan S, B, P,
              markazda geometrik ko‘z. U chizilib chiqadi, kutishda nafas oladi,
              500, 1000, Surge va glitchda qisqa zarba beradi. Menyu va yakuniy ekranda
              yorug‘lik, zarracha va gorizontal sinish shu belgi atrofida turadi.
              Ovoz fayli yo‘q. Web Audio impulslari chizilishga, ko‘zning torayishiga
              va zarbaga yopishadi. Ovoz o‘chiq bo‘lsa, hammasi jim o‘tadi.
            </p>
            <p>
              Bu qatlamlar to‘rtta eski mexanikani almashtirmaydi. Arvoh hali ham
              sening eski harakating. Vaqt qarzi hali ham foiz bilan qaytadi.
              Qora quti hali ham bir marta yolg‘on gapirishi mumkin. Kuzatuvchi
              hali ham seni o‘qiydi. Logodagi ko‘z — o‘sha qarash, chizma nuqtasiga
              tushirilgan. 1000 dan keyingi la’nat va 3000 gacha sekinlashgan masshtab
              esa shu yugurishning ichida. Yangi o‘yin emas. Chuqurroq tunnel.
            </p>
          </section>

          <aside className="blog-warn">
            <span>KONTUR</span>
            <span>OGOHLANTIRISH</span>
            <p>1000 — eshik. 2000 ga yet. Yoki 3000 ga.</p>
            <p>Sen necha ballgacha chidaysan?</p>
          </aside>
        </article>
      )}

      {course && (
        <article className="blog-post is-lesson">
          <p className="blog-kicker">DARS {course.index} · {course.tag}</p>
          <h1>{course.title}</h1>
          <p className="blog-lead">{course.lead}</p>
          {course.sections.map((section) => (
            <section key={section.title}>
              <p className="blog-code">{section.code}</p>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <section>
            <p className="blog-code">&gt; AMALIYOT</p>
            <h2>Vazifalar</h2>
            {course.tasks.map((task) => (
              <div className="blog-task" key={task.title}>
                <strong>{task.title}</strong>
                <p>{task.body}</p>
              </div>
            ))}
          </section>
          <aside className="blog-warn">
            <span>KURS</span>
            <span>{course.index}</span>
            {course.warn.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </aside>
        </article>
      )}
    </div>
  )
}
