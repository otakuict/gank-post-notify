# Gank Post Notify

Backend Node.js สำหรับตรวจโพสต์ใหม่ของ creator หลายบัญชีบน Gank ทุก 1 นาที โดยใช้ public API ที่หน้า Gank เรียกใช้อยู่ ไม่ต้องเปิด browser ค้างไว้

## การทำงาน

- เรียกข้อมูลโพสต์ล่าสุดของทุกบัญชีทันทีตอนเริ่ม และทุก 1 นาที
- ครั้งแรกจะสร้าง baseline และ **ไม่แจ้งโพสต์เก่าทั้งหมด**
- เก็บรหัสโพสต์ที่เคยเห็นแยกตาม creator ใน `data/<nickname>.json` จึง restart ได้โดยไม่แจ้งซ้ำ
- ถ้า webhook ส่งไม่สำเร็จ จะยังไม่บันทึก state ใหม่ เพื่อ retry รอบถัดไป
- แสดงเวลาเป็น `YYYY-MM-DD HH:mm:ss (UTC+7)` ใน console log, notification และ status API
- มี HTTP API สำหรับดูสถานะและสั่งตรวจเอง

## เริ่มใช้งาน

ต้องใช้ Node.js 20 ขึ้นไป และไม่ต้อง `npm install` เพราะไม่มี dependency ภายนอก

บน Windows สามารถดับเบิลคลิก `post-noti.bat` เพื่อเปิด service ได้ทันที หรือใช้คำสั่งด้านล่าง:

- `post-noti.bat` — เริ่ม service และป้องกันการเปิดซ้ำบนพอร์ต 3000
- `stop-noti.bat` — หยุด service อย่างถูกต้อง
- `restart-noti.bat` — หยุดแล้วเริ่มใหม่ ใช้ไฟล์นี้หลังแก้ `.env` หรืออัปเดตโค้ด

ไม่ควรปิดด้วยการ kill เฉพาะหน้าต่าง CMD เพราะ `node.exe` อาจยังรันอยู่เบื้องหลัง

```bash
copy .env.example .env
npm start
```

ไฟล์ `.env` รองรับเฉพาะ `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_CHAT_ID` โดย `npm start` จะโหลดไฟล์นี้ให้อัตโนมัติ ตัวแปรที่ตั้งไว้ในระบบหรือ container จะมี priority สูงกว่า `.env`

หากไม่ต้องการใช้ไฟล์ สามารถตั้ง environment variable โดยตรงได้ เช่น:

```powershell
# PowerShell
$env:TELEGRAM_BOT_TOKEN = '<bot-token>'
$env:TELEGRAM_CHAT_ID = '<chat-id>'
npm start
```

ถ้าไม่ตั้งทั้ง webhook และ Telegram ระบบยังตรวจและบันทึกสถานะตามปกติ แต่จะไม่ส่ง notification

### เพิ่ม creator ที่ต้องการติดตาม

แก้ array `CONFIG.profiles` ใน `src/config.js` แล้ว restart ด้วย `restart-noti.bat` หรือ build/deploy image ใหม่ ระบบจะสร้าง baseline สำหรับบัญชีใหม่โดยไม่ส่งโพสต์เก่าย้อนหลัง

### Telegram alert

1. เปิดแชต `@BotFather` ใน Telegram และใช้คำสั่ง `/newbot` เพื่อสร้าง bot
2. ส่งข้อความอะไรก็ได้หา bot ที่สร้าง หรือเพิ่ม bot เข้า group แล้วส่งข้อความใน group
3. เปิด `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` แล้วดูค่า `message.chat.id`
4. ใส่ค่าทั้งสองรายการใน `.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:your_bot_token
TELEGRAM_CHAT_ID=123456789
```

สำหรับ group ค่า Chat ID มักเป็นเลขติดลบ และ bot ต้องยังอยู่ใน group นั้น จากนั้นดับเบิลคลิก `post-noti.bat` ตามปกติ สามารถเปิด Telegram พร้อมกับ Discord/Generic webhook ได้

### Discord webhook

ตั้ง `CONFIG.webhookUrl` และ `CONFIG.webhookType: 'discord'` ใน `src/config.js` (ค่าเริ่มต้นปิด webhook)

### Generic webhook

ตั้ง `CONFIG.webhookType: 'generic'` ใน `src/config.js` ระบบจะ `POST application/json` รูปแบบนี้:

