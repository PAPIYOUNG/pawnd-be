import 'dotenv/config';

import {
  PetGender,
  PetType,
  PostStatus,
  PostType,
  PrismaClient,
  UserStatus,
} from '@/database/generated/prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;

// =========================================================
// TYPES
// =========================================================

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

// =========================================================
// USERS + PETS
// =========================================================

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

// =========================================================
// AI MATCHING TEST IDS
// =========================================================

const TEST_POST_IDS = {
  mawinLost: '11111111-1111-4111-8111-111111111111',
  strayFound: '22222222-2222-4222-8222-222222222222',
  summerLost: '33333333-3333-4333-8333-333333333333',
  summerFound: '44444444-4444-4444-8444-444444444444',
};

const TEST_IMAGE_IDS = {
  mawin: '53333333-3333-4333-8333-333333333333',
  stray: '51111111-1111-4111-8111-111111111111',

  summerLost1: '52222222-2222-4222-8222-222222222222',
  summerLost2: '55555555-5555-4555-8555-555555555555',

  summerFound: '54444444-4444-4444-8444-444444444444',
};

// =========================================================
// MAIN
// =========================================================

async function main() {
  await seedUsersAndPets();
  await seedCredentialTestUser();
  await seedAiMatchingPosts();

  console.log('✅ Database seed completed');
}

// =========================================================
// USERS + PETS
// =========================================================

