import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Define the user credentials here
// In production, you should store these in a database
const VALID_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  // Password: 'admin123' (hashed with bcrypt)
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2b$10$.ivLH4rIZpDKhbKuvRghneyhdOSmYDIAgn.PEastj/ukf0niWiAT6',
};

export const authConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'admin' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Check username
        if (credentials.username !== VALID_CREDENTIALS.username) {
          return null;
        }

        // Check password (compare with hash)
        const isValid = await bcrypt.compare(
          credentials.password as string,
          VALID_CREDENTIALS.passwordHash
        );

        if (!isValid) {
          return null;
        }

        // Return user object
        return {
          id: '1',
          name: credentials.username as string,
          email: `${credentials.username}@mena-decoder.local`,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-min-32-characters-long',
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
