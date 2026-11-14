# Pawnd Backend API

Backend API for Pawnd, a platform for reporting lost and found pets. The service is built with NestJS, TypeScript, Prisma, and PostgreSQL, with Cloudinary-backed media and JWT authentication.

## Features

- User accounts and authentication
- Pet profiles and lost/found posts
- Post status and reunion tracking
- AI matching data and notifications
- Community posts, comments, and content reports

## Requirements

- Node.js and pnpm
- PostgreSQL database
- Cloudinary account credentials

## Getting started

Install dependencies and create a local environment file:

```bash
pnpm install
cp .env.example .env
```

Set the following values in .env:

| Variable | Description |
| --- | --- |
| `PORT` | Port used by the API (for example, `3000`) |
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_SECRET` | Secret used to sign tokens; provide at least 32 characters |
| `JWT_EXPIRE_IN` | Token lifetime in seconds (for example, `3600`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

Apply database migrations and generate the Prisma client:

```bash
pnpm run prisma:migrate
pnpm run prisma:generate
```

Start the API in watch mode:

```bash
pnpm run start:dev
```

The API listens on the port configured by `PORT`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm run build` | Compile the application |
| `pnpm run start` | Start the application |
| `pnpm run start:dev` | Start in watch mode |
| `pnpm run start:prod` | Start the compiled application |
| `pnpm run test` | Run unit tests |
| `pnpm run test:e2e` | Run end-to-end tests |
| `pnpm run test:cov` | Run tests with coverage |
| `pnpm run prisma:studio` | Open Prisma Studio |

## การเริ่มต้นใช้งาน (ภาษาไทย)

Pawnd Backend API เป็นระบบหลังบ้านสำหรับแพลตฟอร์มประกาศสัตว์เลี้ยงหายและพบสัตว์เลี้ยง พัฒนาด้วย NestJS, TypeScript, Prisma และ PostgreSQL รองรับการยืนยันตัวตนด้วย JWT และจัดเก็บสื่อผ่าน Cloudinary

1. ติดตั้ง Node.js, pnpm และเตรียมฐานข้อมูล PostgreSQL กับบัญชี Cloudinary
2. รัน `pnpm install` แล้วคัดลอก `.env.example` เป็นไฟล์ `.env`
3. กรอกค่าตัวแปรแวดล้อมให้ครบ โดย `JWT_SECRET` ต้องมีอย่างน้อย 32 ตัวอักษร และ `JWT_EXPIRE_IN` ระบุเป็นวินาที
4. รัน `pnpm run prisma:migrate` และ `pnpm run prisma:generate`
5. รัน `pnpm run start:dev` เพื่อเริ่มเซิร์ฟเวอร์โหมดพัฒนา

อย่านำค่า secret หรือไฟล์ `.env` ขึ้น Git
