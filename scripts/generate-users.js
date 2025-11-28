const bcrypt = require('bcryptjs');

// User emails to process
const emails = [
  'alvaro.martinez@talabat.com',
  'ahmad.elhamawi@talabat.com',
  'zain.bashir@talabat.com',
  'claudia.schmidt@talabat.com',
  'simonida.subotic@talabat.com',
  'Galina.simic@talabat.com',
  'abdelmonem.gabr@talabat.com',
];

// Generate a random 3-digit number
function randomDigits() {
  return Math.floor(100 + Math.random() * 900).toString();
}

async function generateUsers() {
  console.log('Generating user credentials...\n');
  console.log('='.repeat(80));

  const users = [];

  for (const email of emails) {
    // Parse email: firstname.surname@domain
    const [localPart] = email.split('@');
    const [firstName, surname] = localPart.split('.');

    // Username: first initial + surname (lowercase)
    const username = (firstName[0] + surname).toLowerCase();

    // Password: firstname + 3 random digits
    const password = firstName.toLowerCase() + randomDigits();

    // Generate bcrypt hash
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    users.push({
      email,
      username,
      password,
      hash,
    });

    console.log(`\nEmail: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📋 USERS OBJECT FOR AUTH CONFIG:\n');

  // Output the users object for the auth config
  console.log('const VALID_USERS: Record<string, { email: string; passwordHash: string }> = {');
  for (const user of users) {
    console.log(`  '${user.username}': {`);
    console.log(`    email: '${user.email}',`);
    console.log(`    passwordHash: '${user.hash}',`);
    console.log(`  },`);
  }
  console.log('};');

  console.log('\n' + '='.repeat(80));
  console.log('\n📧 CREDENTIALS TO SHARE WITH USERS:\n');

  // Output a nice table for sharing
  console.log('| Email | Username | Password |');
  console.log('|-------|----------|----------|');
  for (const user of users) {
    console.log(`| ${user.email} | ${user.username} | ${user.password} |`);
  }

  return users;
}

generateUsers();
