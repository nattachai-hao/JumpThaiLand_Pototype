# JUMP English

แอปฝึกสนทนาภาษาอังกฤษกับ AI ผ่านสถานการณ์จำลอง เหมาะสำหรับการฝึกพูดและเพิ่มความมั่นใจในชีวิตประจำวัน ผู้ใช้สามารถสนทนาด้วยข้อความหรือเสียง รับ Feedback หลังจบบทเรียน และทบทวนคำศัพท์ด้วย Flashcards

## ฟีเจอร์หลัก

- ฝึกสนทนา สถานการณ์
- สนทนากับ AI และฟังเสียงประโยคตอบกลับ
- รองรับ Voice Input บนอุปกรณ์ที่รองรับ Speech Recognition
- บันทึกบทสนทนา ข้อความ Feedback และ Flashcards ลง PostgreSQL
- กลับเข้าบทเรียนเดิมภายในวันเดียวกันได้โดยข้อมูลไม่หาย
- เมื่อกด Finish สถานการณ์จะย้ายไปอยู่ในหมวด Flashcard
- ทบทวน Flashcards ทีละใบด้วยระบบพลิกคำศัพท์และคำแปล
- Dashboard แสดงความคืบหน้ารายวัน
- เมื่อทำครบ 3 สถานการณ์ สามารถรับ 10 Points ได้วันละหนึ่งครั้ง
- เริ่มบทสนทนารอบใหม่ในวันถัดไปตามเวลา `Asia/Bangkok`
- ใช้งานได้ทั้ง Mock AI และ Gemini

## Tech Stack

### Mobile

- React Native
- Expo
- TypeScript
- Expo Speech
- Expo Speech Recognition

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

### Development

- Docker
- npm workspaces
- Xcode และ iOS Simulator

## โครงสร้างโปรเจกต์

```text
jumpThailand/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── controllers/
│   │       ├── routes/
│   │       ├── services/
│   │       ├── lib/
│   │       └── utils/
│   └── mobile/
│       ├── plugins/
│       ├── src/
│       └── App.tsx
├── package.json
└── README.md
```

## สิ่งที่ต้องติดตั้ง

- Node.js 20 ขึ้นไป
- npm
- Docker Desktop
- Xcode สำหรับรันบน iOS Simulator

ตรวจสอบเวอร์ชัน:

```bash
node --version
npm --version
docker --version
```

## การติดตั้ง

รันคำสั่งจากโฟลเดอร์หลักของโปรเจกต์:

```bash
cd /Users/nattachai/CEDT/hackathon/jumpThailand
npm install
```

## สร้าง PostgreSQL ด้วย Docker

สร้าง container พร้อม volume สำหรับเก็บข้อมูล:

```bash
docker run --name jump-thailand-postgres \
  -e POSTGRES_USER=jump_user \
  -e POSTGRES_PASSWORD=jump_password \
  -e POSTGRES_DB=jump_thailand \
  -p 5432:5432 \
  -v jump_thailand_postgres_data:/var/lib/postgresql/data \
  -d postgres:16-alpine
```

ตรวจสอบว่า container ทำงาน:

```bash
docker ps
```

หากเคยสร้าง container แล้วแต่ยังไม่ได้เปิด:

```bash
docker start jump-thailand-postgres
```

## ตั้งค่า Backend

สร้างไฟล์ environment:

```bash
cp apps/api/.env.example apps/api/.env
```

ตรวจสอบว่า `apps/api/.env` มีค่าดังนี้:

```env
DATABASE_URL="postgresql://jump_user:jump_password@localhost:5432/jump_thailand"
JUMP_API_PORT=4000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

หากยังไม่ใส่ `GEMINI_API_KEY` ระบบจะใช้ Mock AI โดยอัตโนมัติ

## สร้างตารางในฐานข้อมูล

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
cd ../..
```

เปิด Prisma Studio เพื่อตรวจสอบข้อมูล:

```bash
cd apps/api
npx prisma studio
```

## เริ่มใช้งาน

### วิธีที่ 1: เปิด Backend และ Expo พร้อมกัน

รันจากโฟลเดอร์หลัก:

```bash
npm run dev
```

จากหน้า Expo Terminal:

- กด `i` เพื่อเปิด iOS Simulator
- กด `r` เพื่อ Reload
- กด `Ctrl+C` เพื่อหยุดระบบ

### วิธีที่ 2: เปิด Backend แยกจาก Mobile

Terminal แรก:

```bash
npm run dev:api
```

Terminal ที่สอง:

```bash
npm run dev:mobile
```

### รัน Native iOS Development Build

