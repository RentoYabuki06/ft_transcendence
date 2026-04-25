import { FastifyInstance } from 'fastify'

export async function legalRoutes(fastify: FastifyInstance) {
  // --- GET /privacy-policy ---
  fastify.get('/privacy-policy', async (_request, reply) => {
    return reply.send({
      title: 'Privacy Policy',
      lastUpdated: '2026-04-01',
      sections: [
        {
          heading: '1. Information We Collect',
          body: [
            'We collect information you provide directly to us when you register for an account, including your nickname, email address, and password.',
            'We may collect information about your use of the application, such as game history, scores, and achievements.',
            'If you authenticate via 42 Intranet OAuth, we receive your 42 login name, email, and profile picture.',
          ],
        },
        {
          heading: '2. How We Use Your Information',
          body: [
            'To provide, maintain, and improve the application.',
            'To manage your account and enable login.',
            'To track game statistics, rankings, and achievements.',
            'To allow you to connect and interact with other users (friends system).',
          ],
        },
        {
          heading: '3. Information Sharing',
          body: [
            'We do not sell, trade, or otherwise transfer your personal information to third parties.',
            'Your nickname, avatar, and game statistics are visible to other logged-in users.',
            'Your email address is never publicly displayed.',
          ],
        },
        {
          heading: '4. Data Security',
          body: [
            'Passwords are stored using bcrypt hashing and are never stored in plain text.',
            'We use JSON Web Tokens (JWT) for session management.',
            'Two-factor authentication (2FA) via TOTP is available to further secure your account.',
          ],
        },
        {
          heading: '5. Data Retention',
          body: [
            'Your account data is retained as long as your account is active.',
            'You may request deletion of your account and associated data at any time.',
          ],
        },
        {
          heading: '6. Contact',
          body: [
            'If you have any questions about this Privacy Policy, please contact the project team.',
          ],
        },
      ],
    })
  })

  // --- GET /terms-of-service ---
  fastify.get('/terms-of-service', async (_request, reply) => {
    return reply.send({
      title: 'Terms of Service',
      lastUpdated: '2026-04-01',
      sections: [
        {
          heading: '1. Acceptance of Terms',
          body: [
            'By accessing or using ft_transcendence, you agree to be bound by these Terms of Service.',
            'If you do not agree to these terms, please do not use the application.',
          ],
        },
        {
          heading: '2. User Accounts',
          body: [
            'You must provide accurate information when creating an account.',
            'You are responsible for maintaining the confidentiality of your password.',
            'You must not share your account with others or use another user\'s account.',
            'You must be at least 13 years of age to use this application.',
          ],
        },
        {
          heading: '3. Acceptable Use',
          body: [
            'You agree not to use the application for any unlawful purpose.',
            'You agree not to harass, abuse, or harm other users.',
            'You agree not to attempt to gain unauthorized access to other accounts or the server.',
            'You agree not to use automated scripts or bots to interact with the application.',
          ],
        },
        {
          heading: '4. Game Conduct',
          body: [
            'Players are expected to play fairly and respectfully.',
            'Intentional disconnection to avoid a loss is prohibited.',
            'Any form of cheating, hacking, or exploitation of bugs is strictly prohibited.',
          ],
        },
        {
          heading: '5. Intellectual Property',
          body: [
            'ft_transcendence is a 42 School educational project.',
            'All game logic, design, and code are the property of the development team.',
          ],
        },
        {
          heading: '6. Disclaimer',
          body: [
            'This application is provided "as is" for educational purposes.',
            'We do not guarantee uninterrupted or error-free operation of the application.',
          ],
        },
        {
          heading: '7. Changes to Terms',
          body: [
            'We reserve the right to modify these terms at any time.',
            'Continued use of the application after changes constitutes acceptance of the new terms.',
          ],
        },
      ],
    })
  })
}
