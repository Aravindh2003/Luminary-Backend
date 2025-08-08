import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('🌱 Starting database seeding...');

    // Create admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@luminary.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
    
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          isVerified: true,
          isActive: true,
          preferences: {}
        }
      });

      logger.info(`✅ Admin user created: ${admin.email}`);
    } else {
      logger.info(`ℹ️ Admin user already exists: ${adminEmail}`);
    }

    // Create sample parent users
    const sampleParents = [
      {
        email: 'parent1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      },
      {
        email: 'parent2@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1234567891'
      }
    ];

    for (const parentData of sampleParents) {
      const existingParent = await prisma.user.findUnique({
        where: { email: parentData.email }
      });

      if (!existingParent) {
        const hashedPassword = await bcrypt.hash('Password123!', 12);
        
        const parent = await prisma.user.create({
          data: {
            ...parentData,
            password: hashedPassword,
            role: 'PARENT',
            isVerified: true,
            isActive: true,
            preferences: {}
          }
        });

        logger.info(`✅ Sample parent created: ${parent.email}`);
      }
    }

    // Create sample coach applications
    const sampleCoaches = [
      {
        user: {
          email: 'coach1@example.com',
          firstName: 'Sarah',
          lastName: 'Johnson',
          phone: '+1555123456'
        },
        coach: {
          domain: 'Mathematics',
          experienceDescription: 'I have been teaching mathematics for over 8 years, specializing in algebra, calculus, and geometry. I hold a Master\'s degree in Mathematics Education and have helped hundreds of students improve their math skills.',
          address: '123 Oak Street, New York, NY 10001',
          languages: ['English', 'Spanish'],
          hourlyRate: 45.00,
          bio: 'Passionate mathematics educator with a proven track record of helping students achieve their academic goals.',
          education: [
            {
              degree: 'Master of Mathematics Education',
              institution: 'Columbia University',
              year: '2015'
            },
            {
              degree: 'Bachelor of Science in Mathematics',
              institution: 'NYU',
              year: '2013'
            }
          ],
          certifications: [
            {
              name: 'Certified Mathematics Teacher',
              issuer: 'New York State Education Department',
              year: '2015'
            }
          ],
          specializations: ['Algebra', 'Calculus', 'Geometry', 'SAT Math Prep'],
          status: 'PENDING'
        }
      },
      {
        user: {
          email: 'coach2@example.com',
          firstName: 'Michael',
          lastName: 'Chen',
          phone: '+1555123457'
        },
        coach: {
          domain: 'Computer Science',
          experienceDescription: 'Software engineer turned educator with 10+ years in the tech industry and 5 years teaching programming. I specialize in Python, JavaScript, and web development, making complex concepts accessible to beginners.',
          address: '456 Pine Avenue, San Francisco, CA 94102',
          languages: ['English', 'Mandarin'],
          hourlyRate: 60.00,
          bio: 'Former Google engineer passionate about teaching the next generation of programmers.',
          education: [
            {
              degree: 'Master of Computer Science',
              institution: 'Stanford University',
              year: '2012'
            }
          ],
          certifications: [
            {
              name: 'AWS Certified Solutions Architect',
              issuer: 'Amazon Web Services',
              year: '2020'
            }
          ],
          specializations: ['Python', 'JavaScript', 'Web Development', 'Data Structures'],
          status: 'APPROVED'
        }
      },
      {
        user: {
          email: 'coach3@example.com',
          firstName: 'Emily',
          lastName: 'Rodriguez',
          phone: '+1555123458'
        },
        coach: {
          domain: 'English Literature',
          experienceDescription: 'English Literature professor with a PhD in Victorian Literature. I have been teaching for 12 years and specialize in creative writing, literary analysis, and essay composition. I believe in making literature accessible and engaging for all students.',
          address: '789 Maple Drive, Chicago, IL 60601',
          languages: ['English', 'French', 'Spanish'],
          hourlyRate: 50.00,
          bio: 'Literature enthusiast dedicated to fostering a love of reading and writing in students.',
          education: [
            {
              degree: 'PhD in English Literature',
              institution: 'University of Chicago',
              year: '2010'
            }
          ],
          certifications: [
            {
              name: 'Advanced Teaching Certificate',
              issuer: 'Illinois State Board of Education',
              year: '2011'
            }
          ],
          specializations: ['Creative Writing', 'Literary Analysis', 'Essay Writing', 'AP English'],
          status: 'PENDING'
        }
      },
      {
        user: {
          email: 'coach4@example.com',
          firstName: 'David',
          lastName: 'Thompson',
          phone: '+1555123459'
        },
        coach: {
          domain: 'Physics',
          experienceDescription: 'Physics researcher and educator with 15 years of experience. I hold a PhD in Theoretical Physics and have published numerous papers. I enjoy breaking down complex physics concepts into understandable lessons.',
          address: '321 Elm Street, Boston, MA 02101',
          languages: ['English'],
          hourlyRate: 55.00,
          bio: 'Research physicist passionate about making physics accessible to students of all levels.',
          education: [
            {
              degree: 'PhD in Theoretical Physics',
              institution: 'MIT',
              year: '2008'
            }
          ],
          certifications: [
            {
              name: 'Physics Education Research Certificate',
              issuer: 'American Physical Society',
              year: '2015'
            }
          ],
          specializations: ['Mechanics', 'Thermodynamics', 'Quantum Physics', 'AP Physics'],
          status: 'REJECTED',
          rejectionReason: 'Insufficient teaching experience documentation provided'
        }
      }
    ];

    for (const coachData of sampleCoaches) {
      const existingUser = await prisma.user.findUnique({
        where: { email: coachData.user.email }
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash('Password123!', 12);
        
        // Create user and coach in transaction
        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              ...coachData.user,
              password: hashedPassword,
              role: 'COACH',
              isVerified: true,
              isActive: true,
              preferences: {}
            }
          });

          const coach = await tx.coach.create({
            data: {
              userId: user.id,
              ...coachData.coach,
              availability: {},
              education: coachData.coach.education || [],
              certifications: coachData.coach.certifications || [],
              specializations: coachData.coach.specializations || []
            }
          });

          return { user, coach };
        });

        logger.info(`✅ Sample coach created: ${result.user.email} (${result.coach.status})`);
      }
    }

    // Create sample courses for approved coaches
    const approvedCoaches = await prisma.coach.findMany({
      where: { status: 'APPROVED' },
      include: { user: true }
    });

    const sampleCourses = [
      {
        title: 'Python Programming for Beginners',
        description: 'Learn Python programming from scratch with hands-on projects and real-world examples.',
        category: 'Programming',
        level: 'BEGINNER',
        duration: 60,
        price: 60.00,
        materials: [
          { type: 'pdf', name: 'Python Basics Guide', url: 'https://example.com/python-guide.pdf' },
          { type: 'video', name: 'Setup Tutorial', url: 'https://example.com/setup-video.mp4' }
        ]
      },
      {
        title: 'Advanced JavaScript Concepts',
        description: 'Master advanced JavaScript concepts including closures, promises, and async/await.',
        category: 'Programming',
        level: 'ADVANCED',
        duration: 90,
        price: 75.00,
        materials: [
          { type: 'pdf', name: 'JavaScript Advanced Guide', url: 'https://example.com/js-advanced.pdf' }
        ]
      }
    ];

    for (const coach of approvedCoaches) {
      if (coach.domain === 'Computer Science') {
        for (const courseData of sampleCourses) {
          const existingCourse = await prisma.course.findFirst({
            where: {
              coachId: coach.userId,
              title: courseData.title
            }
          });

          if (!existingCourse) {
            const course = await prisma.course.create({
              data: {
                ...courseData,
                coachId: coach.userId
              }
            });

            logger.info(`✅ Sample course created: ${course.title} by ${coach.user.firstName} ${coach.user.lastName}`);
          }
        }
      }
    }

    logger.info('🎉 Database seeding completed successfully!');
    
    // Log important information
    logger.info('\n📋 Seeded Data Summary:');
    logger.info(`👨‍💼 Admin User: ${adminEmail} / ${adminPassword}`);
    logger.info('👨‍👩‍👧‍👦 Sample Parents: parent1@example.com, parent2@example.com');
    logger.info('👨‍🏫 Sample Coaches: coach1@example.com (PENDING), coach2@example.com (APPROVED), coach3@example.com (PENDING), coach4@example.com (REJECTED)');
    logger.info('📚 Sample Courses: Created for approved coaches');
    // --- Create a sample session for the first course and parent ---
    const sampleCourse = await prisma.course.findFirst({});
    const sampleCoach = await prisma.user.findFirst({ where: { email: 'coach2@example.com' } });
    const sampleParent = await prisma.user.findFirst({ where: { email: 'parent1@example.com' } });

    if (sampleCourse && sampleCoach && sampleParent) {
      const sessionExists = await prisma.session.findFirst({
        where: {
          courseId: sampleCourse.id,
          coachId: sampleCoach.id,
          studentId: sampleParent.id
        }
      });
      if (!sessionExists) {
        const now = new Date();
        const end = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later
        await prisma.session.create({
          data: {
            courseId: sampleCourse.id,
            coachId: sampleCoach.id,
            studentId: sampleParent.id,
            title: 'Sample Session: Python Programming',
            description: 'This is a sample session for testing payments and booking.',
            startTime: now,
            endTime: end,
            duration: 60,
            status: 'SCHEDULED',
            notes: 'Seeded session.'
          }
        });
        logger.info('✅ Sample session created for course, coach, and parent.');
      } else {
        logger.info('ℹ️ Sample session already exists.');
      }
    } else {
      logger.warn('⚠️ Could not create sample session: missing course, coach, or parent.');
    }
    logger.info('\n🔑 All sample users have password: Password123!');

    // Print the first course and session IDs for user reference
    const firstCourse = await prisma.course.findFirst();
    const firstSession = await prisma.session.findFirst();
    if (firstCourse) {
      console.log('Sample Course ID:', firstCourse.id);
    } else {
      console.log('No course found.');
    }
    if (firstSession) {
      console.log('Sample Session ID:', firstSession.id);
    } else {
      console.log('No session found.');
    }

  } catch (error) {
    logger.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
