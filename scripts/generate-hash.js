const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nAdd this to your .env.local file:');
  console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
}

generateHash();
