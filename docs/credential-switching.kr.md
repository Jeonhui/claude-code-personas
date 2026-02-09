# Credential Switching — 동작 원리

프로필 전환 시 Claude Code의 로그인 계정도 함께 전환되는 구조를 설명합니다.

## 배경

Claude Code는 두 곳에 상태를 저장합니다:

| 저장소 | 내용 | 위치 |
|--------|------|------|
| `~/.claude/` | 설정, 세션, 프로젝트 데이터 | 파일시스템 |
| macOS Keychain | OAuth 인증 정보 (access token 등) | `Claude Code-credentials` 서비스 |

기존에는 `~/.claude` 심볼릭 링크만 교체했기 때문에, 페르소나를 전환해도 Keychain의 인증 정보는 그대로 남아 **실제 로그인 계정은 바뀌지 않는** 문제가 있었습니다.

## 해결 구조

각 프로필 디렉토리에 `.credentials.json` 파일을 추가하여 Keychain 인증 정보를 백업/복원합니다.

```
~/.claude-profiles/
├── default/
│   ├── .profile-metadata.json
│   └── .credentials.json          ← Keychain 백업본
├── work/
│   ├── .profile-metadata.json
│   └── .credentials.json
└── personal/
    ├── .profile-metadata.json
    └── .credentials.json

macOS Keychain
└── Claude Code-credentials        ← 현재 활성 인증 정보
```

## 핵심 흐름

### 1. switch (프로필 전환)

```
  현재: default (active)    →    대상: work

  ┌─────────────────────────────────────────────────┐
  │ 1. Keychain에서 현재 인증 정보 읽기              │
  │    security find-generic-password -s "..." -w    │
  │                                                  │
  │ 2. default/.credentials.json에 저장 (백업)       │
  │                                                  │
  │ 3. ~/.claude 심볼릭 링크를 work/로 교체          │
  │    ~/.claude -> ~/.claude-profiles/work          │
  │                                                  │
  │ 4. work/.credentials.json 확인                   │
  │    ├─ 파일 있음 → Keychain에 복원               │
  │    └─ 파일 없음 → Keychain 클리어 (미인증)      │
  └─────────────────────────────────────────────────┘

  결과: work 프로필 활성 + work 계정 인증
```

### 2. login (새 계정 로그인)

```
  claude-profile login work

  ┌─────────────────────────────────────────────────┐
  │ 1. "work" 프로필 존재 확인                       │
  │    └─ 없으면 자동 생성                           │
  │                                                  │
  │ 2. switch("work") 실행                           │
  │    (현재 프로필 백업 → 링크 전환 → 복원 시도)    │
  │                                                  │
  │ 3. Keychain 인증 정보 삭제                       │
  │    security delete-generic-password -s "..."     │
  │                                                  │
  │ 4. 사용자에게 `claude` 실행 안내                  │
  └─────────────────────────────────────────────────┘

  결과: work 프로필 활성 + 미인증 상태
  → 사용자가 `claude` 실행하면 OAuth 로그인 플로우 시작
  → 로그인 완료 후 Keychain에 새 인증 정보 저장됨
```

### 3. logout (로그아웃)

```
  claude-profile logout

  ┌─────────────────────────────────────────────────┐
  │ 1. Keychain에서 인증 정보 삭제                   │
  │    security delete-generic-password -s "..."     │
  │                                                  │
  │ 2. 현재 프로필의 .credentials.json 삭제          │
  │    rm ~/.claude-profiles/work/.credentials.json  │
  └─────────────────────────────────────────────────┘

  결과: 현재 프로필 미인증 상태 (Keychain + 파일 모두 삭제)
```

## Keychain 상호작용

macOS `security` CLI를 통해 Keychain에 접근합니다.

| 동작 | 명령어 |
|------|--------|
| 읽기 | `security find-generic-password -s "Claude Code-credentials" -a <username> -w` |
| 쓰기 | `security add-generic-password -s "Claude Code-credentials" -a <username> -w <json> -U` |
| 삭제 | `security delete-generic-password -s "Claude Code-credentials" -a <username>` |

- **서비스명**: `Claude Code-credentials` (Claude Code가 사용하는 고정값)
- **계정명**: OS 사용자 이름 (`os.userInfo().username`)
- **값**: JSON 문자열 (OAuth token, subscriptionType 등)

## 인증 상태 표시

`list`와 `status` 명령에서 각 프로필의 인증 상태를 보여줍니다.

```
Claude Code Profiles:

▸ work (active) — pro ✓ — last used just now
  personal — authenticated ✓ — last used 2h ago
  test — not authenticated — last used 5d ago

  3 profile(s) total
```

인증 정보 소스:

| 프로필 | 소스 | 이유 |
|--------|------|------|
| 활성 프로필 | Keychain | 현재 사용 중인 실제 인증 정보 |
| 비활성 프로필 | `.credentials.json` | 마지막 전환 시 백업된 정보 |

## 파일 보안

| 파일 | 권한 | 설명 |
|------|------|------|
| `.credentials.json` | `0o600` | Owner만 읽기/쓰기 가능 |
| `.profile-metadata.json` | `0o600` | Owner만 읽기/쓰기 가능 |
| 프로필 디렉토리 | `0o700` | Owner만 접근 가능 |

## 플랫폼 지원

| 기능 | macOS | Linux / Windows |
|------|-------|-----------------|
| 프로필 전환 (symlink) | O | O |
| 인증 백업/복원 (Keychain) | O | X (무시됨) |
| login / logout | O | X (에러 반환) |

`isKeychainAvailable()`이 `process.platform === 'darwin'`을 확인하여, macOS가 아닌 환경에서는 Keychain 관련 동작을 건너뜁니다. 프로필 전환 자체는 모든 플랫폼에서 동작합니다.

## 시퀀스 다이어그램

### switch 전체 흐름

```mermaid
User          CLI            Manager         Keychain        FileSystem
 │             │               │               │               │
 │ switch work │               │               │               │
 │────────────>│               │               │               │
 │             │ switch(work)  │               │               │
 │             │──────────────>│               │               │
 │             │               │ read creds    │               │
 │             │               │──────────────>│               │
 │             │               │  json string  │               │
 │             │               │<──────────────│               │
 │             │               │               │ save to       │
 │             │               │               │ default/      │
 │             │               │──────────────────────────────>│
 │             │               │               │               │
 │             │               │ swap symlink  │               │
 │             │               │──────────────────────────────>│
 │             │               │               │               │
 │             │               │               │ read work/    │
 │             │               │               │ .credentials  │
 │             │               │<──────────────────────────────│
 │             │               │ write creds   │               │
 │             │               │──────────────>│               │
 │             │               │      done     │               │
 │             │<──────────────│               │               │
 │  ✓ Switched │               │               │               │
 │<────────────│               │               │               │
```
