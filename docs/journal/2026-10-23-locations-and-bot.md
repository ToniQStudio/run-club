# 23 октября 2026 — локации Москвы и переименование бота

## Что изменилось

- Убрана привязка к Лужникам из актуальных документов, лендинга, дека и скриптов. Клуб работает в разных локациях Москвы: парки, набережные, стадионы и залы.
- Заголовок события 21 ноября: «21 ноября. Москва» вместо «21 ноября. Лужники».
- Фоновое фото блока 21 ноября переименовано: `landing/assets/luzhniki-event.*` → `open-run-event.*`. CSS и документация обновлены.
- В `00_brief.md`, `06_launch.md`, `08_partners.md`, `README.md`, `PROJECT_STATE.md`, `AGENTS.md`, `landing/copy.md`, `landing/index.html`, `landing/README.md`, `bot/src/scenario.js`, `deck/index.html`, `deck/onepager.html`, `deck/README.md`, `brand/og-strict.html` и скриптах `10_research/` заменены упоминания Лужников на Москву и разные локации.
- `DECISIONS.md`: добавлены решения о локациях, имени бота `run800` и плане смены username; исторические записи не переписаны.
- Статус репозитория и предпросмотра синхронизирован с фактом: репозиторий публичный, GitHub Pages — предпросмотр, `run800.ru` не подключён.

## Бот

- Старый бот `@YB800_bot` удалён. Новый бот: имя `run800`, username `@run800_bot`, id `8923990959`.
- Новый токен проверен через `getMe` (`ok: true`) и сохранён в `/opt/yb800-bot/.env` на VPS; сервис `yb800-bot` перезапущен и активен.
- Ссылки в `landing/index.html` (3), `landing/copy.md`, `landing/README.md`, `landing/TELEGRAM_SETUP.md`, `PROJECT_STATE.md`, `AGENTS.md`, `bot/README.md` переведены на `@run800_bot`.
- QR `landing/assets/telegram-qr.svg` пересобран под `https://t.me/run800_bot?start=site`.
- В BotFather нельзя изменить username существующего бота, поэтому переезд сделан через нового бота. Старый `@YB800_bot` удалён.

## Проверено

- Тексты и ссылки: `grep` по `Лужник`, `luzhniki` — остались только исторические записи в `DECISIONS.md`, `docs/journal/` и архиве бренда.
- `landing/styles.css` ссылается на `open-run-event.jpg` / `.webp`; старые файлы удалены.
- `node --check bot/src/scenario.js` — без ошибок.
- `node --test bot/test/scenario.test.js` — 9/9.
- `getMe` нового токена: `ok: true`, username `run800_bot`, имя `run800`, id `8923990959`.
- Сервис `yb800-bot` на VPS активен после перезапуска.
- Все актуальные ссылки и QR на сайте ведут на `@run800_bot`.

## Не проверено / осталось

- `/start` и тестовая заявка в новом боте end-to-end ещё не прогнаны через Telegram.
- В BotFather не заполнены About, Description, Botpic и Privacy Policy — тексты готовы в `bot/README.md`.
- Физическое сканирование нового QR с телефона не проверялось.
- PDF дека и one-pager пересобраны 23.10 после замены локации. Экономика в них ещё старая (9 900 / 17 500 / 1 900 / 99 000 ₽, роялти 7%) — обновить отдельно.
- `landing/assets/og.png` перерисован из `brand/og-strict.html`.
- Фон `open-run-event` — прежний кадр; заменить на нейтральный после съёмки.
- Цены в боте приведены к модели 2 500 / 12 000 / 40 000 ₽; обновлённый код задеплоен на VPS, сервис перезапущен. About и Description заполнены через Bot API, Commands — 4 команды; в BotFather осталось заполнить Botpic и Privacy Policy.