```json
{
  "event": "gank.new_posts",
  "creator": {
    "id": "...",
    "nickname": "baemonfan",
    "profileUrl": "https://ganknow.com/baemonfan"
  },
  "posts": [
    {
      "id": "...",
      "title": "ชื่อโพสต์",
      "createdAt": "2026-09-15T16:23:23Z",
      "createdAtUtc7": "2026-09-15 23:23:23 (UTC+7)",
      "url": "https://ganknow.com/post/..."
    }
  ],
  "detectedAt": "..."
}
```

## HTTP API

- `GET /health` — health check (ตอบ 503 ถ้ารอบล่าสุด error)
- `GET /api/status` — สถานะล่าสุดและโพสต์ล่าสุดที่พบ
- `GET /api/status/<nickname>` — สถานะของ creator รายเดียว
- `POST /api/check` — สั่งตรวจทันที
- `POST /api/shutdown` — หยุด service (เรียกได้เฉพาะจากเครื่องนี้)

ตัวอย่าง:

```bash
curl http://localhost:3000/api/status
curl -X POST http://localhost:3000/api/check
```

## ตั้งค่าหลัก

ค่าทั้งหมดอยู่ใน `CONFIG` ของ `src/config.js` และไม่รับ override จาก environment ยกเว้น Telegram สองค่า:

| Constant | ค่า | ความหมาย |
|---|---|---|
| `profiles` | รายชื่อ 10 บัญชีเดิม | เพิ่ม/ลบบัญชีใน array |
| `intervalMs` | `60000` | ตรวจทุก 1 นาที |
| `port` | `3000` | HTTP port |
| `webhookUrl` | ว่าง | URL รับ notification |
| `webhookType` | `generic` | generic หรือ discord |
| `notifyOnFirstRun` | `false` | ไม่แจ้งโพสต์เก่าตอนเริ่ม |
| `stateDir` | `data/` ที่ root ของแอป | ใน container คือ `/app/data` |
| `postsPerPage` | `20` | จำนวนโพสต์ต่อรอบ |
| `requestTimeoutMs` | `15000` | request timeout |

`TELEGRAM_BOT_TOKEN` และ `TELEGRAM_CHAT_ID` รับจาก environment หรือ `.env` ในเครื่อง ต้องตั้งทั้งคู่ หรือเว้นว่างทั้งคู่เพื่อปิด Telegram ในเครื่อง

## Production ด้วย Docker

ใช้ Docker พร้อม Compose โดยสร้าง `.env` จาก `.env.example` และตั้งค่า Telegram ก่อนรัน (PowerShell):

```powershell
# ทำเฉพาะเมื่อยังไม่มี .env
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100
```

Image ใช้ Node.js 24 และรันด้วยผู้ใช้ `node` ที่ไม่ใช่ root โดยไม่ใส่ `.env`, token หรือข้อมูลใน `data/` ลงใน image ตัวโปรแกรมรันโดยตรงด้วย `node` เพื่อรับสัญญาณหยุดจาก Docker

Compose ส่งเฉพาะ Telegram สองค่าจาก `.env` เข้า container โดยพอร์ตคงที่ `127.0.0.1:3000:3000` เพราะ HTTP API ไม่มี authentication ทดสอบได้ที่ `http://localhost:3000/health`

State เก็บใน named volume `state` และยังอยู่หลัง recreate container; volume ใหม่จะเริ่ม baseline ใหม่ ไม่ได้นำข้อมูลจากโฟลเดอร์ `data/` บน host มาใช้โดยอัตโนมัติ รันเพียงหนึ่ง instance ต่อ volume เพื่อไม่ให้การเขียน state และการแจ้งเตือนชนกัน หลีกเลี่ยง `docker compose down -v` หากต้องการเก็บ state

Health check เรียก `/health` ทุก 30 วินาที และอาจเป็น `unhealthy` เมื่อ Gank หรือปลายทาง notification มีปัญหา ตามพฤติกรรมของ API เดิม Docker Compose จะ restart เมื่อ process หยุด แต่ไม่ได้ restart เพียงเพราะ health check ไม่ผ่าน

หลังแก้ `.env` หรือโค้ด ให้รัน `docker compose up -d --build` อีกครั้ง; หยุดด้วย `docker compose down`

หากต้องการใช้ Docker โดยไม่ใช้ Compose:

```powershell
docker build --pull -t gank-post-notify:production .
docker run -d --name gank-post-notify --init --restart unless-stopped --env-file .env -p 127.0.0.1:3000:3000 --mount source=gank-post-notify-state,target=/app/data --read-only --cap-drop ALL --security-opt no-new-privileges:true --log-opt max-size=10m --log-opt max-file=3 gank-post-notify:production
```

## CI/CD: Docker Hub → Ubuntu server

