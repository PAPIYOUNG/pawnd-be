# AGENTS.md — PAWND Backend Engineering Guide

> เอกสารนี้เป็นข้อกำหนดกลางสำหรับมนุษย์และ AI Coding Agent ทุกค่ายที่เข้ามาทำงานใน PAWND Backend
> ให้อ่านไฟล์นี้ทั้งหมดก่อนวิเคราะห์ แก้ไข หรือสร้างโค้ดทุกครั้ง

## 1. เป้าหมายของเอกสาร

เอกสารนี้มีไว้เพื่อให้สมาชิกในทีมและ AI Agent ทำงานไปในทิศทางเดียวกัน โดยกำหนดหลักการด้าน:

- Business rules และ flow ของแต่ละ feature
- Architecture และโครงสร้างไฟล์
- รูปแบบการเขียน NestJS, Prisma และ TypeScript
- Database, validation, security และ error handling
- Testing และ Definition of Done
- Git workflow และรูปแบบ commit

หากเอกสารนี้ขัดกับ requirement ล่าสุดที่ทีมอนุมัติ ให้หยุดและถามทีมก่อนแก้ไขเอกสารหรือโค้ด ห้าม AI ตัดสินใจเปลี่ยน business rule สำคัญเอง

---

## 2. ข้อบังคับสำหรับ AI Agent

### 2.1 ก่อนเริ่มงานทุกครั้ง

AI ต้องดำเนินการตามลำดับต่อไปนี้:

1. อ่าน `AGENTS.md` ทั้งหมด
2. อ่าน ticket, Acceptance Criteria และ requirement ที่เกี่ยวข้อง
3. ตรวจ `git status` และ branch ปัจจุบัน
4. ตรวจโครงสร้างไฟล์และค้นหา implementation เดิมก่อนสร้างไฟล์ใหม่
5. อ่าน Prisma schema, DTO, enum, guard, interceptor และ shared utility ที่เกี่ยวข้อง
6. สรุปขอบเขตงานและไฟล์ที่คาดว่าจะได้รับผลกระทบแบบสั้น ๆ
7. หาก requirement ไม่ชัดหรือขัดกัน ให้ถามก่อนลงมือ ห้ามเดา business rule

### 2.2 Source of truth

เมื่อข้อมูลไม่ตรงกัน ให้ยึดลำดับความสำคัญดังนี้:

1. Requirement หรือการตัดสินใจล่าสุดที่ทีมยืนยัน
2. Ticket และ Acceptance Criteria ปัจจุบัน
3. `AGENTS.md`
4. Prisma schema และ API contract ที่ใช้งานอยู่
5. Test ที่ผ่านอยู่ใน branch หลัก
6. Implementation เดิม

ห้ามแก้ test ให้ผ่านด้วยการลดทอน business rule หากพบข้อขัดแย้งให้แจ้งทีม

### 2.3 ขอบเขตการทำงาน

- ทำงานเฉพาะ feature หรือ bug ที่ได้รับมอบหมาย
- ห้าม refactor โค้ดที่ไม่เกี่ยวข้องโดยไม่ได้รับอนุญาต
- ห้ามเปลี่ยน API contract, schema, enum หรือชื่อ field โดยพลการ
- ห้ามสร้าง service, helper, type หรือ module ซ้ำกับของเดิม
- ห้ามเพิ่ม dependency หากของเดิมทำงานได้อยู่แล้ว
- หากจำเป็นต้องเพิ่ม dependency ต้องอธิบายเหตุผล ผลกระทบ และตรวจ license/security ก่อน
- ห้ามอ่าน แสดง log หรือ commit secret, token, credential และข้อมูลส่วนบุคคลจริง
- ห้ามแก้ `.env` ของผู้อื่น และห้าม commit `.env`; หากเพิ่ม config ให้แก้เฉพาะไฟล์ตัวอย่าง เช่น `.env.example`
- ห้ามใช้คำสั่ง destructive เช่น reset, force checkout, ลบ migration หรือทิ้งงานของสมาชิกคนอื่น

### 2.4 ข้อห้ามด้าน Git ที่สำคัญที่สุด

AI Agent สามารถสร้าง local commit เมื่อ feature ผ่าน Definition of Done แล้ว แต่:

- **ห้าม `git push` ทุกกรณี เว้นแต่มนุษย์สั่งอย่างชัดเจนในครั้งนั้น**
- ห้ามสร้าง Pull Request อัตโนมัติ
- ห้าม merge branch อัตโนมัติ
- ห้าม rebase, force push, reset history หรือ amend commit ของผู้อื่น
- หลัง commit ให้รายงาน commit hash, commit message, test result และรายการไฟล์สำคัญ แล้วหยุดรอมนุษย์ตรวจและ push เอง

---

## 3. ภาพรวมระบบ PAWND

PAWND คือแพลตฟอร์มช่วยตามหาสัตว์เลี้ยงหายและจับคู่ประกาศ Lost/Found ด้วย AI โดยมี feature หลักดังนี้:

- Authentication และ Email OTP Verification
- User Profile
- Pet Profile และ QR Code สำหรับเปิด public pet profile
- Lost/Found Post และ Event Timeline
- AI Generate Description และ AI Image Analysis
- AI Smart Matching ด้วย vector embedding และคะแนนประกอบ
- Map, geolocation, nearby search และ reverse geocoding
- Flyer/Poster Generator แบบ template
- Realtime Chat
- Community Feed, Comment และ Report
- Notification
- Admin Management

### 3.1 Technology stack

- Runtime/Language: Node.js, TypeScript
- Backend framework: NestJS
- Package manager: pnpm
- Main database: PostgreSQL
- ORM: Prisma
- Vector search: pgvector
- Chat data: PostgreSQL ตาม architecture ล่าสุดที่ทีมอนุมัติ
- Document data: MongoDB สำหรับ AI analysis ตาม architecture ที่ทีมอนุมัติ
- Realtime: WebSocket ตาม adapter/library ที่มีอยู่ใน repository
- Asset storage: ใช้ provider/service กลางของโปรเจกต์ ห้ามเรียก SDK กระจายตาม feature

ห้ามเปลี่ยน technology หรือย้ายชนิดข้อมูลข้าม database โดยไม่ได้รับการอนุมัติจากทีม

### 3.2 Local development setup

#### Prerequisites

- Node.js (ดูเวอร์ชันใน `.nvmrc` หรือ `package.json > engines` หากมี)
- pnpm
- Docker Desktop (แนะนำ) หรือ PostgreSQL ที่ติดตั้ง pgvector แล้ว

#### Database setup (Docker — แนะนำ)

```bash
# หยุด PostgreSQL บน Windows ก่อน (หากมี) เพื่อไม่ให้ port ชน
net stop postgresql-x64-16

# รัน PostgreSQL + pgvector (ใช้ port 5433 เพื่อหลีกเลี่ยง port ชน)
docker run -d --name pawnd-postgres \
  -e POSTGRES_PASSWORD="<your_password>" \
  -e POSTGRES_DB="pawnd_project" \
  -p 5433:5432 \
  pgvector/pgvector:pg16

# เปิด extension ทั้ง template1 (สำหรับ Prisma shadow DB) และ main DB
docker exec -it pawnd-postgres psql -U postgres -d template1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker exec -it pawnd-postgres psql -U postgres -d pawnd_project \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

> **หมายเหตุ port:** ใช้ `-p 5433:5432` เพื่อหลีกเลี่ยง port ชนกับ PostgreSQL ที่ติดตั้งบน Windows โดยตรง หากเปลี่ยน port ต้องแก้ `DATABASE_URL` ใน `.env` ให้ตรงกัน

#### Environment variables

1. คัดลอก `.env.example` → `.env`
2. ใส่ค่าตามตารางด้านล่าง

| ตัวแปร | คำอธิบาย | ตัวอย่าง / หมายเหตุ |
|---|---|---|
| `PORT` | พอร์ตที่ server listen | `8000` |
| `DATABASE_URL` | Connection string (**ต้อง URL-encode สัญลักษณ์พิเศษในรหัสผ่าน** เช่น `@` → `%40`) | `postgresql://postgres:pass%40word@localhost:5433/pawnd_project?schema=public` |
| `JWT_SECRET` | Secret key สำหรับ sign JWT — **ต้องยาวอย่างน้อย 32 ตัวอักษร** | ใช้ `openssl rand -hex 32` สร้างได้ |
| `JWT_EXPIRE_IN` | อายุ token **หน่วยวินาที** | `86400` = 1 วัน |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | สมัคร free tier หรือใส่ dummy สำหรับ dev ที่ยังไม่ต้อง upload |
| `CLOUDINARY_API_KEY` | Cloudinary API key | เช่นเดียวกัน |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | เช่นเดียวกัน |

> ⚠️ **ห้าม commit ไฟล์ `.env`** — มีอยู่ใน `.gitignore` แล้ว หากเพิ่มตัวแปรใหม่ ให้อัปเดต `.env.example` เท่านั้น

#### First run

```bash
pnpm install
pnpm run prisma:generate
pnpm prisma db push            # อนุญาตเฉพาะ local prototype
pnpm run start:dev             # server เริ่มที่ http://localhost:<PORT>
```

> **Database workflow ปัจจุบัน:** ทีมอนุญาต `prisma db push` เฉพาะฐานข้อมูล local prototype ที่ลบและสร้างใหม่ได้เท่านั้น การเปลี่ยน schema สำหรับ shared development, staging และ production ต้องสร้าง migration ที่ review และ commit ได้ แล้วใช้ `prisma migrate deploy` ใน environment ปลายทาง ห้ามนำ `db push` ไปใช้แทน migration ใน environment เหล่านั้น

---

## 4. Architecture และโครงสร้างไฟล์

ให้ใช้ feature-based modular architecture ของ NestJS และปรับตามโครงสร้างจริงใน repository เป็นหลัก ตัวอย่างมาตรฐาน:

