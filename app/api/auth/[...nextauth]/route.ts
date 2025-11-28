import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Multi-user credentials store
const VALID_USERS: Record<string, { email: string; passwordHash: string }> = {
  'admin': {
    email: 'admin@mena-decoder.local',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2b$10$.ivLH4rIZpDKhbKuvRghneyhdOSmYDIAgn.PEastj/ukf0niWiAT6',
  },
  'amartinez': {
    email: 'alvaro.martinez@talabat.com',
    passwordHash: '$2b$10$5MhjijVobW24oeu6R9IO8e4gFqPG4D.Z6uWYVguTrMY8uaRo9mDjW',
  },
  'aelhamawi': {
    email: 'ahmad.elhamawi@talabat.com',
    passwordHash: '$2b$10$.f5THn.zFLruvR9XnuavQ.TC/7Kk4HQGrmO0UqJu7JD2S9jp9SQR.',
  },
  'zbashir': {
    email: 'zain.bashir@talabat.com',
    passwordHash: '$2b$10$cXi4oPXs4WNCLXAnDjtD6ejJT5pB3BBiS9Mdc7oSCtQocspg1gDBq',
  },
  'cschmidt': {
    email: 'claudia.schmidt@talabat.com',
    passwordHash: '$2b$10$F.57H4Fl2yGtJoH3tQcYyu412iiO.HYT9I7W2io.3JzQv0YDdqVRG',
  },
  'ssubotic': {
    email: 'simonida.subotic@talabat.com',
    passwordHash: '$2b$10$mRuPawTQNfr4t9t.WOnZDeRd6C0MUPoDrvjxhF7RHay5E.i.411oa',
  },
  'gsimic': {
    email: 'Galina.simic@talabat.com',
    passwordHash: '$2b$10$xjUzFmIPzcpzAdPsti1vd.5WEG91Gyq08OHH/ce5KDY29c5z3Ylr6',
  },
  'agabr': {
    email: 'abdelmonem.gabr@talabat.com',
    passwordHash: '$2b$10$/dVxWycmVnYHjGjyiWRj2OJUrhaGZZjRFL87nyCKEsJGHkeHF1n6a',
  },
};

const handler = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'username' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Look up user in VALID_USERS
        const user = VALID_USERS[credentials.username as string];
        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: credentials.username as string,
          name: credentials.username as string,
          email: user.email,
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
