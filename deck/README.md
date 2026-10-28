# Презентация ЮБ800

Актуальная бизнес-презентация «Сборная ЮБ800» для встречи с Юрием Борзаковским.

## Файлы

- `Sbornaya-deck.html` — 19 слайдов 16:9.
- `Sbornaya-deck.pdf` — PDF для показа и печати, 19 страниц.

## Формат

- Только текст и цифры, без фотографий и декоративных карточек.
- Один тезис и 2–5 цифр на слайд.
- Детали бизнес-модели остаются в устном комментарии.

## Экономика

- Этап: 15 900 ₽, 8 тренировок, 10–15 человек.
- Тренер 5 000 ₽ + помощник 2 000 ₽ за тренировку.
- 10 человек — вклад 43 690 ₽ за этап.
- 50 человек — 2,20 млн ₽ прибыли в год по плану.
- Telegram, партнёры и сборы — дополнительные потоки, не в базовом P&L.

## Пересобрать PDF

```bash
cd deck
NODE_PATH="$HOME/.config/opencode/ux-kit/node_modules" node - <<'JS'
const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('file://' + process.cwd() + '/Sbornaya-deck.html');
  await page.evaluate(()=>document.fonts.ready);
  await page.pdf({path:'Sbornaya-deck.pdf', width:'1280px', height:'720px', printBackground:true, margin:{top:'0',right:'0',bottom:'0',left:'0'}, preferCSSPageSize:true});
  await browser.close();
})();
JS
```
