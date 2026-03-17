import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing connection to Supabase...');
    const users = await prisma.user.findMany();
    console.log('Connection successful!');
    console.log('Users found:', users.length);
    users.forEach(u => console.log('Email:', u.email));
  } catch (e) {
    console.error('Connection failed:');
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
