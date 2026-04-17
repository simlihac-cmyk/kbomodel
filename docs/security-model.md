# Security Model

## 공개 사용자와 관리자 분리
- 공개 사용자:
  - `/season/*`
  - `/archive/*`
  - `/teams/*`
  - `/games/*`
  - `/players/*`
  - `/model`
- 관리자 전용:
  - `/admin/*`
  - manual adjustment 저장
  - 향후 import 실행과 metadata 수정 액션

## 현재 구현
- `/admin/*`는 `middleware.ts`로 먼저 차단한다.
- `src/app/admin/layout.tsx`에서 서버 측으로 한 번 더 세션을 확인한다.
- write action은 UI 노출 여부와 무관하게 서버에서 `requireAdminSession()`으로 다시 확인한다.
- 관리자 세션은 `httpOnly`, `sameSite=lax`, production에서 `secure` 쿠키를 사용한다.
- 세션 토큰은 HMAC 서명으로 위변조를 검증한다.
- 로그인은 기본 rate limit를 둔다.
- 로그인 성공/실패, 로그아웃, 수동 보정 저장 이벤트를 audit log에 남긴다.

## 자격 증명
- 권장 env:
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD_HASH`
  - `ADMIN_SESSION_SECRET`
- 비밀번호 hash 생성:
  - `pnpm auth:hash-password -- <password>`
- 개발 환경에서만 fallback admin 계정이 동작한다.
- production에서는 `ADMIN_SESSION_SECRET`과 `ADMIN_PASSWORD_HASH`를 반드시 설정해야 한다.

## 남은 보안 확장 포인트
- audit log 저장
- persistent rate limiting
- 역할 분리 (`admin`, `editor`, `viewer`)
- CSRF 토큰 추가
- 2FA 또는 SSO
