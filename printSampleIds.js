const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.findFirst();
  const session = await prisma.session.findFirst();
  if (course) {
    console.log('Sample Course ID:', course.id);
  } else {
    console.log('No course found.');
  }
  if (session) {
    console.log('Sample Session ID:', session.id);
  } else {
    console.log('No session found.');
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });