# ЦРФИ – Центр реагирования и фиксации инцидентов а сфере Fintech, Crypto, Blockchain

Один и тот же сайт обслуживает оба домена по HTTPS. Ниже — пошаговый чеклист: можно копировать команды по порядку.

**Подставь вместо `NEW_SERVER_IP` реальный IP нового сервера.**

---

## Команды для создания сертификатов

**Первый раз (новый сервер, оба домена сразу):**

```bash
sudo certbot certonly --webroot -w /var/www/response-center \
  -d "xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "www.xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "xn--h1apmg.xn--p1ai" \
  -d "www.xn--h1apmg.xn--p1ai" \
  --email Egormatveev228@inbox.ru \
  --agree-tos
```

Сертификат появится в `/etc/letsencrypt/live/xn----dtbfccqa1bcdlqzi2ch.xn--p1ai/` (fullchain.pem, privkey.pem).

**Уже есть сертификат только для центр-инцидентов.рф — добавить црфи.рф (расширить):**

```bash
sudo certbot certonly --webroot -w /var/www/response-center \
  --expand \
  -d "xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "www.xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "xn--h1apmg.xn--p1ai" \
  -d "www.xn--h1apmg.xn--p1ai" \
  --email Egormatveev228@inbox.ru \
  --agree-tos
```

Перед запуском: nginx должен быть запущен, в конфиге для порта 80 указан `root /var/www/response-center` и есть `location /.well-known/acme-challenge/`. DNS обоих доменов должен указывать на этот сервер.

---

## 1. DNS у регистраторов

Перед переносом или сразу после — переведи оба домена на новый сервер.

### центр-инцидентов.рф (reg.ru или где зарегистрирован)

| Тип | Имя | Значение |
|-----|-----|----------|
| A | @ | `NEW_SERVER_IP` |
| A | www | `NEW_SERVER_IP` |

- Удали AAAA для @ и www, если есть (чтобы certbot не уходил по IPv6).

### црфи.рф

| Тип | Имя | Значение |
|-----|-----|----------|
| A | @ | `NEW_SERVER_IP` |
| A | www | `NEW_SERVER_IP` |

- AAAA для @ и www лучше не добавлять или удалить.

Подожди 5–30 минут (иногда до пары часов), затем проверь:

```bash
nslookup -type=A xn----dtbfccqa1bcdlqzi2ch.xn--p1ai 8.8.8.8
nslookup -type=A xn--h1apmg.xn--p1ai 8.8.8.8
```

В ответе должен быть `NEW_SERVER_IP`.

---

## 2. Подключение к новому серверу

```bash
ssh root@NEW_SERVER_IP
```

(или `ssh user@NEW_SERVER_IP` и дальше `sudo` там, где ниже указано `sudo`.)

---