```bash
npm run dev:ios
```

หรือรันบน iPhone จริง:

```bash
npm run ios:device
```

หากใช้โทรศัพท์จริง ให้ตั้ง API URL เป็น IP ของ Mac:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npm run dev:mobile
```

เปลี่ยน `192.168.1.10` ให้เป็น IP ของเครื่องที่เปิด Backend และตรวจสอบว่าโทรศัพท์กับ Mac เชื่อมต่อ Wi-Fi เดียวกัน

## คำสั่งที่ใช้บ่อย

| คำสั่ง | รายละเอียด |
|---|---|
| `npm run dev` | เปิด Backend และ Expo พร้อมกัน |
| `npm run dev:api` | เปิดเฉพาะ Backend ที่พอร์ต 4000 |
| `npm run dev:mobile` | เปิดเฉพาะ Expo |
| `npm run dev:ios` | Build และเปิดแอปบน iOS Simulator |
| `npm run ios:device` | Build และเปิดแอปบน iPhone จริง |
| `npm run typecheck` | ตรวจ TypeScript ทั้งโปรเจกต์ |
| `npx prisma migrate deploy` | ใช้ migrations กับฐานข้อมูล |
| `npx prisma studio` | เปิดหน้าจัดการข้อมูล Prisma |

## API Endpoints

### Health

| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/health` | ตรวจสอบสถานะ Backend |

### Scenarios

| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/scenarios` | อ่านรายการสถานการณ์ |

### Conversations

| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/conversations` | อ่านรายการบทสนทนา |
| `GET` | `/api/conversations/:id` | อ่านบทสนทนาตาม ID |
| `POST` | `/api/conversations` | เริ่มหรือเปิดบทสนทนาของวันนี้ |
| `POST` | `/api/conversations/:id/messages` | ส่งข้อความและรับคำตอบจาก AI |
| `POST` | `/api/conversations/:id/finish` | จบบทเรียนและสร้าง Feedback/Flashcards |

ตัวอย่างเริ่มบทสนทนา:

```bash
curl -X POST http://localhost:4000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"scenario":"cafe"}'
```

### Dashboard และ Points

| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/api/dashboard` | อ่านความคืบหน้าและ Points |
| `POST` | `/api/dashboard/claim` | รับ 10 Points เมื่อทำครบ 3 สถานการณ์ |

## การทำงานรายวัน

1. ผู้ใช้เลือกสถานการณ์และเริ่มสนทนา
2. หากออกจากหน้าแล้วกลับเข้ามาภายในวันเดียวกัน ระบบจะเปิดบทสนทนาเดิม
3. เมื่อกด Finish ระบบจะบันทึก Feedback และ Flashcards
4. สถานการณ์ที่เสร็จแล้วจะย้ายไปหมวด Flashcard
5. เมื่อทำครบทั้ง 3 สถานการณ์ ปุ่ม `Get 10 Points` จะปรากฏบน Dashboard
6. Points รับได้เพียงหนึ่งครั้งต่อวันและสะสมในฐานข้อมูล
7. เมื่อเข้าสู่วันใหม่ สถานการณ์จะกลับมาเริ่มบทสนทนารอบใหม่

## Database Models

- `Conversation` — สถานการณ์ สถานะ และเวลาของบทสนทนา
- `Message` — ข้อความของผู้ใช้และ AI
- `Feedback` — คะแนน คำแนะนำ และประโยคที่ควรปรับปรุง
- `Flashcard` — คำศัพท์ คำแปล และตัวอย่างประโยค
- `DailyReward` — Points ที่รับในแต่ละวัน

## หมายเหตุเรื่อง Voice Input

Speech Recognition อาจไม่พร้อมใช้งานบน iOS Simulator บางเวอร์ชันและแสดงข้อความ `Recognizer is unavailable` ซึ่งไม่ได้เกิดจาก Backend หากต้องการทดสอบการรับเสียงจริง แนะนำให้ใช้ iPhone จริงและอนุญาต:

- Microphone
- Speech Recognition

ส่วนการพิมพ์ข้อความและ Text-to-Speech ยังคงใช้งานบน Simulator ได้ตามปกติ

## ตรวจสอบก่อนส่งงาน

```bash
npm run typecheck
```

จากนั้นตรวจสอบว่า:

- PostgreSQL container ทำงาน
- Prisma migrations ถูกติดตั้งครบ
- Backend เปิดที่ `http://localhost:4000`
- Mobile เชื่อมต่อ API ได้
- ทำบทเรียน กด Finish เปิด Flashcards และรับ Points ได้
