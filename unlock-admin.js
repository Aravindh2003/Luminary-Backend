import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function unlockAdmin() {
  try {
    console.log('🔓 Unlocking admin account...');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@luminary.com';
    
    const result = await prisma.user.update({
      where: { 
        email: adminEmail,
        role: 'ADMIN'
      },
      data: {
        loginAttempts: 0,
        lockedUntil: null
      }
    });

    console.log(`✅ Admin account unlocked successfully: ${result.email}`);
    console.log('🔑 You can now login with:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'AdminPassword123!'}`);
    
  } catch (error) {
    console.error('❌ Error unlocking admin account:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

unlockAdmin(); 