## 3. Установка Nginx и Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot
```

---

## 4. Каталог сайта и файлы

```bash
sudo mkdir -p /var/www/response-center
```

С локальной машины (из папки проекта, где есть `index.html`, `css/`, `images/` и т.д.):

```bash
scp -r index.html css images deploy root@NEW_SERVER_IP:/tmp/response-center-upload
ssh root@NEW_SERVER_IP "cp -r /tmp/response-center-upload/* /var/www/response-center/ && rm -rf /tmp/response-center-upload"
```

Либо через git на сервере:

```bash
# на сервере
sudo apt install -y git
sudo git clone https://github.com/YOUR_USER/response_center.git /var/www/response-center
# затем скопировать только нужное (index.html, css, images), не весь репо с deploy и т.д.
sudo cp -r /var/www/response-center/* /var/www/response-center/  # подправь под структуру репо
```

Проверка:

```bash
ls -la /var/www/response-center/
# Должны быть index.html, css/, images/ и т.п.
sudo chown -R www-data:www-data /var/www/response-center
```

---

## 5. Nginx: конфиг (сначала без HTTPS)

На сервере создай конфиг (можно скопировать из репо или вставить вручную). **Важно:** на первом запуске блок `server { listen 443 ... }` должен быть закомментирован — сертификата ещё нет.

Файл: `/etc/nginx/sites-available/response-center`

Содержимое (только порт 80; блок 443 добавим после выдачи сертификата):

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name центр-инцидентов.рф www.центр-инцидентов.рф
               xn----dtbfccqa1bcdlqzi2ch.xn--p1ai www.xn----dtbfccqa1bcdlqzi2ch.xn--p1ai
               црфи.рф www.црфи.рф
               xn--h1apmg.xn--p1ai www.xn--h1apmg.xn--p1ai;

    root /var/www/response-center;
    index index.html;

    location /.well-known/acme-challenge/ {
        default_type "text/plain";
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

Пока сертификата нет, временно замени `return 301` на раздачу сайта, чтобы не редиректить в никуда:

```nginx
    location / {
        try_files $uri $uri/ /index.html;
    }
```

Включить сайт и убрать default_server у стандартного сайта (если будет ошибка «duplicate default server»):

```bash
sudo ln -sf /etc/nginx/sites-available/response-center /etc/nginx/sites-enabled/
sudo sed -i 's/listen 80 default_server;/listen 80;/' /etc/nginx/sites-available/default
sudo sed -i 's/listen \[::\]:80 default_server;/listen [::]:80;/' /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Выдача сертификата (оба домена сразу)

```bash
sudo certbot certonly --webroot -w /var/www/response-center \
  -d "xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "www.xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" \
  -d "xn--h1apmg.xn--p1ai" \
  -d "www.xn--h1apmg.xn--p1ai" \
  --email Egormatveev228@inbox.ru \
  --agree-tos
```

Если успешно — сертификат будет в `/etc/letsencrypt/live/xn----dtbfccqa1bcdlqzi2ch.xn--p1ai/`.

---

## 7. Nginx: включить HTTPS

В том же файле `/etc/nginx/sites-available/response-center`:

1. Верни редирект в `location /` для порта 80:
   `return 301 https://$host$request_uri;`
2. Добавь в конец файла второй блок `server` для 443 (скопируй из `nginx-центр-инцидентов.conf` в репо — блок с `listen 443 ssl http2` и путями к fullchain.pem/privkey.pem).

Либо замени весь файл на полный конфиг из репозитория: `deploy/nginx-центр-инцидентов.conf`.

Проверка и перезагрузка:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Проверка

- https://центр-инцидентов.рф
- https://www.центр-инцидентов.рф
- https://црфи.рф
- https://www.црфи.рф

Все должны открывать один и тот же сайт с валидным SSL.

---

## 9. Продление сертификата

Certbot сам ставит задачу в cron/systemd. Проверить таймер:

```bash
sudo systemctl list-timers | grep certbot
```

Вручную проверить продление:

```bash
sudo certbot renew --dry-run
```

---

## Краткая шпаргалка команд (по порядку)

```bash
# 1) На новом сервере
sudo apt update && sudo apt install -y nginx certbot
sudo mkdir -p /var/www/response-center
# 2) С локальной машины залить файлы в /var/www/response-center (scp/git)
# 3) На сервере: владелец
sudo chown -R www-data:www-data /var/www/response-center
# 4) Создать /etc/nginx/sites-available/response-center (сначала только HTTP, location / = try_files)
sudo ln -sf /etc/nginx/sites-available/response-center /etc/nginx/sites-enabled/
sudo sed -i 's/listen 80 default_server;/listen 80;/' /etc/nginx/sites-available/default
sudo sed -i 's/listen \[::\]:80 default_server;/listen [::]:80;/' /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
# 5) Сертификат
sudo certbot certonly --webroot -w /var/www/response-center -d "xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" -d "www.xn----dtbfccqa1bcdlqzi2ch.xn--p1ai" -d "xn--h1apmg.xn--p1ai" -d "www.xn--h1apmg.xn--p1ai" --email Egormatveev228@inbox.ru --agree-tos
# 6) В конфиг nginx добавить блок listen 443 (полный конфиг из nginx-центр-инцидентов.conf), в location / для 80 вернуть return 301
sudo nginx -t && sudo systemctl reload nginx
```

---

## Файлы в репозитории

- `deploy/nginx-центр-инцидентов.conf` — полный конфиг nginx (HTTP + HTTPS) для обоих доменов.
- `deploy/README-црфи.рф.md` — добавление црфи.рф на уже работающий сайт.
- Punycode: центр-инцидентов.рф = `xn----dtbfccqa1bcdlqzi2ch.xn--p1ai`, црфи.рф = `xn--h1apmg.xn--p1ai`.
