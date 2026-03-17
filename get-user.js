import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('USER_EMAIL=' + users[0]?.email);
  await prisma.$disconnect();
}
main();
