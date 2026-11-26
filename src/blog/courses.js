export const COURSES = [
  {
    id: 'scale-3000',
    index: 'K01',
    tag: 'MUVOZANAT',
    title: '1000 dan keyin yumshoq shift',
    excerpt: 'Hisob 2000 va 3000 ga boradi. Qo‘shimcha bosim esa cheksiz emas — egri chiziq bo‘ylab sekinlashadi.',
    lead: 'Yaxshi endless o‘yin raqamni ham, o‘yinchini ham o‘ldirmaydi. SBP da 1000 — eshik. Hisob shu yerdan 2000, 3000 va undan nariga yozilaveradi. Bosim esa har yuz ballda bir xil qadam tashlamaydi.',
    sections: [
      {
        code: '> HISOB · UZLUKSIZ',
        title: '1-bosqichga qaytmaslik',
        paragraphs: [
          '1000 da ball noldan yozilmaydi va tunnel birinchi bosqichga qaytmaydi. 1500, 2000, 2500, 3000 — har besh yuzda yengil belgi yonadi. Pauza yo‘q. Yangi to‘siq turi qo‘yilmaydi. O‘yinchi o‘zi yig‘gan la’nat, kuzatuvchi va tezlik shiftining ichida qoladi.',
          'Qaytarish oson ko‘rinadi: “yana 1-bosqich, yangi xarita”. Aslida bu yutqazish. La’nat, ko‘z va qora quti shu yugurishning xotirasi. Hisobni nolga tushirish o‘sha xotirani o‘chiradi. O‘yinchi chegara buzganini emas, o‘yin uni aldab yangi doiraga tiqqanini sezadi.',
        ],
      },
      {
        code: '> EGRI CHIZIQ · SOFT-CAP',
        title: 'Sekinlashuvchi qiyinchilik',
        paragraphs: [
          '1000 dan keyingi qo‘shimcha og‘irlik yumshoq shiftga yopishadi: 1 − e^(−(ball − 1000) / 2600). 1000 da qo‘shimcha 0. 2000 atrofida egri chiziq taxminan uchdan bir yo‘lni bosadi. 3000 da yarmiga yaqinlashadi. Cheksizlikda 1 ga intiladi, lekin undan oshmaydi.',
          'Shu 1 — tezlikka taxminan +6% (kadr tushsa +2.5%), darvoza oralig‘iga esa eng ko‘pi +0.75. Ovoz bosimi xom 3000 ni qichqirmaydi: u 1000 atrofida sekin sudraladi. Surge va vaqt qarzining o‘z zarbasi qoladi. Ular shiftga qisilmaydi. Adolatsiz sakrash shu yerda kesiladi, xavf esa yo‘qolmaydi.',
        ],
      },
      {
        code: '> MISOL · IKKI TUNNEL',
        title: 'Nima uchun o‘yin o‘lmaydi',
        paragraphs: [
          'Tunnel A: 1000 dan keyin har 100 ballga tezlik +1%. 3000 da bu +20%, ustiga eski la’nat. O‘yinchi mahorat bilan emas, formula adolatsizligi bilan yiqiladi. Yo‘l “o‘qib bo‘lmaydigan” bo‘lib qoladi.',
          'Tunnel B: 1000 da hisob 0, bosqich 1. Ekranda yangi o‘yin ochilgandek. Ichkarida esa la’nat va kuzatuvchi “tugadi”. O‘yinchi yutug‘ini yo‘qotadi.',
          'SBP ikkalasini ham qilmaydi. Yo‘l davom etadi. Qo‘shimcha og‘irlik shiftga yopishib sekinlaydi. Tajribali qo‘l 2000 va 3000 ni o‘qiy oladi. Sabrsiz qo‘l hali ham xato qiladi — lekin formula uni aldamaydi.',
        ],
      },
    ],
    tasks: [
      {
        title: 'Vazifa 1 · Egri chiziq',
        body: 'Qog‘ozda 2000 va 3000 uchun 1 − e^(−(ball − 1000) / 2600) ni hisobla. Qaysi minglikda o‘sish kattaroq? Javobni bir jumlada yoz.',
      },
      {
        title: 'Vazifa 2 · Nima o‘chadi',
        body: '“1000 da 1-bosqichga qaytaramiz” degan qaror o‘yinchining qaysi uchta narsasini o‘chiradi? La’nat, kuzatuvchi va yig‘ilgan balldan boshqa javob ham bo‘lishi mumkin — o‘zing tanla va asosla.',
      },
      {
        title: 'Vazifa 3 · Kod izi',
        body: 'src/game/scale.js ichida gap va ceil qayerda ease ga bog‘langanini top. Surge nima uchun shu shiftga qisilmasligi kerak? Ikki jumla.',
      },
    ],
    warn: ['1000 — eshik.', '2000 va 3000 — shu yo‘lning davomi, yangi o‘yin emas.'],
  },
  {
    id: 'silence-trial',
    index: 'K02',
    tag: 'MURAKKABLIK',
    title: 'Soxta signal va Sukunat Sinovi',
    excerpt: '750 dan keyin yolg‘on ishora va yaqin o‘tish. 1000, 2000, 3000 da 15 soniya raqamsiz sinov.',
    lead: 'Murakkablik yangi dushman qo‘shish emas. O‘yinchi o‘qigan ishorani shubha ostiga qo‘yish. SBP buni uchta qatlamda qiladi: soxta signal, yaqin o‘tish, takroriy odat. So‘ng uchta eshikda raqamlarni o‘chiradi.',
    sections: [
      {
        code: '> 750+ · CHALG‘ITISH',
        title: 'Soxta signal',
        paragraphs: [
          '750 dan keyin ba’zan HUD yolg‘on yo‘nalish yozadi. Uzoqroq devor salqin ko‘k kontur oladi. Haqiqiy eng yaqin to‘siq oltin chaqnaydi. Avval xira tovush, taxminan 0.16 s dan keyin aniqroq tovush. Ko‘z raqamga emas, yaqin konturga ishonishi kerak.',
          'Soxta devor to‘rtta devorni ham yopmaydi. Kamida bitta yo‘l ochiq qoladi. Chalg‘itish — o‘qish sinovi. Berkitilgan labirint emas.',
        ],
      },
      {
        code: '> XAVF · MUKOFOT',
        title: 'Yaqin o‘tish va odat',
        paragraphs: [
          'Juda yaqin o‘tish 750 dan keyin oddiy ball ustiga kichik bonus qo‘shadi. Xavfni o‘qiganning mukofoti bor. Xato qilsang, shu balldan keyin zarba, qaytish va kamera zarbasi o‘tkirroq. Mukofot va jazo bir eshikdan chiqadi.',
          'Odat kuzatiladi. Bir tomonga ketma-ket burilsang yoki urishlaring bir xil ritmda kelsa, keyingi darvoza shu odatga bir devorni yaqinlashtiradi. Yana ham ochiq devor qoladi. Bosim o‘qiladi, yo‘l yopilmaydi. Kadr tushsa, odat sekinroq qurollanadi — telefon azoblanmasin.',
        ],
      },
      {
        code: '> 1000 · 2000 · 3000',
        title: 'Sukunat Sinovi',
        paragraphs: [
          'Har bir chegara bir yugurishda birinchi marta kesilganda 15 soniyalik alohida rejim ochiladi. Vaqt deltaTime bilan kamayadi. Ball, masofa, tezlik, signal, ortga hisoblash va yordamchi raqamlar yashirinadi. O‘yin holati o‘chmaydi. O‘yinchi kontur o‘qlari, markaziy ko‘z va qisqa Web Audio impulsi bilan yuradi.',
          'Sinov boshida va oxirida qisqa chizma chizig‘i yonadi, mos impuls chaladi. 15 soniya xatosiz o‘tsa raqamlar qaytadi va bonus yoziladi. Yiqilish yoki menyuga qaytish raqamlarni darhol tiklaydi, bonus yozilmaydi. Keyingi chegara shu kadrda kesilgan bo‘lsa, u keyingi kadrda ochiladi. Ikki sinov bir-birining ustiga chiqmaydi.',
        ],
      },
      {
        code: '> QATLAMLAR',
        title: 'Arxitektura darsi',
        paragraphs: [
          'Sinov mind.js yoki scale.js ichiga yopishtirilmagan. silence.js o‘z holati va o‘z ovoz to‘shagini ushlaydi: taymer, m1/m2/m3 bayroqlari, bonus, chaqmoq. World faqat qadam tashlaydi, yiqilishda sinovni sindiradi va signalni App ga uzatadi.',
          'App is-silence klassini qo‘yadi. CSS raqamlarni visibility: hidden qiladi, joyi sakramaydi, sigil va yo‘l qoladi. Shuning uchun v3.7 shifti, v3.10 bosimi va oddiy bosish chizig‘i buzilmaydi. Sinov — alohida qatlam. Qayta yozish emas.',
        ],
      },
    ],
    tasks: [
      {
        title: 'Vazifa 1 · Nimaga ishonish',
        body: 'Soxta signal paytida o‘yinchi qaysi uchta narsani o‘qishi kerak: HUD raqami, yaqin oltin kontur, yoki uzoq ko‘k chiziq? Qaysi biri haqiqiy xavf? Bir jumla.',
      },
      {
        title: 'Vazifa 2 · Bonus tartibi',
        body: 'Sukunat davomida yiqilish bonus bermasligi uchun breakSilence stepSilence dan oldin turishi kerakmi yoki keyin? Nima uchun? Ikki jumla.',
      },
      {
        title: 'Vazifa 3 · 15 soniya',
        body: '15 soniyani “900 kadr” deb emas, dt yig‘indisi bilan sanash nima uchun adolatli? FPS 60 dan 30 ga tushsa, kadr hisobi qanday yolg‘on beradi?',
      },
    ],
    warn: ['Raqamni o‘chir.', 'Kontur, ko‘z va ovoz qolsin.'],
  },
  {
    id: 'clean-60',
    index: 'K03',
    tag: '60 FPS',
    title: 'Toza bosish va jonli ovoz',
    excerpt: 'Oddiy tegish — bitta ingichka chiziq va qisqa tik. Og‘ir effekt faqat xavfda. Kadr ichida yangi obyekt yo‘q.',
    lead: 'Ekran o‘yinchi ko‘zi uchun yo‘l xaritasi. Har bosishda uchqun, halqa va tunnel bo‘ylab chaqmoq bo‘lsa, keyingi devor yo‘qoladi. Shu chaqmoqlar yana kadrni ham yeydi.',
    sections: [
      {
        code: '> v3.8 · KO‘Z',
        title: 'Nima uchun chiziq kam',
        paragraphs: [
          'Oddiy burilish, ushlab turish va impuls: bitta kichik halqa, taxminan 0.18 s da so‘nadi. Uchqun yo‘q. Tunnel chizig‘i yonmaydi. O‘q belgisi taxminan 0.16 s. Keng chiziq, shar va uchqun faqat qarz cho‘qqisi, Surge, tub, yaqin o‘tish, la’nat va glitchda.',
          'Sabab ikkita. Ko‘z yo‘lni o‘qiydi, bayramni emas. GPU esa har kadr yangi geometriya chizmaydi. Toza reaksiya tez o‘qiladi: “bosish qabul qilindi”. Shovqin esa keyingi devorni yashiradi va 60 FPS ni tushiradi.',
        ],
      },
      {
        code: '> v3.9 · QULOQ',
        title: 'Qisqa tik, og‘ir ovoz alohida',
        paragraphs: [
          'Oddiy tegish — triangle, taxminan 48 ms, 640 dan 360 Hz ga, bandpass, past cho‘qqi, 60 ms cooldown, tomonga yengil pan. Saw, shovqin va sub yo‘q. Og‘ir impuls qarz, Surge, yaqin o‘tish va la’natda qoladi.',
          'Kontekst yo‘q, ovoz o‘chiq yoki tab yashirin bo‘lsa — jim. fxAllowed kontekst yaratmaydi. audioBus esa yaratadi. Shuning uchun birinchi tekshiruv fxAllowed. Aks holda birinchi tashrifdagi menyu o‘zi ovoz kontekstini ochib yuboradi.',
        ],
      },
      {
        code: '> KADR · KESH',
        title: 'deltaTime, hot path, sw.js',
        paragraphs: [
          'Harakat va taymer dt ga ko‘payadi. “Bir kadr = 16 ms” deb yozilmaydi. useFrame ichida yangi obyekt, yangi massiv yoki yangi yopilma yo‘q: vektor, slot va ovoz to‘shagi qayta ishlatiladi. FPS 54 dan past tursa, qo‘shimcha effekt va sinov ovozi yumshaydi.',
          'Ovoz tugaganda oscillator to‘xtaydi va tugunlar uziladi. Aks holda eski graf o‘yin yopilganda ham yashaydi. PWA keshi sw.js mantiqini qayta yozish bilan yangilanmaydi. Versiya build.js dagi CACHE qatorida. sw.js uni import qiladi. CACHE o‘zgarsa telefon eski qobiqni tashlaydi. sw.js ga tegilmaydi.',
        ],
      },
    ],
    tasks: [
      {
        title: 'Vazifa 1 · Oddiy tegish',
        body: 'Oddiy burilishda nima bo‘lmasligi kerak? Uchta narsani yoz: sub, shovqin, tunnel bo‘ylab chaqmoq. Qaysi voqealarda ular qoladi?',
      },
      {
        title: 'Vazifa 2 · Hot path',
        body: 'useFrame ichida har kadr yangi {} yoki new Vector3() yozsang, 60 FPS da bir daqiqada taxminan 3600 ta axlat obyekt tug‘iladi. Shu obyektni qayerda bir marta yaratib, kadrda qayta ishlatasan?',
      },
      {
        title: 'Vazifa 3 · Kesh',
        body: 'Yangi qatlam telefon ekraniga chiqishi uchun qaysi qator o‘zgaradi: sw.js ichidagi fetch mantiqimi yoki build.js dagi CACHE? Nima uchun ikkinchisi yetarli?',
      },
    ],
    warn: ['Ko‘zni chalg‘itma.', 'Kadr ichida yangi obyekt yaratma.'],
  },
]
