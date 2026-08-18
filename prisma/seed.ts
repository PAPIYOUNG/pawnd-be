import 'dotenv/config';
import {
  PrismaClient,
  PetType,
  PetGender,
  UserStatus,
  PostType,
  PostStatus,
} from '@/database/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;

interface SeedPet {
  name: string;
  type: PetType;
  breed: string;
  gender: PetGender;
  color: string;
  age: number;
}

interface SeedUser {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pets: SeedPet[];
}

const users: SeedUser[] = [
  {
    firstName: 'Alice',
    lastName: 'Nguyen',
    email: 'alice.nguyen@example.com',
    phone: '0812345671',
    pets: [
      {
        name: 'Bella',
        type: PetType.DOG,
        breed: 'Golden Retriever',
        gender: PetGender.FEMALE,
        color: 'Golden',
        age: 3,
      },
      {
        name: 'Milo',
        type: PetType.CAT,
        breed: 'Siamese',
        gender: PetGender.MALE,
        color: 'Cream',
        age: 2,
      },
    ],
  },
  {
    firstName: 'Ben',
    lastName: 'Carter',
    email: 'ben.carter@example.com',
    phone: '0812345672',
    pets: [
      {
        name: 'Rocky',
        type: PetType.DOG,
        breed: 'Bulldog',
        gender: PetGender.MALE,
        color: 'Brindle',
        age: 4,
      },
      {
        name: 'Coco',
        type: PetType.BIRD,
        breed: 'Cockatiel',
        gender: PetGender.FEMALE,
        color: 'Grey',
        age: 1,
      },
    ],
  },
  {
    firstName: 'Chalisa',
    lastName: 'Suwannapha',
    email: 'chalisa.suwannapha@example.com',
    phone: '0812345673',
    pets: [
      {
        name: 'Nala',
        type: PetType.CAT,
        breed: 'Persian',
        gender: PetGender.FEMALE,
        color: 'White',
        age: 5,
      },
      {
        name: 'Simba',
        type: PetType.CAT,
        breed: 'Domestic Shorthair',
        gender: PetGender.MALE,
        color: 'Orange',
        age: 2,
      },
    ],
  },
  {
    firstName: 'David',
    lastName: 'Kim',
    email: 'david.kim@example.com',
    phone: '0812345674',
    pets: [
      {
        name: 'Max',
        type: PetType.DOG,
        breed: 'Poodle',
        gender: PetGender.MALE,
        color: 'Black',
        age: 6,
      },
      {
        name: 'Peanut',
        type: PetType.HAMSTER,
        breed: 'Syrian',
        gender: PetGender.UNKNOWN,
        color: 'Brown',
        age: 1,
      },
    ],
  },
  {
    firstName: 'Emma',
    lastName: 'Wattana',
    email: 'emma.wattana@example.com',
    phone: '0812345675',
    pets: [
      {
        name: 'Luna',
        type: PetType.DOG,
        breed: 'Shih Tzu',
        gender: PetGender.FEMALE,
        color: 'White/Brown',
        age: 2,
      },
      {
        name: 'Kiwi',
        type: PetType.BIRD,
        breed: 'Budgerigar',
        gender: PetGender.MALE,
        color: 'Green',
        age: 1,
      },
    ],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  for (const userData of users) {
    const { pets, ...userFields } = userData;

    const user = await prisma.user.upsert({
      where: {
        email: userFields.email,
      },
      update: {},
      create: {
        ...userFields,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    for (const pet of pets) {
      const existingPet = await prisma.pet.findFirst({
        where: {
          ownerId: user.id,
          name: pet.name,
        },
      });

      if (!existingPet) {
        await prisma.pet.create({
          data: {
            ...pet,
            ownerId: user.id,
          },
        });
      }
    }
  }

  console.log(
    `Seeded ${users.length} users with ${
      users.flatMap((u) => u.pets).length
    } pets.`,
  );

  await seedCredentialTestUser();

  // เพิ่ม AI matching seed
  await seedAiMatchingPosts();
}

async function seedCredentialTestUser() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.log(
      'Skipped credential test user — set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env to create one.',
    );

    return;
  }

  const testPasswordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.upsert({
    where: {
      email,
    },

    update: {
      passwordHash: testPasswordHash,
    },

    create: {
      firstName: 'Test',
      lastName: 'User',
      email,
      passwordHash: testPasswordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Seeded credential test user: ${email}`);
}

// =========================================================
// AI MATCHING TEST DATA
// =========================================================

async function seedAiMatchingPosts() {
  const user = await prisma.user.findUnique({
    where: {
      email: 'alice.nguyen@example.com',
    },
  });

  if (!user) {
    throw new Error('Seed user for AI matching was not found');
  }

  const LOST_POST_1_ID = '11111111-1111-4111-8111-111111111111';

  const LOST_POST_2_ID = '22222222-2222-4222-8222-222222222222';

  const FOUND_POST_1_ID = '33333333-3333-4333-8333-333333333333';

  const FOUND_POST_2_ID = '44444444-4444-4444-8444-444444444444';

  // =========================================================
  // LOST 1
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: LOST_POST_1_ID,
    },

    update: {},

    create: {
      id: LOST_POST_1_ID,
      userId: user.id,

      type: PostType.LOST,
      status: PostStatus.ACTIVE,

      petName: 'ส้ม',
      petType: PetType.CAT,

      breed: null,

      color: 'สีส้มลายแท็บบี้และสีขาว',

      distinctiveFeatures: 'มีขนสีขาวบริเวณรอบปากและจมูก สวมปลอกคอสีแดง',

      description:
        'แมวขนสั้นสีส้มลายแท็บบี้ มีขนสีขาวบริเวณรอบปากและจมูก และสวมปลอกคอสีแดง',

      eventDate: new Date('2026-08-18T10:00:00+07:00'),

      latitude: 13.8165,
      longitude: 100.5612,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'ลาดยาว',

      locationDescription: 'บริเวณใกล้สวนจตุจักร',
    },
  });

  // =========================================================
  // LOST 2
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: LOST_POST_2_ID,
    },

    update: {},

    create: {
      id: LOST_POST_2_ID,
      userId: user.id,

      type: PostType.LOST,
      status: PostStatus.ACTIVE,

      petName: 'มีมี่',
      petType: PetType.CAT,

      breed: null,

      color: 'สีขาวและเทา',

      distinctiveFeatures: 'มีลายสีเทาบริเวณศีรษะและลำตัว หางมีสีเข้ม',

      description:
        'แมวขนสั้นสีขาวและเทา มีลายสีเทาบริเวณศีรษะและลำตัว และมีหางสีเข้ม',

      eventDate: new Date('2026-08-17T14:00:00+07:00'),

      latitude: 13.805,
      longitude: 100.55,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'จอมพล',

      locationDescription: 'บริเวณใกล้ถนนพหลโยธิน',
    },
  });

  // =========================================================
  // FOUND 1
  // ตั้งให้ใกล้ LOST 1
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: FOUND_POST_1_ID,
    },

    update: {},

    create: {
      id: FOUND_POST_1_ID,
      userId: user.id,

      type: PostType.FOUND,
      status: PostStatus.ACTIVE,

      petName: null,
      petType: PetType.CAT,

      breed: null,

      color: 'สีส้มลายแท็บบี้และสีขาว',

      distinctiveFeatures: 'มีขนสีขาวบริเวณรอบปากและจมูก สวมปลอกคอสีแดง',

      description:
        'แมวขนสั้นสีส้มลายแท็บบี้ มีขนสีขาวบริเวณรอบปากและจมูก และมีปลอกคอสีแดง',

      eventDate: new Date('2026-08-18T15:00:00+07:00'),

      latitude: 13.818,
      longitude: 100.562,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'ลาดยาว',

      locationDescription: 'พบใกล้บริเวณสวนจตุจักร',
    },
  });

  // =========================================================
  // FOUND 2
  // ตั้งให้ใกล้ LOST 2
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: FOUND_POST_2_ID,
    },

    update: {},

    create: {
      id: FOUND_POST_2_ID,
      userId: user.id,

      type: PostType.FOUND,
      status: PostStatus.ACTIVE,

      petName: null,
      petType: PetType.CAT,

      breed: null,

      color: 'สีขาวและเทา',

      distinctiveFeatures: 'มีลายสีเทาบริเวณศีรษะและลำตัว หางมีสีเข้ม',

      description:
        'แมวขนสั้นสีขาวและเทา มีลายสีเทาบริเวณศีรษะและลำตัว และมีหางสีเข้ม',

      eventDate: new Date('2026-08-18T09:00:00+07:00'),

      latitude: 13.807,
      longitude: 100.5515,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'จอมพล',

      locationDescription: 'พบใกล้ถนนพหลโยธิน',
    },
  });

  // =========================================================
  // POST IMAGES
  // =========================================================

  await prisma.postImage.upsert({
    where: {
      id: '51111111-1111-4111-8111-111111111111',
    },

    update: {
      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787091901/S__30564363_otkwzx.jpg',
    },

    create: {
      id: '51111111-1111-4111-8111-111111111111',
      postId: LOST_POST_1_ID,

      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787091901/S__30564363_otkwzx.jpg',

      sortOrder: 0,
    },
  });

  await prisma.postImage.upsert({
    where: {
      id: '52222222-2222-4222-8222-222222222222',
    },

    update: {
      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787084843/S__30474245_mqsg3s.jpg',
    },

    create: {
      id: '52222222-2222-4222-8222-222222222222',
      postId: LOST_POST_2_ID,

      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787084843/S__30474245_mqsg3s.jpg',

      sortOrder: 0,
    },
  });

  await prisma.postImage.upsert({
    where: {
      id: '53333333-3333-4333-8333-333333333333',
    },

    update: {
      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787091907/S__8069122_dtd5ye.jpg',
    },

    create: {
      id: '53333333-3333-4333-8333-333333333333',
      postId: FOUND_POST_1_ID,

      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787091907/S__8069122_dtd5ye.jpg',

      sortOrder: 0,
    },
  });

  await prisma.postImage.upsert({
    where: {
      id: '54444444-4444-4444-8444-444444444444',
    },

    update: {
      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787091896/S__30564361_xrd1da.jpg',
    },

    create: {
      id: '54444444-4444-4444-8444-444444444444',
      postId: FOUND_POST_2_ID,

      imageUrl:
        'https://res.cloudinary.com/k8pidopz/image/upload/v1787091896/S__30564361_xrd1da.jpg',

      sortOrder: 0,
    },
  });

  console.log('Seeded AI matching posts.');

  console.log({
    lostPost1: LOST_POST_1_ID,
    lostPost2: LOST_POST_2_ID,
    foundPost1: FOUND_POST_1_ID,
    foundPost2: FOUND_POST_2_ID,

    images: {
      lost1: '51111111-1111-4111-8111-111111111111',
      lost2: '52222222-2222-4222-8222-222222222222',
      found1: '53333333-3333-4333-8333-333333333333',
      found2: '54444444-4444-4444-8444-444444444444',
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