```text
src/
├── main.ts
├── app.module.ts
├── @types/
├── config/
│   └── env.validate.ts
├── common/
│   ├── decorators/
│   ├── dto/
│   ├── filters/
│   └── intercepter/
├── database/
│   ├── prisma.service.ts
│   └── generated/prisma/
├── infrastructure/
│   └── jwt/
├── auth/
│   ├── dto/
│   ├── guards/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
└── <feature>/              ← feature ใหม่วางระดับเดียวกับ auth/
    ├── dto/
    ├── <feature>.controller.ts
    ├── <feature>.service.ts
    ├── <feature>.module.ts
    └── *.spec.ts

prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

> **หมายเหตุ:** โครงสร้างจริงใน repository เป็นหลัก หากมีข้อขัดแย้งกับตัวอย่างด้านบน ให้ดูโค้ดปัจจุบันเป็น source of truth

### 4.1 หน้าที่ของแต่ละ layer

- **Controller:** รับ request, อ่าน param/query/body, เรียก service และกำหนด HTTP status เท่านั้น ห้ามใส่ business logic หนัก
- **Service:** เป็นเจ้าของ use case, business rule, authorization ระดับ resource และ transaction
- **DTO:** กำหนด input contract และ validation ห้ามใช้ Prisma model เป็น request DTO โดยตรง
- **Repository/Data access:** หาก repository มี abstraction นี้อยู่แล้วให้ใช้รูปแบบเดิม ถ้ายังไม่มี ห้ามสร้างเพิ่มทั้งระบบเพื่อ feature เดียว
- **Common:** ใช้เฉพาะสิ่งที่ใช้ข้ามหลาย feature จริง ๆ ห้ามโยน business logic เฉพาะ feature มาไว้ใน common
- **Provider integration:** ครอบ SDK ภายนอกด้วย service/adapter เพื่อ mock ใน test และเปลี่ยน provider ได้

### 4.2 Dependency direction

- Module ต้อง import dependency ผ่าน NestJS module
- ห้ามสร้าง circular dependency; `forwardRef()` ใช้เมื่อหลีกเลี่ยงไม่ได้และต้องอธิบายเหตุผล
- ห้าม import private implementation ข้าม feature แบบลัด
- Shared guard เช่น authentication ต้องถูก export/import ผ่าน module ที่ถูกต้อง ห้ามประกาศซ้ำใน `AppModule`

---

## 5. Coding standards

### 5.1 TypeScript

- เปิดใช้ strict typing ตาม `tsconfig` ของโปรเจกต์
- ห้ามใช้ `any` เว้นแต่มีเหตุผลจำเป็นและ comment อธิบาย
- ใช้ type/enum ที่มีอยู่ก่อนสร้างใหม่
- ใช้ `async/await` และจัดการ error อย่างมีความหมาย
- ห้าม swallow error ด้วย `catch` เปล่า
- ชื่อ class/type ใช้ `PascalCase`; function/variable ใช้ `camelCase`; constant ใช้รูปแบบเดียวกับ repository
- ชื่อไฟล์ใช้ `kebab-case`
- ใช้ formatter และ lint config ของ repository ห้ามตั้ง style ส่วนตัวทับของทีม

### 5.2 NestJS

- ใช้ constructor injection
- Controller ต้องบางและไม่เข้าถึง Prisma/SDK โดยตรง
- Guard ใช้กับ authentication/role; resource ownership ตรวจใน service
- ใช้ Nest exception ที่เหมาะสม เช่น `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ConflictException`
- ห้ามคืน stack trace, provider error หรือรายละเอียด database ให้ client
- ใช้ response format/interceptor กลางที่มีอยู่ ห้าม wrap response ซ้ำ
- endpoint ใหม่ต้องสอดคล้องกับ route/prefix ที่ระบบใช้อยู่

### 5.3 DTO และ validation

- ทุก external input ต้องผ่าน DTO และ validation
- แยก Create/Update/Query DTO ตามหน้าที่
- Update DTO ต้องอนุญาตเฉพาะ field ที่แก้ได้จริง ห้าม mass assignment
- UUID, email, enum, date, URL, file type และขนาดไฟล์ต้อง validate
- Pagination ต้องมี default และ maximum limit
- Normalize input เท่าที่ business rule อนุญาต เช่น trim email ก่อนใช้
- Error message ต้องชัดเจนแต่ไม่เปิดเผยข้อมูลอ่อนไหว

### 5.4 Database และ Prisma

- อ่าน schema และ relation ปัจจุบันก่อน query ทุกครั้ง
- ใช้ transaction สำหรับ operation ที่ต้องสำเร็จหรือ rollback พร้อมกัน
- ป้องกัน N+1 query และ select เฉพาะ field ที่จำเป็น โดยเฉพาะข้อมูล user
- ห้ามคืน `password_hash`, OTP, token, internal provider metadata หรือข้อมูลส่วนบุคคลเกินจำเป็น
- ใช้ unique constraint/index รองรับ business invariant และ query ที่ใช้บ่อย
- Decimal, date/time และ vector ต้องแปลงอย่างตั้งใจ ห้ามพึ่ง implicit conversion
- เก็บเวลาเป็น UTC; แปลง timezone ที่ presentation layer/client
- การแก้ schema ที่จะส่งต่อไปยัง shared development, staging หรือ production ต้องมาพร้อม migration ที่ตรวจสอบได้ ห้ามแก้ migration เก่าที่ถูกใช้งานร่วมกันแล้ว
- ใช้ `prisma db push` ได้เฉพาะ local prototype ตามข้อตกลงปัจจุบันของทีม ห้ามใช้แทน migration ใน shared development, staging หรือ production
- pgvector extension ต้องถูกติดตั้งใน environment ก่อนใช้งาน ห้ามสร้าง fallback ที่เปลี่ยน semantics โดยเงียบ
- Field ที่ใช้ `Unsupported("vector")` ใน Prisma schema ไม่สามารถ query ผ่าน Prisma Client API ปกติได้ ต้องใช้ `$queryRaw` / `$executeRaw` สำหรับ vector operations เช่น similarity search
- Migration ที่สร้างตารางซึ่งใช้ type `vector` ต้องมี `CREATE EXTENSION IF NOT EXISTS vector;` อยู่ด้วยเพื่อให้ shadow database ของ Prisma migrate ทำงานได้

### 5.5 File upload และ asset

- ตรวจ MIME type, extension, file size และจำนวนไฟล์ตาม requirement
- Video ทุก feature ต้องมีขนาดไม่เกิน **5 MB**
- ห้ามเชื่อ filename หรือ MIME จาก client เพียงอย่างเดียวหากระบบมีวิธีตรวจเพิ่ม
- เก็บเฉพาะ asset metadata/URL ที่จำเป็นใน database
- การลบ entity ที่มี asset ต้องกำหนด cleanup strategy และไม่ลบ asset ของ resource อื่น
- เรียก upload/delete ผ่าน asset service กลาง เช่น Cloudinary adapter ที่มีอยู่

### 5.6 Security และ privacy

- ทุก protected endpoint ต้องผ่าน access-token guard
- ตรวจ role และ ownership แยกกันอย่างชัดเจน
- ไม่เปิดเผย email, phone, LINE ID หรือ address ต่อสาธารณะโดยอัตโนมัติ
- การติดต่อเจ้าของ Lost/Found Post รองรับ In-app Chat และข้อมูลติดต่อที่เจ้าของเลือกเปิดเผยในประกาศนั้น
- `contact_phone`, `contact_line_id` และ `contact_email` เป็นข้อมูล optional ระดับประกาศ ห้ามดึงค่าจาก User Profile มาเปิดเผยอัตโนมัติ
- Public response ต้องคืนเฉพาะข้อมูลติดต่อที่เจ้าของกรอกในประกาศโดยตั้งใจ และต้องไม่คืนข้อมูลติดต่อของ post สถานะ `HIDDEN` หรือ `DELETED`
- เมื่อ post เป็น `REUNITED` หรือ `CLOSED` ให้ซ่อนข้อมูลติดต่อจาก public response เพื่อป้องกันการติดต่อหลังจบเคส เว้นแต่ requirement ล่าสุดของทีมระบุเป็นอย่างอื่น
- ป้องกัน enumeration เช่น login/OTP response ไม่ควรบอกข้อมูลบัญชีเกินจำเป็น
- OTP และ token ต้องมี expiry, จำกัด attempt/rate และใช้ครั้งเดียวตามที่ออกแบบ
- Public QR token ต้องเป็น random opaque token ห้ามใช้ pet ID หรือข้อมูลที่เดาได้ตรง ๆ
- Log ต้องไม่บันทึก password, OTP, access token, refresh token, cookie, secret หรือ payload ที่มีข้อมูลอ่อนไหว

---

## 6. API conventions

- ใช้ REST resource naming และ plural noun ให้สอดคล้องกับ endpoint เดิม
- ปัจจุบันระบบยังไม่ใช้ global prefix `/api/v1`; endpoint ใหม่ให้ใช้ route เช่น `/posts/:id/events` และห้ามเพิ่ม global prefix โดยไม่ได้รับอนุมัติจากทีม
- HTTP status โดยทั่วไป:
  - `200 OK` สำหรับอ่านหรือแก้ไขสำเร็จ
  - `201 Created` สำหรับสร้าง resource
  - `204 No Content` สำหรับลบสำเร็จเมื่อไม่มี response body
  - `400 Bad Request` สำหรับ input/business condition ที่ไม่ถูกต้อง
  - `401 Unauthorized` เมื่อยังไม่ authenticate หรือ token ใช้ไม่ได้
  - `403 Forbidden` เมื่อ authenticate แล้วแต่ไม่มีสิทธิ์
  - `404 Not Found` เมื่อ resource ไม่มีหรือไม่ควรเปิดเผยว่ามี
  - `409 Conflict` เมื่อชน unique/state conflict
- Pagination, filtering และ sorting ต้องใช้รูปแบบเดียวกับ endpoint เดิม
- API ใหม่หรือ API ที่เปลี่ยนต้องอัปเดต Swagger/OpenAPI หาก repository ใช้งานอยู่
- การเปลี่ยน response/request ที่ใช้งานแล้วถือเป็น breaking change ต้องขออนุมัติ

---

## 7. Business rules และ feature flow

ส่วนนี้เป็นกติกากลางระดับ product หาก implementation หรือ schema ปัจจุบันไม่รองรับ ให้แจ้งทีมก่อนเปลี่ยน

### 7.1 Authentication และ Email Verification

**Register flow**

1. รับ first name, last name, email, password และ confirm password
2. Validate และตรวจ email ซ้ำ
3. Hash password ด้วยกลไกที่โปรเจกต์กำหนด ห้ามเก็บ plain text
4. สร้าง user สถานะรอ email verification
5. สร้างและส่ง OTP สำหรับยืนยัน email ครั้งแรก
6. OTP ต้องหมดอายุ ใช้ครั้งเดียว และถูกแทนที่เมื่อ resend ตาม policy
7. เมื่อ verify สำเร็จจึงอัปเดตสถานะ/email verified timestamp

**Login flow**

- รองรับ email/password และ social login เฉพาะ provider ที่ทีมกำหนด ได้แก่ Google และ LINE
- PAWND ไม่ถือการยืนยัน email ครั้งแรกเป็น 2FA
- บัญชีที่ถูกระงับ/ลบ/ยังไม่ผ่านเงื่อนไขที่ระบบกำหนดต้องไม่เข้าสู่ระบบ
- ห้าม log password หรือ token

**Change email flow**

- การเปลี่ยน email ต้องตรวจ ownership/authentication และ email ซ้ำ
- email ใหม่ต้อง verify ด้วย OTP ก่อนถือว่า verified
- การแก้ profile field อื่นไม่ต้อง verify email ใหม่

### 7.2 User Profile

- User อ่านและแก้ไข profile ของตนเองได้เฉพาะ field ที่อนุญาต
- แยก flow เปลี่ยน password และเปลี่ยน email ออกจาก update profile ทั่วไป
- Avatar ต้องผ่าน asset validation
- การลบบัญชีต้องกำหนดผลต่อ post, pet, chat และ audit data ตาม policy ของทีม ห้าม cascade delete โดยเดาเอง
- Public response ต้องไม่คืน contact information เกินจำเป็น

### 7.3 Pet Profile และ Gallery

- เจ้าของเท่านั้นที่สร้าง/แก้ไข/ลบข้อมูลสัตว์และจัดลำดับ gallery ได้
- Gallery reorder ต้องตรวจว่า image ID ทุกตัวเป็นของ pet ตัวเดียวกัน ไม่มีค่าซ้ำ และจำนวนครบตาม contract
- `distinctive_features` ใช้เก็บลักษณะเด่นที่ช่วยระบุตัวสัตว์ เช่น ตำหนิ สีเฉพาะ หรือรูปแบบขน
- รูปหลักและ sort order ต้องมีผลลัพธ์ deterministic

### 7.4 Pet QR Code

- Pet หนึ่งตัวมี QR record ที่ active ตาม model ปัจจุบัน และ `qr_token` ต้อง unique
- `qr_token` เป็น random opaque token สำหรับ route สาธารณะ ห้าม encode pet ID หรือ PII ลงใน token
- การสแกน QR เปิด public pet profile ที่เปิดเผยเฉพาะข้อมูลที่อนุญาต
- การ generate/regenerate ต้อง idempotent ตาม contract และไม่สร้าง record ซ้ำโดยไม่จำเป็น
- การ revoke/regenerate ต้องทำให้ token เก่าใช้ไม่ได้เมื่อ business rule ระบุ
- QR image เป็น derived asset; source of truth คือ public URL/token ไม่ใช่รูปภาพเพียงอย่างเดียว
- Feature print ใช้ template ที่กำหนด ไม่ใช้ Generative AI สร้าง QR หรือ layout ที่ต้องแม่นยำ

### 7.5 Lost/Found Post

- Post มีประเภท `LOST` หรือ `FOUND` ตาม enum จริงใน schema
- ผู้สร้างต้องกรอกข้อมูลสัตว์, รูป, พื้นที่, วันที่ และรายละเอียดตามประเภทประกาศ
- Lost/Found Post รองรับรูปสูงสุด **3 รูป**
- ตรวจ ownership ของ pet เมื่อ Lost Post อ้างถึง pet profile
- Owner แก้ไขประกาศ เปลี่ยนสถานะ และดูรายการ My Posts ได้
- การเปลี่ยนสถานะต้องเป็นไปตาม state transition ที่ระบบกำหนด ห้ามข้าม state โดยเดาเอง
- เมื่อ Owner ยืนยันว่าสัตว์กลับถึงเจ้าของแล้ว ให้เปลี่ยน `PetPost.status` เป็น `REUNITED`, กำหนด `reunited_at` และสร้าง Timeline event `REUNITED` ภายใน transaction เดียวกัน
- Post สถานะ `REUNITED` ต้องไม่ปรากฏในรายการค้นหา `ACTIVE` แต่หน้า Pet Post Detail และ Timeline ยังเปิดดูได้ พร้อมแสดงสถานะ “กลับบ้านแล้ว”
- หน้าแรกสามารถนับและแสดง post สถานะ `REUNITED` เป็น Success Story โดยใช้ `PetPost.status` เป็น source of truth ไม่ใช่นับจาก Timeline
- เมื่อสร้าง Lost/Found Post สำเร็จ ระบบสร้าง Community Post อัตโนมัติในนาม user ตาม template โดยต้องป้องกันการสร้างซ้ำ
- การปิด/แก้ post ต้องพิจารณาผลต่อ matching, map, notification และ community reference
- ผู้ชมติดต่อเจ้าของผ่าน In-app Chat หรือข้อมูลติดต่อ optional ที่เจ้าของกรอกไว้ในประกาศนั้นได้ ห้ามนำข้อมูลจาก User Profile มาเปิดเผยอัตโนมัติ

### 7.6 Post Event Timeline

- Timeline เป็นประวัติความคืบหน้าของประกาศที่ระบบสร้างจาก domain action จริง ผู้ใช้ไม่มี endpoint สำหรับเพิ่ม แก้ หรือลบ historical event โดยตรง
- Event MVP ที่ทีมอนุมัติคือ `POST_CREATED`, `AI_MATCHES_FOUND`, `AI_MATCH_CONFIRMED`, `REUNITED` และ `POST_CLOSED`
- เมื่อสร้าง post สำเร็จ ให้ Posts service สร้าง `POST_CREATED` ใน transaction เดียวกับ post
- เมื่อ AI พบผลลัพธ์มากกว่า 0 เป็นครั้งแรก ให้ AI Matching service สร้าง `AI_MATCHES_FOUND` เพียงครั้งเดียว โดย MVP ไม่เก็บหรือแสดงจำนวน match
- เมื่อ Owner ยืนยัน AI match ให้ตรวจ ownership และ idempotency ก่อนสร้าง `AI_MATCH_CONFIRMED` เพื่อไม่ให้เกิด event ซ้ำจากการกดหรือ retry ซ้ำ
- เมื่อเปลี่ยน post เป็น `REUNITED` หรือ `CLOSED` ให้แก้สถานะ post และสร้าง event ที่สอดคล้องกันใน transaction เดียว
- Public API ของ Timeline คือ `GET /posts/:postId/events`; ไม่มี public `POST /posts/:id/events` การบันทึก event ต้องเรียก internal service จาก Posts หรือ AI Matching use case
- `GET /posts/:postId/events` เปิดอ่านได้สำหรับ post ที่เปิดเผย รวมถึง `ACTIVE`, `REUNITED` และ `CLOSED`; สำหรับ `HIDDEN` หรือ `DELETED` ให้ใช้ visibility policy ล่าสุดของทีมและไม่เปิดเผย resource ต่อผู้ไม่มีสิทธิ์
- Event ต้องเรียงตาม `created_at` จากเก่าไปใหม่ และใช้ `id` เป็น deterministic tie-break เมื่อเวลาเท่ากัน
- Historical event ห้ามแก้หรือลบผ่าน public API; หากอนาคตต้องแก้ข้อมูลย้อนหลัง ต้องออกแบบ audit policy และได้รับอนุมัติจากทีมก่อน

### 7.7 Map และ Geolocation

- รองรับ interactive pins, nearby posts และ reverse geocoding
- Nearby search ต้องจำกัด search radius ภายในค่าที่ระบบกำหนด
- ตรวจ latitude อยู่ใน `-90..90` และ longitude อยู่ใน `-180..180`
- Distance calculation ต้องใช้หน่วยกิโลเมตรและวิธีเดียวกันทั้งระบบ
- Public location อาจต้องลดความละเอียดเพื่อความเป็นส่วนตัวตาม requirement
- Reverse-geocode response เป็นข้อมูลช่วยแสดงผล ไม่ควรแทนพิกัด source of truth โดยอัตโนมัติ

### 7.8 AI Generate Description และ Image Analysis

Endpoint ที่กำหนดไว้:

- `POST /ai/generate-description`
- `POST /ai/generate-description-text`
- `POST /ai/analyze-image`

กติกา:

- ผลจาก AI เป็นคำแนะนำ ผู้ใช้ต้องตรวจและแก้ได้ก่อน publish
- ห้ามอ้างผลวิเคราะห์ AI เป็นข้อเท็จจริงที่รับประกันได้
- Validate input และจำกัดขนาด/ชนิดไฟล์ก่อนส่ง provider
- ครอบ AI provider ด้วย adapter/service; เก็บ `model_name` และ `model_version` เพื่อ audit/reproducibility
- กำหนด timeout, retry เฉพาะ error ที่ retry ได้ และไม่ retry แบบไม่จำกัด
- ห้าม log รูป, prompt หรือข้อมูลส่วนบุคคลโดยไม่จำเป็น
- AI analysis result เก็บใน data store ที่ architecture กำหนด โดยเชื่อมกับ source post/image อย่างตรวจสอบได้

### 7.9 AI Smart Matching

Endpoint ที่กำหนดไว้:

- `GET /posts/:id/matches`
- `POST /posts/:id/match`
- `GET /matches/:id`

Matching flow:

1. Validate post และสิทธิ์ของผู้เรียก
2. เลือก candidate เฉพาะประกาศฝั่งตรงข้าม เช่น LOST เทียบ FOUND
3. Filter candidate ด้วยสถานะ, ช่วงเวลา และข้อจำกัดพื้นฐาน
4. สร้าง/อ่าน embedding ด้วย model/version ที่กำหนด
5. ทำ vector similarity search ผ่าน pgvector
6. คำนวณคะแนนประกอบ
7. บันทึก match และ component scores อย่างตรวจสอบย้อนหลังได้
8. ส่งผลเรียงตาม `final_score` และกติกา tie-break ที่กำหนด
9. แจ้งเตือนเมื่อผ่าน threshold และป้องกัน notification ซ้ำ

ความหมายคะแนน:

- `vector_similarity`: ความคล้ายจาก embedding/vector โดยตรง
- `feature_score`: ความตรงกันของ attribute ที่ตีความได้ เช่น species, breed, color, sex และ distinctive features
- `location_score`: ความสอดคล้องตามระยะทาง
- `date_score`: ความสอดคล้องของวันที่หาย/พบ
- `final_score`: คะแนนรวมตามสูตรและ weight ที่ทีมอนุมัติ
- `distance_km`: ระยะห่างจริงโดยประมาณ หน่วยกิโลเมตร

กติกาเพิ่มเติม:

- ห้ามเปลี่ยน weight, threshold, distance decay หรือสูตรคะแนนโดยไม่ได้รับอนุมัติ
- Score ต้องมีช่วงค่าตาม schema และจัดการ null อย่างชัดเจน
- การ trigger manual ต้อง idempotent หรือมีกลไกป้องกัน job ซ้อน
- เจ้าของ post สามารถ pin/unpin match และ dismiss รายการที่ไม่ใช่ได้
- การ dismiss/pin เป็น user decision ห้าม AI เขียนทับเมื่อ re-run
- ผล match ต้องอธิบาย component score ได้ ไม่คืนเพียงคะแนนรวม

### 7.10 Flyer/Poster Generator

- สร้างด้วย deterministic template เพื่อให้รูปแบบและ QR แม่นยำ
- AI ใช้ช่วยเขียนคำบรรยายได้ แต่ไม่ใช้สร้างข้อมูลสำคัญหรือ QR
- ข้อมูลใน flyer ต้องมาจาก post ล่าสุดและ field ที่อนุญาต
- ต้องรองรับรูปหลัก, ประเภทประกาศ, รายละเอียดสำคัญ, QR และ call to action
- ต้องไม่แสดงข้อมูลติดต่อส่วนบุคคล หาก contact policy กำหนดให้ใช้ In-app Chat

### 7.11 Realtime Chat

- การติดต่อผู้โพสต์ทำผ่าน In-app Chat
- ข้อมูล conversation, member และ message ที่เป็น source of truth ให้ persist ใน PostgreSQL
- ก่อน implement Chat ทีมต้องเลือก Prisma model ชุดเดียวระหว่าง `Conversation` และ `ChatRoom` และแก้ relation ให้ข้อความ สมาชิก และ notification อ้างถึง aggregate เดียวกัน ห้ามพัฒนาสองระบบคู่ขนาน
- ตรวจว่า member มีสิทธิ์เข้าถึง conversation ทุกครั้ง ทั้ง REST และ WebSocket
- ห้าม client ระบุ sender ID แล้วเชื่อทันที ให้ใช้ identity จาก authenticated connection
- Message ต้อง persist ก่อนหรือร่วมกับการ broadcast ตาม consistency model ที่ทีมกำหนด
- ป้องกัน duplicate message ด้วย client message ID/idempotency strategy หาก contract รองรับ
- ตรวจ content length, attachment และ moderation rule
- ห้าม expose conversation แก่ผู้ที่ไม่ใช่สมาชิก

### 7.12 Community Feed, Comment และ Report

- Community Post รองรับรูปสูงสุด **3 รูป**
- Lost/Found Post ที่ publish สำเร็จสามารถสร้าง Community Post อัตโนมัติในนามเจ้าของ
- User สร้าง comment ได้ตามสถานะของ post และแก้/ลบเฉพาะ content ของตนตาม policy
- Report อ้างถึง Community Post หรือ Comment ตาม constraint ที่กำหนด ไม่ควรอ้างทั้งคู่หรือไม่อ้างเลย
- การ report ไม่ได้แปลว่าต้องซ่อนทันที เว้นแต่ business rule ระบุ
- Admin review แล้วจึงเปลี่ยน report status และ `is_hidden` ของ target ตามผลพิจารณา
- เก็บ `reviewed_by` และ `reviewed_at` เมื่อมีการตัดสิน
- การซ่อน content ต้องไม่ทำลายข้อมูลต้นฉบับหรือ audit trail

### 7.13 Notification

- เคารพ `notification_enabled` และ preference แยกประเภทหากมี
- Notification สำคัญ เช่น match/chat ต้องอ้างถึง resource ที่ตรวจสิทธิ์ก่อนเปิดดู
- ป้องกัน duplicate notification จาก retry/event ซ้ำ
- Mark-as-read ต้องแก้ได้เฉพาะ notification ของ user ปัจจุบัน

### 7.14 Admin Management

- ทุก endpoint ต้องใช้ authentication และ role authorization
- Admin action ที่มีผลต่อ user/content ต้องเก็บผู้กระทำ เวลา เหตุผล และผลลัพธ์ตาม audit policy
- การ hide/suspend/review ต้องใช้ state ที่ชัดเจน ห้าม hard delete เพื่อความสะดวก
- Admin ไม่ควรเห็น secret หรือ credential และเห็น PII เท่าที่จำเป็นต่อหน้าที่

---

## 8. Error handling, logging และ observability

- ใช้ global exception filter/response interceptor ที่มีอยู่
- แยก operational error ที่คาดการณ์ได้ออกจาก unexpected error
- Log ต้องมี context ที่ช่วย trace เช่น request ID, resource ID และ error code โดยไม่ใส่ secret/PII
- Provider error ต้อง map เป็น domain/application error ที่เหมาะสม
- งาน async เช่น matching/notification ต้อง log job status และรองรับ idempotency
- ห้ามใช้ `console.log` ค้างใน production code หากมี logger กลาง

---

## 9. Testing requirements

### 9.1 Test ที่ต้องพิจารณา

- Unit test: business rule, score calculation, mapper และ service branching
- Integration test: Prisma query, transaction, constraint, pgvector/Mongo integration ตามความเหมาะสม
- E2E test: happy path, validation, unauthorized, forbidden, not found และ conflict ของ endpoint สำคัญ
- External provider ต้อง mock/stub ใน unit test ห้ามเรียกเงินจริงหรือ service จริงโดยไม่จำเป็น

### 9.2 Test case ขั้นต่ำของแต่ละ feature

- สำเร็จตาม happy path
- Input ไม่ครบ/ผิด format/เกิน limit
- User ยังไม่ login
- User ไม่มี role หรือไม่ใช่ owner
- Resource ไม่มีอยู่
- Duplicate/conflict และ concurrent request ที่สำคัญ
- Provider/database failure
- ไม่เปิดเผย field อ่อนไหวใน response

### 9.3 คำสั่งตรวจสอบ

ให้ใช้ script ที่มีอยู่จริงใน `package.json` เท่านั้น โดยทั่วไปควรตรวจอย่างน้อย:

```bash
pnpm lint
pnpm test
pnpm build
```

หากมี script สำหรับ format, type-check, test:e2e หรือ migration validation ให้รันตามขอบเขตงาน ห้ามอ้างว่าผ่านหากไม่ได้รันจริง หากรันไม่ได้ต้องระบุ command และสาเหตุ

---

## 10. Definition of Done

Feature ถือว่าเสร็จเมื่อครบทุกข้อที่เกี่ยวข้อง:

- ตรงตาม ticket, Acceptance Criteria และ business rule
- ใช้ architecture และ naming เดิมของ repository
- ไม่มี secret/PII รั่วใน code, log หรือ response
- DTO validation, auth, role และ ownership ครบ
- Database constraint/index/transaction เหมาะสม
- Error case ถูกจัดการ
- Test ที่เกี่ยวข้องถูกเพิ่มหรืออัปเดตและผ่าน
- Lint/type-check/build ผ่าน
- API docs และ `.env.example` ถูกอัปเดตเมื่อจำเป็น
- Migration/seed ถูกเพิ่มเมื่อจำเป็นและไม่ทำลายข้อมูลโดยไม่ตั้งใจ
- ตรวจ diff แล้วไม่มี unrelated change หรือ generated file ที่ไม่ควร commit
- สร้าง local commit ตามกติกา และยังไม่ได้ push

---

## 11. Git workflow และ commit policy

### 11.1 ก่อนแก้โค้ด

```bash
git status
git branch --show-current
```

- ห้ามทำงานบน branch ที่ทีมไม่อนุญาต
- หาก working tree มีการเปลี่ยนแปลงเดิม ให้ถือว่าเป็นงานของสมาชิกทีม ห้ามทับ ลบ หรือ stage รวม
- หากไฟล์ที่ต้องแก้ชนกับ uncommitted work ให้หยุดถามเจ้าของงาน

### 11.2 ระหว่างทำงาน

- ทำทีละ feature/ticket ให้ commit มีขอบเขตชัดเจน
- ตรวจ `git diff` เป็นระยะ
- ไม่รวม refactor, formatting ทั้งโปรเจกต์ หรือ lockfile change ที่ไม่เกี่ยวข้อง
- หาก feature ใหญ่ ให้แบ่ง commit ตามหน่วยงานที่ review ได้ แต่แต่ละ commit ต้องอยู่ในสถานะสมเหตุสมผล

### 11.3 ก่อน commit

1. รัน test/lint/build ที่เกี่ยวข้อง
2. ตรวจ `git diff --check`
3. ตรวจ `git status --short`
4. ตรวจ diff ทุกไฟล์ที่จะ stage
5. Stage เฉพาะไฟล์ของ feature ห้ามใช้ `git add .` เมื่อมีงานอื่นปะปน
6. ตรวจ staged diff อีกครั้งด้วย `git diff --cached`

### 11.4 Commit message

ใช้ Conventional Commits:

```text
<type>(<scope>): <short description>
```

ประเภทที่ใช้:

- `feat`: เพิ่ม feature
- `fix`: แก้ bug
- `refactor`: ปรับโครงสร้างโดย behavior ไม่เปลี่ยน
- `test`: เพิ่ม/แก้ test
- `docs`: แก้เอกสาร
- `chore`: งาน config/tooling ที่ไม่ใช่ feature
- `perf`: ปรับประสิทธิภาพ

ตัวอย่าง:

```text
feat(pet-qr): add public QR profile endpoint
feat(ai-matching): calculate location and date scores
fix(auth): prevent reuse of verified OTP
test(posts): cover unauthorized status update
docs(agents): define backend development rules
```

- ใช้ภาษาอังกฤษใน commit subject เพื่อให้สม่ำเสมอ
- Subject ใช้ imperative mood, กระชับ และไม่ลงท้ายด้วยจุด
- หนึ่ง commit ควรอธิบายการเปลี่ยนแปลงหนึ่งเรื่อง
- หากมี migration หรือ breaking change ให้เขียนรายละเอียดใน commit body

### 11.5 หลัง commit

AI ต้องรายงาน:

- Commit hash และ message
- สรุปสิ่งที่เปลี่ยน
- Test/lint/build ที่รันและผลลัพธ์
- สิ่งที่ยังไม่ได้ทดสอบหรือข้อจำกัด
- ยืนยันว่า **ยังไม่ได้ push**

จากนั้นให้หยุดรอทีมตรวจ ห้ามดำเนินการคำสั่งต่อไปนี้เอง:

```bash
git push
git push --force
git merge
git rebase
gh pr create
```

---

## 12. รูปแบบรายงานของ AI Agent

เมื่อทำงานเสร็จ ให้ตอบทีมแบบกระชับตาม template นี้:

```text
งานที่เสร็จ:
- ...

