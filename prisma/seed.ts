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
      await seedSamplePostImage(post.id);
      await seedSampleFlyers(post.id);
    } else {
      console.log(`Sample Lost Post ID: ${existingPost.id}`);
      await seedSamplePostImage(existingPost.id);
      await seedSampleFlyers(existingPost.id);
    }

    // Seed Sample Found Post
    const existingFoundPost = await prisma.petPost.findFirst({
      where: { userId: aliceUser.id, petName: 'Lucky' },
    });
    if (!existingFoundPost) {
      const foundPost = await prisma.petPost.create({
        data: {
          userId: aliceUser.id,
          type: PostType.FOUND,
          status: PostStatus.ACTIVE,
          petName: 'Lucky',
          petType: PetType.DOG,
          breed: 'Corgi',
          gender: PetGender.MALE,
          color: 'Brown & White',
          distinctiveFeatures: 'Short legs, heart-shaped pattern on back',
          description: 'Found wandering near BTS Ari Exit 3',
          eventDate: new Date('2026-08-18T10:00:00.000Z'),
          latitude: 13.7797,
          longitude: 100.5447,
          province: 'Bangkok',
          district: 'Phaya Thai',
          subdistrict: 'Sam Sen Nai',
          locationDescription: 'Near La Villa Ari',
          contactPhone: '0812345671',
        },
      });
      await prisma.postImage.create({
        data: {
          postId: foundPost.id,
          imageUrl:
            'https://images.unsplash.com/photo-1612536057832-2ff7ead58194?auto=format&fit=crop&w=800&q=80',
          sortOrder: 0,
        },
      });
      console.log(`Seeded Sample Found Post ID: ${foundPost.id}`);
    }

    // Seed Sample Reunited Post
    const existingReunitedPost = await prisma.petPost.findFirst({
      where: { userId: aliceUser.id, petName: 'Milo' },
    });
    if (!existingReunitedPost) {
      const reunitedPost = await prisma.petPost.create({
        data: {
          userId: aliceUser.id,
          type: PostType.LOST,
          status: PostStatus.REUNITED,
          petName: 'Milo',
          petType: PetType.CAT,
          breed: 'Scottish Fold',
          gender: PetGender.MALE,
          color: 'Gray Tabby',
          distinctiveFeatures: 'Folded ears, very friendly',
          description: 'Found and safely reunited with owner!',
          eventDate: new Date('2026-08-10T12:00:00.000Z'),
          reunitedAt: new Date('2026-08-19T14:30:00.000Z'),
          latitude: 18.7883,
          longitude: 98.9853,
          province: 'Chiang Mai',
          district: 'Mueang Chiang Mai',
          subdistrict: 'Si Phum',
          locationDescription: 'Near Tha Phae Gate',
        },
      });
      await prisma.postImage.create({
        data: {
          postId: reunitedPost.id,
          imageUrl:
            'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
          sortOrder: 0,
        },
      });
      console.log(`Seeded Sample Reunited Post ID: ${reunitedPost.id}`);
    }
  }

  await seedCredentialTestUser();
}

async function seedSamplePostImage(postId: string) {
  const existingImage = await prisma.postImage.findFirst({
    where: { postId },
  });

  if (!existingImage) {
    await prisma.postImage.create({
      data: {
        postId,
        imageUrl:
          'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
        sortOrder: 0,
      },
    });
    console.log(`Seeded sample PostImage for Post ID: ${postId}`);
  }
}

async function seedSampleFlyers(postId: string) {
  const existingCount = await prisma.flyer.count({
    where: { postId },
  });

  if (existingCount < 5) {
    const toCreate = 5 - existingCount;
    for (let i = 1; i <= toCreate; i++) {
      await prisma.flyer.create({
        data: {
          postId,
          fileUrl: `http://localhost:8000/posts/${postId}/flyer/download`,
          qrUrl: `https://res.cloudinary.com/odgwivn5/image/upload/v1787135607/pawnd/flyer-qr/${postId}.png`,
          generatedAt: new Date(Date.now() - (toCreate - i + 1) * 3600000),
        },
      });
    }
    console.log(`Seeded 5 sample Flyers for Post ID: ${postId}`);
  }
  console.log(
    `Total Flyer records for Post ID (${postId}): ${await prisma.flyer.count({ where: { postId } })}`,
  );
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
