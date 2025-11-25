import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

const VALID_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2b$10$.ivLH4rIZpDKhbKuvRghneyhdOSmYDIAgn.PEastj/ukf0niWiAT6',
};

const handler = NextAuth({
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

        if (credentials.username !== VALID_CREDENTIALS.username) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          VALID_CREDENTIALS.passwordHash
        );

        if (!isValid) {
          return null;
        }

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
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
  },
  useSecureCookies: true,
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-min-32-characters-long',
});

export { handler as GET, handler as POST };