ไฟล์สำคัญที่เปลี่ยน:
- ...

การตรวจสอบ:
- pnpm test ...: ผ่าน/ไม่ผ่าน
- pnpm lint: ผ่าน/ไม่ผ่าน
- pnpm build: ผ่าน/ไม่ผ่าน

Commit:
- <hash> <message>

ข้อสังเกต/สิ่งที่ยังไม่ได้ทำ:
- ...

ยังไม่ได้ push ขึ้น remote รอทีมตรวจและ push เอง
```

---

## 13. Checklist แบบย่อสำหรับทุกงาน

- [ ] อ่าน `AGENTS.md`, ticket และ code ที่เกี่ยวข้องแล้ว
- [ ] ตรวจ branch และ uncommitted changes แล้ว
- [ ] ไม่เดา requirement/schema/API contract
- [ ] Controller บาง; business logic อยู่ใน service
- [ ] DTO validation ครบ
- [ ] Authentication, role และ ownership ครบ
- [ ] ไม่เปิดเผย secret/PII
- [ ] Query/transaction/index เหมาะสม
- [ ] Test error paths และ happy path แล้ว
- [ ] Lint/test/build ผ่าน หรือรายงานข้อจำกัดตามจริง
- [ ] ตรวจ diff และ stage เฉพาะไฟล์ของงาน
- [ ] Commit ตาม Conventional Commits แล้ว
- [ ] **ไม่ได้ push, merge, rebase หรือสร้าง PR อัตโนมัติ**

---

## 14. การดูแลเอกสารนี้

- เมื่อทีมยืนยัน business rule, architecture หรือ workflow ใหม่ ให้แก้ `AGENTS.md` ใน commit ที่ review ได้
- หาก rule ใหม่มีผลกับ feature เดิม ให้ระบุ migration/compatibility impact
- ห้าม AI เปลี่ยนข้อห้าม Git, security rule หรือ business rule สำคัญเอง
- เอกสารนี้ไม่แทน Swagger, Prisma schema, ticket หรือ test แต่ทำหน้าที่เชื่อมทุกส่วนให้ทีมทำงานในแนวทางเดียวกัน
