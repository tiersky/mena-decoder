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
  'sshamiyeh': {
    email: 'sara.shamiyeh@talabat.com',
    passwordHash: '$2b$10$PCyTfZP9y7nXj.0z2i7woexJwo/B.fqhyuy9KGXI6ZVBuxHqsM5fm',
  },
  'mhaji': {
    email: 'mare.haji@talabat.com',
    passwordHash: '$2b$10$PxLmlh6MkI8NEYqg8jG15ueKQ.CAPKvY4hHju3AL6qf0snz1BKkL.',
  },
  'hibrahiem': {
    email: 'honida.ibrahiem@talabat.com',
    passwordHash: '$2b$10$rymobmrdZOY5h0aXDIU79ebufeXENfc54XyOp3dRtYqvNfZsTn5iS',
  },
  'arefaat': {
    email: 'ahmed.refaat@talabat.com',
    passwordHash: '$2b$10$vkOATZJtbisOAl70BGZbqekSTpRZAvtH50qWmMqOhp8ijAQAni196',
  },
  'kfouad': {
    email: 'karim.fouad@talabat.com',
    passwordHash: '$2b$10$6w5BmhKbkv2c1mpxk14dHee2dQZ7KzyPMMgE5wbgYCcDXlZxF.G9C',
  },
  'melhamy': {
    email: 'Mahmoud.elhamy@talabat.com',
    passwordHash: '$2b$10$D6a27Hc1GVIwapaZbFjW.uEVC7eVglU6VfOJiXcRg32do8xeC0LGO',
  },
  'aashraf': {
    email: 'amr.ashraf@talabat.com',
    passwordHash: '$2b$10$0XV1Eb8Ug3sR0paYyyh4COYktRooLoCLE21pae8UJCPuCmNfeJfWy',
  },
  'aabbas': {
    email: 'ahmad.d.abbas@talabat.com',
    passwordHash: '$2b$10$tjHf9d9UJEXsCLSHE0I9Fe0quX8ZeYnVnfTu1MfYa1fiPoG7Zyaae',
  },
  'salwahaibi': {
    email: 'suha.alwahaibi@talabat.com',
    passwordHash: '$2b$10$JxzdHNSoZAyjIfUT5C2.2uHacgiEHEUVp4pd2.6TmW/OTnXQSMyG2',
  },
  'nalabdullah': {
    email: 'naser.alabdullah@talabat.com',
    passwordHash: '$2b$10$YbSu1OJ9Xy6w0psPByYxQeRSmVZTM1RmKyShB0O4wjIVWWjzxxClC',
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
