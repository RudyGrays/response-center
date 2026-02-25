# Деплой и SSL для центр-инцидентов.рф

## 1. Разместить сайт на сервере

```bash
sudo mkdir -p /var/www/response_center
# Загрузить файлы (index.html, css/, js/, images/) в /var/www/response_center
sudo chown -R www-data:www-data /var/www/response_center
```

## 2. Nginx без SSL (первый запуск)

Сначала ставим конфиг **без** блока `listen 443`, чтобы получить сертификат:

- Временно закомментировать в конфиге весь блок `server { listen 443 ... }`.
- Или скопировать только блок `listen 80`, убрать `return 301`, оставить `try_files` и `location /.well-known/`.

```bash
sudo cp deploy/nginx-центр-инцидентов.conf /etc/nginx/sites-available/response_center
# Отредактировать: закомментировать server { listen 443 ... }
sudo ln -sf /etc/nginx/sites-available/response_center /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 3. Получить SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --webroot -w /var/www/response_center -d "центр-инцидентов.рф" -d "www.центр-инцидентов.рф"
```

Certbot спросит email и согласие с условиями. Сертификаты появятся в `/etc/letsencrypt/live/` — имя папки будет в punycode, например `xn--80aesfpebagmfblc0a1a9b8b.xn--p1ai`. Проверить:

```bash
sudo ls /etc/letsencrypt/live/
```

Если имя папки другое — подставить его в конфиге в `ssl_certificate` и `ssl_certificate_key`.

## 4. Включить HTTPS в Nginx

Раскомментировать блок `server { listen 443 ssl http2; ... }` в конфиге, при необходимости поправить пути к сертификатам. Затем:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Обновление сертификата (авто)

```bash
sudo certbot renew --dry-run
```

Для автообновления обычно уже есть таймер: `systemctl list-timers | grep certbot`.
