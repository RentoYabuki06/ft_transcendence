# ft_transcendence Modules

## Module Selection Checklist

**記号の意味：**
- [○] 採用する（実装予定）
- [△] 余裕があったら実装する
- [×] 実装しない

---

- **Web**
    - [○] Major module: Use a framework to build the backend.
    - [○] Minor module: Use a framework or a toolkit to build the frontend.
    - [○] Minor module: Use a database for the backend.
    - [×] Major module: Store the score of a tournament in the Blockchain.
- **User Management**
    - [○] Major module: Standard user management, authentication, users across tournaments.
    - [○] Major module: Implementing a remote authentication.
- **Gameplay and user experience**
    - [△] Major module: Remote players
    - [△] Major module: Multiplayer (more than 2 players in the same game).
    - [×] Major module: Add another game with user history and matchmaking.
    - [○] Minor module: Game customization options.
    - [×] Major module: Live chat.
- **AI-Algo**
    - [○] Major module: Introduce an AI opponent.
    - [○] Minor module: User and game stats dashboards.
- **Cybersecurity**
    - [×] Major module: Implement WAF/ModSecurity with a hardened configuration and HashiCorp Vault for secrets management.
    - [○] Minor module: GDPR compliance options with user anonymization, local data management, and Access/Delete.
    - [○] Major module: Implement Two-Factor Authentication (2FA) and JWT.
- **Devops**
    - [△] Major module: Infrastructure setup for log management.
    - [△] Minor module: Monitoring system.
    - [×] Major module: Designing the backend as microservices.
- **Graphics**
    - [○] Major module: Use advanced 3D techniques.
- **Accessibility**
    - [○] Minor module: Support on all devices.
    - [○] Minor module: Expanding browser compatibility.
    - [×] Minor module: Supports multiple languages.
    - [×] Minor module: Add accessibility features for visually impaired users.
    - [×] Major module: Server-Side Rendering (SSR) integration.
- **Server-Side Pong**
    - [×] Major module: Replace basic Pong with server-side Pong and implement an API.
    - [×] Major module: Enabling Pong gameplay via CLI against web users with API integration.
