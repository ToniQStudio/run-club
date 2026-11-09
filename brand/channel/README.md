# Графика канала и ботов

Готовые материалы для Telegram: аватары, шаблоны постов, анонс и сторис.

## Готовые файлы

| Файл | Размер | Для чего |
|---|---|---|
| `avatar-channel-512.png` | 512×512 | аватар канала — чёрный знак «ЮБ800» на лайме (прежний) |
| `avatar-channel-run-512.png` | 512×512 | аватар медиа-канала «RUN - О беге» — «RUN» чёрным на лайме |
| `avatar-bot-512.png` | 512×512 | аватар `@run800_bot` — чёрные «800» на лайме |
| `post-quote-1080x1350.png` | 1080×1350 | карточка-цитата |
| `post-fact-1080x1350.png` | 1080×1350 | карточка-факт |
| `announce-1280x720.png` | 1280×720 | горизонтальный анонс (превью ссылки, репост) |
| `story-1080x1920.png` | 1080×1920 | сторис про открытую тренировку |

## Шаблоны

- `templates/cards.html` — цитата, факт, анонс, сторис. Все размеры заданы в CSS.
- `templates/avatars.html` — аватары.
- `templates/photo-card.html` — карточка с фотографией 4:5.
- `templates/eight.svg` — цифры «800» из логотипа, только лайм.

### Пересобрать PNG

```bash
cd brand
NODE_PATH="$HOME/.config/opencode/ux-kit/node_modules" node - <<'JS'
const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1400,height:2100} });
  await p.goto('file://' + process.cwd() + '/channel/templates/cards.html');
  await p.evaluate(()=>document.fonts.ready);
  await p.waitForTimeout(400);
  await p.locator('#quote').screenshot({path:'channel/post-quote-1080x1350.png'});
  await p.locator('#fact').screenshot({path:'channel/post-fact-1080x1350.png'});
  await p.locator('#announce').screenshot({path:'channel/announce-1280x720.png'});
  await p.locator('#story').screenshot({path:'channel/story-1080x1920.png'});
  await b.close();
})();
JS
```

## Правила

- Палитра: графит `#030712`, лайм `#CCFF00`, бумага `#F9FAFB`, дорожка `#1E5AA8`.
- Шрифт Jost, локальный файл `landing/assets/fonts/jost.woff2`.
- Только текст и цифры. Одна мысль на карточку.
- Логотип — нижний левый угол, сайт — нижний правый.
- Аватар обрезается в круг: важное держим в центральных 80%. Текущие аватары проверены — тёмные пиксели не выходят за радиус 248 из 256.

## Чего не хватает

- Фотографии тренировок и портреты — без них карточки только текстовые.
- Точное время и место открытой тренировки 19 декабря.
- Подтверждение состава этапа и цены для карточек.
- Референсы подачи (2–3 канала).
