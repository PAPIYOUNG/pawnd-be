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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
      where: { email: userFields.email },
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
        where: { ownerId: user.id, name: pet.name },
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
    `Seeded ${users.length} users with ${users.flatMap((u) => u.pets).length} pets.`,
  );

  // Seed sample post for testing
  const aliceUser = await prisma.user.findUnique({
    where: { email: 'alice.nguyen@example.com' },
    include: { pets: true },
  });

  if (aliceUser && aliceUser.pets.length > 0) {
    const bellaPet = aliceUser.pets.find((p) => p.name === 'Bella');
    const existingPost = await prisma.petPost.findFirst({
      where: { userId: aliceUser.id, petName: 'Bella' },
    });

    if (!existingPost) {
      const post = await prisma.petPost.create({
        data: {
          userId: aliceUser.id,
          petId: bellaPet?.id ?? null,
          type: PostType.LOST,
          status: PostStatus.ACTIVE,
          petName: 'Bella',
          petType: PetType.DOG,
          breed: 'Golden Retriever',
          gender: PetGender.FEMALE,
          color: 'Golden',
          distinctiveFeatures: 'Wearing red collar with bell',
          description: 'Lost near Chatuchak Park around 5 PM.',
          eventDate: new Date('2026-08-15T17:00:00.000Z'),
          latitude: 13.803444,
          longitude: 100.553444,
          province: 'Bangkok',
          district: 'Chatuchak',
          subdistrict: 'Chatuchak',
          locationDescription: 'Near MRT Chatuchak Park Exit 1',
          rewardAmount: 5000,
          contactPhone: '0812345671',
          contactLineId: 'alice_pawnd',
          contactEmail: 'alice.nguyen@example.com',
        },
      });

      console.log(`Seeded Sample Lost Post ID: ${post.id}`);
    } else {
      console.log(`Sample Lost Post ID: ${existingPost.id}`);
    }
  }

  await seedCredentialTestUser();
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
    where: { email },
    update: { passwordHash: testPasswordHash },
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
