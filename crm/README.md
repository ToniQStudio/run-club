# Заявки и CRM: Lead Intake

Единый серверный endpoint для заявок из сайта, Telegram-бота и будущего MAX-бота.

```
Сайт ─────────┐
Telegram-бот ─┼──→ POST /api/leads ──→ CRM (РФ)
MAX-бот ──────┘           │
                          ├──→ Telegram-уведомление менеджеру
                          └──→ аудит согласий
```

## Почему отдельный сервис

- Одна схема заявки для всех каналов.
- Токены CRM/Telegram не попадают в браузер.
- Сайт может быть статическим, но персональные данные принимает сервис в РФ.
- Можно заменить CRM, не переделывая сайт и ботов.

## Локальный запуск

```bash
cd crm
cp .env.example .env
npm run dev
```

Проверка:

```bash
curl http://127.0.0.1:4174/health
```

По умолчанию `CRM_PROVIDER=mock`: заявки пишутся в `crm/data/leads.ndjson`, согласия — в `crm/data/consents.ndjson`. Папка `data/` и `.env` в git не попадают.

Тест:

```bash
npm test
```

## Заявка

```http
POST /api/leads
Content-Type: application/json
```

```json
{
  "channel": "site",
  "name": "Имя",
  "format": "open",
  "contact_optional": true,
  "contact": "",
  "consent": true,
  "consent_version": "2026-10-22",
  "source": "qr_open_run",
  "page": "/join.html",
  "utm": {
    "utm_source": "qr",
    "utm_medium": "offline",
    "utm_campaign": "open-run"
  }
}
```

`format` — `open`, `trial`, `club`, `premium`, `personal` или `request`. Для `format: "open"` контакт можно не передавать; `contact_optional` сохраняется в лиде как признак. Для платных форматов нужен телефон, email, Telegram ID или MAX ID — `contact_optional: true` их не заменяет.

`contact` может быть телефоном или email. Для ботов можно передать отдельно `phone`, `email`, `telegram_id`, `telegram_username`, `max_id`.

Ответ:

```json
{ "ok": true, "id": "uuid", "provider": "mock", "providerId": "uuid" }
```

Ошибки: `400` — валидация, `413` — слишком большое тело, `429` — rate limit, `502` — CRM недоступна.

## Bitrix24 Free

1. Создать бесплатный портал Bitrix24 (РФ).
2. Настроить CRM: одна воронка, статусы, поля.
3. Создать входящий вебхук с доступом к CRM.
4. В `.env`:

```env
CRM_PROVIDER=bitrix24
BITRIX24_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/xxxxxxxx/
```

5. Перезапустить intake и отправить тестовую заявку.
6. Проверить лид в CRM.

Сервис создаёт стандартный лид: имя, телефон, email, источник, комментарий с UTM/каналом/согласием. Дубликаты на первом этапе контролирует Bitrix24; отдельную дедупликацию добавим после пилота.

Если на бесплатном тарифе недоступны вебхуки/нужные методы — переходим на EspoCRM или платный тариф.

## EspoCRM на российском VPS

1. Поставить EspoCRM на VPS в РФ.
2. Создать API-пользователя и API key.
3. В `.env`:

```env
CRM_PROVIDER=espocrm
ESPO_BASE_URL=https://crm.example.ru/
ESPO_API_KEY=...
```

4. Проверить создание лида.

## MAX

MAX-бот — отдельный адаптер к тому же `/api/leads`. Пока канал не блокирует запуск: сначала сайт + Telegram, затем MAX. Документация платформы: https://dev.max.ru/.

## Telegram-уведомления

Если заданы `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, после создания лида менеджеру уходит короткое уведомление. Ошибка Telegram не отменяет создание лида.

## 152-ФЗ и безопасность

- Сервис и CRM должны быть размещены в России.
- Mock-режим — только локально, не для продакшена.
- `.env` и `data/` не коммитить.
- Не хранить медицинские данные в CRM/Telegram.
- Ограничить доступ к VPS, включить firewall, TLS, бэкапы.
- Согласие: версия, дата, канал; аудит пишется в `consents.ndjson`.
- Токены — только в переменных окружения/секретах хостинга.

## Деплой

Сервис без зависимостей, есть `Dockerfile`. Подходит для Yandex Cloud, Selectel, VK Cloud или российского VPS.

```bash
docker build -t yb800-lead-intake .
docker run -d --name yb800-lead-intake \
  --env-file .env \
  -p 127.0.0.1:4174:4174 \
  yb800-lead-intake
```

На VPS поставьте reverse proxy с HTTPS и откройте только `POST /api/leads`/`GET /health`; `HOST=0.0.0.0` нужен только внутри контейнера/за прокси.

## Что дальше

- Проверить Bitrix24 Free на 20–30 заявках.
- Добавить дедупликацию по телефону/email/Telegram ID.
- Подключить Telegram-бота.
- Добавить MAX-адаптер.
- После пилота решить: остаться на Bitrix24 Free или перейти на EspoCRM/amoCRM.