Workflow อยู่ที่ `.github/workflows/cicd.yml` ใช้รูปแบบเดียวกับ [gank-data-finder](https://github.com/otakuict/gank-data-finder/blob/main/.github/workflows/cicd.yml):

- Pull request เข้า `main`: ตรวจ syntax ของ deploy script และ build image ซึ่งรัน `npm test` ภายใน Docker
- Push เข้า `main` หรือกด Run workflow บน `main`: build/test → push `otakuict/gank-post-notify:<commit SHA>` → deploy บน self-hosted Ubuntu runner
- การสั่ง workflow บน branch อื่นจะ build/test เท่านั้น ไม่มี push หรือ deploy

ตั้งค่า GitHub repository ที่ **Settings → Secrets and variables → Actions**:

| ประเภท | ชื่อ | ค่า |
|---|---|---|
| Variable | `DOCKERHUB_USERNAME` | บัญชี Docker Hub ที่มีสิทธิ์ push image |
| Secret | `DOCKERHUB_TOKEN` | Docker Hub access token ที่มีสิทธิ์ read/write |
| Secret | `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| Secret | `TELEGRAM_CHAT_ID` | Chat ID ที่รับแจ้งเตือน |

สร้าง repository `otakuict/gank-post-notify` บน Docker Hub หรือแก้ `DOCKERHUB_IMAGE` ใน workflow ให้ตรงกับบัญชีที่ใช้

เตรียม Ubuntu x64 server โดยติดตั้ง Docker Engine, Bash, `flock` (แพ็กเกจ `util-linux`) และ GitHub Actions self-hosted runner ที่มี labels `self-hosted`, `linux`, `x64` ผู้ใช้ runner ต้องเรียก Docker ได้โดยไม่ใช้ `sudo` และควรผูก runner นี้กับเครื่อง production ของโปรเจกต์นี้โดยเฉพาะ

เพิ่ม Telegram สองค่าเป็น GitHub Repository Secrets แล้ว push เข้า `main` หรือกด Run workflow บน `main` โดยไม่ต้องสร้าง `.env` บน server Workflow ส่ง secrets เฉพาะขั้นตอน deploy และ Docker รับผ่าน environment โดยไม่บันทึกลง image หรือไฟล์ deploy หาก secret ใดหายไป script จะหยุดก่อนแก้ไข container เดิม

Deploy script ใช้ container `gank-post-notify`, named volume `gank-post-notify-state` และเปิดพอร์ตเฉพาะ `127.0.0.1:3000` รันแบบ non-root, read-only filesystem, ปิด Linux capabilities และจำกัดขนาด log มีช่วงหยุดบริการระหว่างเปลี่ยน container

Docker health check ต้องผ่านการตรวจ creator สำเร็จอย่างน้อยหนึ่งครั้งสำหรับทุกบัญชีก่อนถือว่า healthy; หากไม่พร้อมภายในประมาณ 180 วินาที script จะลบ container ใหม่และเริ่ม container เดิมกลับมา โดยใช้ state volume เดิม การ rollback ไม่ได้ย้อนข้อมูลใน volume และปัญหาจาก Gank/notification อาจทำให้ deploy ไม่ผ่านได้ หากมี container `gank-post-notify-previous` ค้างจากการ deploy ที่ถูกขัดจังหวะ ให้ตรวจและกู้คืนด้วยตนเองก่อน deploy ต่อ

ตรวจสถานะบน server:

```bash
docker ps --filter name=gank-post-notify
docker logs --tail=100 gank-post-notify
curl --fail http://127.0.0.1:3000/health
```

Deploy หรือ rollback ด้วย image tag ที่เคย push แล้วได้ด้วย (ต้อง export `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_CHAT_ID` ใน shell ก่อน):

```bash
docker pull otakuict/gank-post-notify:<commit-SHA>
bash scripts/deploy-server.sh otakuict/gank-post-notify:<commit-SHA>
```

ค่าชื่อ volume, host port และ lock file เป็น constants ใน `scripts/deploy-server.sh` หากย้ายมาจาก Compose ให้หยุด Compose ก่อนและแก้ `state_volume` ให้ตรงกับ volume เดิมเพื่อใช้ baseline ต่อ ห้ามรันสอง instance พร้อมกันบน state เดียวกัน

## ทดสอบ

```bash
npm test
```

> Endpoint ที่ใช้เป็น API ของหน้าเว็บ Gank และไม่ใช่ Creator API ที่มีสัญญาความเข้ากันได้อย่างเป็นทางการ หาก Gank เปลี่ยน endpoint ในอนาคต อาจต้องปรับ client.
