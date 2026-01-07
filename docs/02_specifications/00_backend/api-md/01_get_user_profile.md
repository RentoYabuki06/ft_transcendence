# プロフィール情報取得のAPI

![user_information_api](../imgs/01_user_information_api.png)


**HTTPメソッド** : GET  
**エンドポイント** : /profile

---
## 概要

```txt
ログイン中ユーザー自身の情報を取得するAPI。

本APIでは以下の情報を一括で取得する。
- プロフィール情報（名前・ニックネーム・アバターURL など）
- アカウント状態（statusId）
- 2FA 有効状態（twoFAEnabled）
```

<br>

## 機能

1. [1-プロフィール情報を取得するもの](#1-プロフィール情報を取得するもの)
2. [2-アカウント状態を取得するもの](#2-アカウント状態を取得するもの)
3. [3-2fa状態を取得するもの](#3-2fa状態を取得するもの)

<br>

## 詳細

### 1-プロフィール情報を取得するもの
**メソッド : function**

<br>

**引数** 

|番号|名称|型|説明|
|:--|:--|:--|:--|
|01|id|int|ユーザーのID|


**戻り値**

|番号|型|説明|
|:--|:--|:--|
|01|int|ユーザーid|
|02|string|name|
|03|string|nickname|
|04|string \| null|pictureURL|

<br>

---

### 2-アカウント状態を取得するもの
**メソッド : function**

<br>

**引数**


|番号|名称|型|説明|
|:--|:--|:--|:--|
|01|id|int|ユーザーのID|

<br>

**戻り値**

|番号|型|説明|
|:--|:--|:--|
|01|int|statusId|

<br>

---

### 3-2fa状態を取得するもの
**メソッド : function**

<br>

**引数**


|番号|名称|型|説明|
|:--|:--|:--|:--|
|01|id|int|ユーザーのID|

<br>

**戻り値**

|番号|型|説明|
|:--|:--|:--|
|01|Boolean|isTwoFactorEnabled|

<br>

---

### レスポンス例
```json
{
  "id": 1,
  "name": "nisi",
  "nickname": "nisi",
  "pictureURL": "https://example.com/avatar.png",
  "statusId": ステータステーブルの参照,
  "twoFAEnabled": true
}
```

