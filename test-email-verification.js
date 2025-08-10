import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/v1';

// Test data
const testEmail = 'test@example.com';
const testUserData = {
  firstName: 'Test',
  lastName: 'User',
  email: testEmail,
  phone: '+1234567890',
  password: 'TestPassword123!'
};

async function testEmailVerificationFlow() {
  console.log('🧪 Testing Email Verification Flow with Brevo/Sendinblue\n');

  try {
    // Step 1: Register a parent (should trigger email verification)
    console.log('1️⃣ Testing Parent Registration...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register/parent`, testUserData);
    console.log('✅ Registration Response:', {
      success: registerResponse.data.success,
      message: registerResponse.data.message,
      requiresVerification: registerResponse.data.data?.requiresVerification,
      userEmail: registerResponse.data.data?.user?.email,
      isVerified: registerResponse.data.data?.user?.isVerified
    });

    if (!registerResponse.data.data?.requiresVerification) {
      console.log('❌ Expected requiresVerification to be true');
      return;
    }

    // Step 2: Request verification code
    console.log('\n2️⃣ Testing Request Verification Code...');
    const codeResponse = await axios.post(`${BASE_URL}/auth/request-verification-code`, {
      email: testEmail,
      userType: 'parent'
    });
    console.log('✅ Verification Code Response:', {
      success: codeResponse.data.success,
      message: codeResponse.data.message
    });

    // Step 3: Check verification status
    console.log('\n3️⃣ Testing Verification Status Check...');
    const statusResponse = await axios.get(`${BASE_URL}/auth/verification-status/${encodeURIComponent(testEmail)}`);
    console.log('✅ Status Response:', {
      success: statusResponse.data.success,
      email: statusResponse.data.data.email,
      isVerified: statusResponse.data.data.isVerified,
      firstName: statusResponse.data.data.firstName
    });

    // Step 4: Test invalid verification code
    console.log('\n4️⃣ Testing Invalid Verification Code...');
    try {
      await axios.post(`${BASE_URL}/auth/verify-email-code`, {
        email: testEmail,
        code: '000000'
      });
      console.log('❌ Expected invalid code to fail');
    } catch (error) {
      console.log('✅ Invalid Code Response:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
    }

    // Step 5: Test resend verification code
    console.log('\n5️⃣ Testing Resend Verification Code...');
    const resendResponse = await axios.post(`${BASE_URL}/auth/resend-verification-code`, {
      email: testEmail,
      userType: 'parent'
    });
    console.log('✅ Resend Response:', {
      success: resendResponse.data.success,
      message: resendResponse.data.message
    });

    // Step 6: Test login with unverified email
    console.log('\n6️⃣ Testing Login with Unverified Email...');
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: testEmail,
        password: testUserData.password
      });
      console.log('❌ Expected login to fail for unverified email');
    } catch (error) {
      console.log('✅ Login Blocked Response:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
    }

    console.log('\n🎉 Email Verification Flow Test Completed!');
    console.log('\n📝 Manual Steps Required:');
    console.log('1. Check your email service logs for verification codes');
    console.log('2. Use a valid verification code to test successful verification');
    console.log('3. Test login after successful email verification');

  } catch (error) {
    console.error('❌ Test Error:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
  }
}

// Run the test
testEmailVerificationFlow();
