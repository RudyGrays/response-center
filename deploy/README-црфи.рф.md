# Добавление црфи.рф на тот же сайт с SSL

## 1. DNS у регистратора црфи.рф

- A @ → 85.239.43.254
- A www → 85.239.43.254
- AAAA для @ и www лучше удалить (чтобы certbot не уходил по IPv6 на другой хост).

## 2. Punycode для црфи.рф

На сервере (или локально с `idn`):

```bash
echo црфи.рф | idn
```

Punycode для црфи.рф: `xn--h1apmg.xn--p1ai`. Если у тебя другой — замени в конфиге и в команде certbot.

## 3. Расширить сертификат (добавить црфи.рф и www)

На сервере:

```bash
sudo certbot certonly --webroot -w /var/www/response-center \
  --expand \
  -d "xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "www.xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "xn--h1apmg.xn--p1ai" \
  -d "www.xn--h1apmg.xn--p1ai" \
  --email Egormatveev228@inbox.ru --agree-tos
```

Сертификат останется в той же папке: `/etc/letsencrypt/live/xn----dtbfccqa1bcdlqzi2ch.xn--p1ai/`.

## 4. Nginx и перезагрузка

- Убедиться, что в конфиге в обоих блоках `server` в `server_name` добавлены црфи.рф и punycode (файл уже обновлён).
- Проверить и перезагрузить:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

После этого https://црфи.рф и https://www.црфи.рф будут открывать тот же сайт с валидным SSL.
