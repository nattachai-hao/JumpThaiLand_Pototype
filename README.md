# JUMP Thailand — AI English Practice

MVP สำหรับฝึกสนทนาภาษาอังกฤษกับ AI ผู้ใช้เลือกสถานการณ์ พิมพ์ข้อความสนทนา ฟังเสียงตอบกลับ และรับ feedback พร้อม flashcards หลังจบเซสชัน

## โครงสร้าง

- `apps/mobile` — React Native + Expo
- `apps/api` — Express + TypeScript

## เริ่มใช้งาน

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:api
```

เปิด terminal อีกหน้าต่าง:

```bash
npm run dev:mobile
```

ค่าเริ่มต้น mobile จะเรียก API ที่ `http://localhost:4000` หากรันบนโทรศัพท์จริง ให้กำหนด IP ของเครื่อง:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npm run dev:mobile
```

ระบบทำงานได้ทันทีด้วย mock AI หากต้องการใช้ Gemini ให้ใส่ `GEMINI_API_KEY` ใน `apps/api/.env`

## API

- `GET /health`
- `POST /api/conversations`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/:id/finish`