async function seedUsersAndPets() {
  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  for (const userData of users) {
    const { pets, ...userFields } = userData;

    const user = await prisma.user.upsert({
      where: {
        email: userFields.email,
      },

      update: {
        firstName: userFields.firstName,
        lastName: userFields.lastName,
        phone: userFields.phone,
        status: UserStatus.ACTIVE,
      },

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

      if (existingPet) {
        await prisma.pet.update({
          where: {
            id: existingPet.id,
          },

          data: {
            type: pet.type,
            breed: pet.breed,
            gender: pet.gender,
            color: pet.color,
            age: pet.age,
          },
        });

        continue;
      }

      await prisma.pet.create({
        data: {
          ...pet,
          ownerId: user.id,
        },
      });
    }
  }

  console.log(
    `✅ Seeded ${users.length} users and ${
      users.flatMap((user) => user.pets).length
    } pets`,
  );
}

// =========================================================
// CREDENTIAL TEST USER
// =========================================================

async function seedCredentialTestUser() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.log('⏭️ Skipped credential test user');

    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.upsert({
    where: {
      email,
    },

    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
    },

    create: {
      firstName: 'Test',
      lastName: 'User',
      email,
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`✅ Seeded credential test user: ${email}`);
}

// =========================================================
// AI MATCHING POSTS
// =========================================================

async function seedAiMatchingPosts() {
  const owner = await prisma.user.findUnique({
    where: {
      email: 'alice.nguyen@example.com',
    },
  });

  if (!owner) {
    throw new Error('AI matching seed owner not found');
  }

  const postIds = Object.values(TEST_POST_IDS);

  // =========================================================
  // CLEAN OLD AI MATCH RESULTS
  // =========================================================

  await prisma.aiMatch.deleteMany({
    where: {
      OR: [
        {
          lostPostId: {
            in: postIds,
          },
        },
        {
          foundPostId: {
            in: postIds,
          },
        },
      ],
    },
  });

  // =========================================================
  // POST 1 - LOST - มาวิน
  // สีส้มอ่อน
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: TEST_POST_IDS.mawinLost,
    },

    update: {
      userId: owner.id,

      type: PostType.LOST,
      status: PostStatus.ACTIVE,

      petName: 'มาวิน',
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีส้มอ่อน',

      distinctiveFeatures: 'ขนสีส้มอ่อน มีขนสีขาวบริเวณใบหน้าและลำตัว',

      description: 'แมวขนสีส้มอ่อน มีขนสีขาวบริเวณใบหน้าและลำตัว',

      eventDate: new Date('2026-08-18T10:00:00+07:00'),

      latitude: 13.8165,
      longitude: 100.5612,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'ลาดยาว',

      locationDescription: 'บริเวณใกล้สวนจตุจักร',
    },

    create: {
      id: TEST_POST_IDS.mawinLost,

      userId: owner.id,

      type: PostType.LOST,
      status: PostStatus.ACTIVE,

      petName: 'มาวิน',
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีส้มอ่อน',

      distinctiveFeatures: 'ขนสีส้มอ่อน มีขนสีขาวบริเวณใบหน้าและลำตัว',

      description: 'แมวขนสีส้มอ่อน มีขนสีขาวบริเวณใบหน้าและลำตัว',

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
  // POST 2 - FOUND - แมวจร
  // สีสลิด
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: TEST_POST_IDS.strayFound,
    },

    update: {
      userId: owner.id,

      type: PostType.FOUND,
      status: PostStatus.ACTIVE,

      petName: null,
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีสลิด',

      distinctiveFeatures: 'ขนสั้นลายสลิด มีลายเข้มบริเวณลำตัว ใบหน้า และขา',

      description: 'แมวจรขนสั้นสีสลิด มีลายเข้มบริเวณลำตัว ใบหน้า และขา',

      eventDate: new Date('2026-08-18T13:00:00+07:00'),

      latitude: 13.83,
      longitude: 100.57,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'เสนานิคม',

      locationDescription: 'พบในพื้นที่จตุจักร',
    },

    create: {
      id: TEST_POST_IDS.strayFound,

      userId: owner.id,

      type: PostType.FOUND,
      status: PostStatus.ACTIVE,

      petName: null,
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีสลิด',

      distinctiveFeatures: 'ขนสั้นลายสลิด มีลายเข้มบริเวณลำตัว ใบหน้า และขา',

      description: 'แมวจรขนสั้นสีสลิด มีลายเข้มบริเวณลำตัว ใบหน้า และขา',

      eventDate: new Date('2026-08-18T13:00:00+07:00'),

      latitude: 13.83,
      longitude: 100.57,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'เสนานิคม',

      locationDescription: 'พบในพื้นที่จตุจักร',
    },
  });

  // =========================================================
  // POST 3 - LOST - ซัมเมอ
  // มี 2 รูป
  // Ground Truth คู่กับ POST 4
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: TEST_POST_IDS.summerLost,
    },

    update: {
      userId: owner.id,

      type: PostType.LOST,
      status: PostStatus.ACTIVE,

      petName: 'ซัมเมอ',
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีส้มและขาว',

      distinctiveFeatures:
        'มีขนสีขาวบริเวณรอบปากและจมูก มีลายสีส้มบริเวณศีรษะและลำตัว',

      description:
        'แมวขนสั้นสีส้มและขาว มีขนสีขาวบริเวณรอบปากและจมูก และมีลายสีส้มบริเวณศีรษะและลำตัว',

      eventDate: new Date('2026-08-18T09:00:00+07:00'),

      latitude: 13.807,
      longitude: 100.5515,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'จอมพล',

      locationDescription: 'หายบริเวณถนนพหลโยธิน',
    },

    create: {
      id: TEST_POST_IDS.summerLost,

      userId: owner.id,

      type: PostType.LOST,
      status: PostStatus.ACTIVE,

      petName: 'ซัมเมอ',
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีส้มและขาว',

      distinctiveFeatures:
        'มีขนสีขาวบริเวณรอบปากและจมูก มีลายสีส้มบริเวณศีรษะและลำตัว',

      description:
        'แมวขนสั้นสีส้มและขาว มีขนสีขาวบริเวณรอบปากและจมูก และมีลายสีส้มบริเวณศีรษะและลำตัว',

      eventDate: new Date('2026-08-18T09:00:00+07:00'),

      latitude: 13.807,
      longitude: 100.5515,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'จอมพล',

      locationDescription: 'หายบริเวณถนนพหลโยธิน',
    },
  });

  // =========================================================
  // POST 4 - FOUND - ซัมเมอ
  // Ground Truth คู่กับ POST 3
  // =========================================================

  await prisma.petPost.upsert({
    where: {
      id: TEST_POST_IDS.summerFound,
    },

    update: {
      userId: owner.id,

      type: PostType.FOUND,
      status: PostStatus.ACTIVE,

      petName: null,
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีส้มและขาว',

      distinctiveFeatures:
        'มีขนสีขาวบริเวณรอบปากและจมูก มีลายสีส้มบริเวณศีรษะและลำตัว',

      description:
        'แมวขนสั้นสีส้มและขาว มีขนสีขาวบริเวณรอบปากและจมูก และมีลายสีส้มบริเวณศีรษะและลำตัว',

      eventDate: new Date('2026-08-18T12:00:00+07:00'),

      latitude: 13.8075,
      longitude: 100.552,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'จอมพล',

      locationDescription: 'พบใกล้บริเวณถนนพหลโยธิน',
    },

    create: {
      id: TEST_POST_IDS.summerFound,

      userId: owner.id,

      type: PostType.FOUND,
      status: PostStatus.ACTIVE,

      petName: null,
      petType: PetType.CAT,

      breed: null,
      gender: null,

      color: 'สีส้มและขาว',

      distinctiveFeatures:
        'มีขนสีขาวบริเวณรอบปากและจมูก มีลายสีส้มบริเวณศีรษะและลำตัว',

      description:
        'แมวขนสั้นสีส้มและขาว มีขนสีขาวบริเวณรอบปากและจมูก และมีลายสีส้มบริเวณศีรษะและลำตัว',

      eventDate: new Date('2026-08-18T12:00:00+07:00'),

      latitude: 13.8075,
      longitude: 100.552,

      province: 'กรุงเทพมหานคร',
      district: 'จตุจักร',
      subdistrict: 'จอมพล',

      locationDescription: 'พบใกล้บริเวณถนนพหลโยธิน',
    },
  });

  // =========================================================
  // POST IMAGES
  // =========================================================

  // ---------------------------------------------------------
  // มาวิน LOST
  // ---------------------------------------------------------

  await upsertPostImage({
    id: TEST_IMAGE_IDS.mawin,

    postId: TEST_POST_IDS.mawinLost,

    imageUrl:
      'https://res.cloudinary.com/k8pidopz/image/upload/v1787091907/S__8069122_dtd5ye.jpg',

    sortOrder: 0,
  });

  // ---------------------------------------------------------
  // แมวจร FOUND
  // ---------------------------------------------------------

  await upsertPostImage({
    id: TEST_IMAGE_IDS.stray,

    postId: TEST_POST_IDS.strayFound,

    imageUrl:
      'https://res.cloudinary.com/k8pidopz/image/upload/v1787091901/S__30564363_otkwzx.jpg',

    sortOrder: 0,
  });

  // ---------------------------------------------------------
  // ซัมเมอ LOST - รูปที่ 1
  // ---------------------------------------------------------

  await upsertPostImage({
    id: TEST_IMAGE_IDS.summerLost1,

    postId: TEST_POST_IDS.summerLost,

    imageUrl:
      'https://res.cloudinary.com/k8pidopz/image/upload/v1787084843/S__30474245_mqsg3s.jpg',

    sortOrder: 0,
  });

  // ---------------------------------------------------------
  // ซัมเมอ LOST - รูปที่ 2
  // ---------------------------------------------------------

  await upsertPostImage({
    id: TEST_IMAGE_IDS.summerLost2,

    postId: TEST_POST_IDS.summerLost,

    imageUrl:
      'https://res.cloudinary.com/k8pidopz/image/upload/v1787131810/S__30629891_g5sde6.jpg',

    sortOrder: 1,
  });

  // ---------------------------------------------------------
  // ซัมเมอ FOUND
  // ---------------------------------------------------------

  await upsertPostImage({
    id: TEST_IMAGE_IDS.summerFound,

    postId: TEST_POST_IDS.summerFound,

    imageUrl:
      'https://res.cloudinary.com/k8pidopz/image/upload/v1787091896/S__30564361_xrd1da.jpg',

    sortOrder: 0,
  });

  console.log('✅ Seeded AI matching test data');

  console.log({
    posts: {
      mawinLost: TEST_POST_IDS.mawinLost,

      strayFound: TEST_POST_IDS.strayFound,

      summerLost: TEST_POST_IDS.summerLost,

      summerFound: TEST_POST_IDS.summerFound,
    },

    images: {
      mawin: TEST_IMAGE_IDS.mawin,

      stray: TEST_IMAGE_IDS.stray,

      summerLost1: TEST_IMAGE_IDS.summerLost1,

      summerLost2: TEST_IMAGE_IDS.summerLost2,

      summerFound: TEST_IMAGE_IDS.summerFound,
    },

    expectedGroundTruth: {
      lostPostId: TEST_POST_IDS.summerLost,

      foundPostId: TEST_POST_IDS.summerFound,
    },
  });
}

// =========================================================
// POST IMAGE HELPER
// =========================================================

async function upsertPostImage(input: {
  id: string;
  postId: string;
  imageUrl: string;
  sortOrder: number;
}) {
  await prisma.postImage.upsert({
    where: {
      id: input.id,
    },

    update: {
      postId: input.postId,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    },

    create: {
      id: input.id,
      postId: input.postId,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    },
  });
}

// =========================================================
// RUN
// =========================================================

main()
  .catch((error) => {
    console.error('❌ Seed failed');
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
