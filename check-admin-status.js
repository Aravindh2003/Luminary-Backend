import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminStatus() {
  try {
    console.log('🔍 Checking admin account status...');
    
    const admins = await prisma.user.findMany({
      where: { 
        role: 'ADMIN'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        loginAttempts: true,
        lockedUntil: true,
        isActive: true,
        isVerified: true
      }
    });

    console.log(`📊 Found ${admins.length} admin account(s):`);
    
    admins.forEach((admin, index) => {
      const isLocked = admin.lockedUntil && admin.lockedUntil > new Date();
      const lockTimeRemaining = isLocked 
        ? Math.ceil((admin.lockedUntil - new Date()) / (1000 * 60))
        : 0;
      
      console.log(`\n${index + 1}. ${admin.email}`);
      console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
      console.log(`   Login Attempts: ${admin.loginAttempts}`);
      console.log(`   Locked: ${isLocked ? `Yes (${lockTimeRemaining} minutes remaining)` : 'No'}`);
      console.log(`   Active: ${admin.isActive ? 'Yes' : 'No'}`);
      console.log(`   Verified: ${admin.isVerified ? 'Yes' : 'No'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking admin status:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminStatus(); 