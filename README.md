# ft_transcendence

## 目次

1. [Git 運用ルール](./docs/00_git-rules/README.md)
2. [要件定義](./docs/01_requirements/README.md)

## 環境構築
### クローン方法

1. git clone を利用する方法

```bash
# 例
git clone git@github.com:RentoYabuki06/ft_transcendence.git
```

- username: git 
- hostname: github.com

> SSHの設定ファイルに従ってください。

**設定ファイルの参考**

```config
Host github.com
  HostName      github.com
  User          git 
  IdentifyFile  ~/.ssh/id_ed25519
```

参考URL: https://www.cyberciti.biz/faq/create-ssh-config-file-on-linux-unix/

<br>

### Docker を立ち上げる方法

**例**

```bash
# Linux の systemctl 系
systemctl status docker

# Linux の service 系
service docker status
```

<br>

### 開発環境立ち上げ方

```bash
docker compose up
```

<br>

### 開発環境の落とし方

```bash
docker compose down
```

- フロントエンド： http://localhost:5173
- バックエンド： http://localhost:3000
