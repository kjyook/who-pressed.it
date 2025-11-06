# Who Pressed It? - 프로젝트 컨텍스트

## 프로젝트 개요

국회의원 표결 내역을 보여주는 웹 애플리케이션. 열린국회정보 Open API를 활용하여 의원별 표결 정보를 제공합니다.

## 기술 스택

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Neon), Prisma ORM
- **State Management**: TanStack Query (React Query)
- **Package Manager**: Yarn 4 (node-modules mode)

## 데이터베이스 스키마

- `AssemblyMember`: 국회의원 정보 (이름, 정당, 선거구 등)
- `Bill`: 안건 정보 (의안번호, 의안명, 표결일 등)
- `Vote`: 표결 내역 (의원-안건 관계, 찬성/반대/기권/불참)

## API 구조

### 열린국회정보 Open API (3개)

1. **국회의원 인적사항**: `/openapi/nwvrqwxyaytdsfvhu`
2. **본회의 처리안건**: `/openapi/nwbpacrgavhjryiph`
3. **본회의 표결정보**: `/openapi/nojepdqqaweusdfbi` (BILL_ID 필수)

### 내부 API Routes

- `GET /api/members?name={name}`: 의원 검색
- `GET /api/members/[id]/votes`: 의원의 표결 내역 조회 (최대 50개 안건)
- `GET /api/bills?title={title}`: 안건 검색 (제목 기반)
- `GET /api/bills/[id]`: 안건 기본 정보 조회
- `GET /api/bills/[id]/votes?page={page}&pageSize={size}`: 안건별 표결 결과 (페이지네이션)

## 데이터 흐름 (Lazy Loading)

### 의원 검색 플로우
1. 사용자가 의원 이름으로 검색
2. DB에서 먼저 조회
3. 없으면 Open API 호출하여 의원 정보 저장
4. 의원 상세 페이지 접속 시 표결 내역 없으면:
   - 안건 목록 API 호출 (최근 50개)
   - 각 안건의 BILL_ID로 표결 정보 조회
   - 해당 의원의 표결만 필터링하여 DB 저장

### 안건 검색 플로우
1. 사용자가 안건명으로 검색
2. DB에서 먼저 조회 (100개까지)
3. 결과가 10개 미만이면 Open API 호출 (pSize=100)
4. 안건 상세 페이지 접속 시:
   - 안건 기본 정보 즉시 표시
   - DB에 표결 데이터 없으면:
     - Open API에서 **모든 표결 데이터 한번에** 가져오기 (pSize=500)
     - 모든 의원 & 표결 정보 DB에 저장
   - 프론트엔드에서 50명씩 Infinite Scroll로 표시

## 코딩 규칙

- **타입 안전성**: 모든 API 응답에 인터페이스 정의
- **에러 핸들링**: try-catch로 API 에러 처리, 사용자에게 명확한 메시지
- **성능**: API 호출 간 100ms 딜레이 (rate limit 방지)
- **주석**: 복잡한 로직에는 한글 주석 추가
- **Infinite Scroll 구현 시**:
  - 중복 요청 방지: `loadedPages` Set + `isFetchingRef` 사용
  - 애니메이션: 새로 추가된 아이템만 적용 (previousLength 추적)
  - 레이아웃 안정성: Scroll Trigger는 보이지 않는 작은 div로, 로딩 UI는 별도로

## 환경변수

```env
DATABASE_URL=postgresql://... (Neon pooled connection)
DIRECT_URL=postgresql://... (Neon direct connection)
OPEN_ASSEMBLY_API_KEY=your_api_key
```

## 개발 명령어

```bash
yarn dev          # 개발 서버 시작
yarn build        # 프로덕션 빌드
yarn prisma migrate dev  # DB 마이그레이션
yarn prisma studio       # DB GUI
```

## 주의사항

- Open API는 **BILL_ID 없이는 의원별 표결 조회 불가**
- 표결 정보 API는 `AGE`(대) 파라미터 필수 (현재: '22')
- **중요**: Open API의 표결정보 조회는 `BILL_ID`로 검색 시 `pIndex` 파라미터가 작동하지 않고 항상 모든 데이터 반환
  - 따라서 첫 요청에서 모든 데이터(pSize=500)를 한번에 가져와 DB에 저장
  - 이후 페이지네이션은 DB에서만 처리
- Yarn PnP 사용 불가 (Prisma 호환성 문제) → node-modules 모드 사용
- Next.js 15+ 에서 `params`는 Promise → `await params` 필요

## 다음 할 일

- [x] 안건 검색 기능 추가 ✅
- [x] Infinite Scroll 구현 (50명씩 로딩, 중복 방지, 애니메이션) ✅
- [ ] 의원 상세 페이지 Infinite Scroll 적용
- [ ] 정당별 필터링
- [ ] 표결 통계 차트
- [ ] Vercel 배포

## 완료된 기능

### 안건 검색 (2025-01-06)
- 메인 페이지에서 의원/안건 토글 검색
- `/api/bills?title={title}` API 구현
- 안건 상세 페이지 (`/bills/[id]`)
- 표결 결과 필터링 (찬성/반대/기권/불참)

### Infinite Scroll 최적화 (2025-01-06)
- **문제**: 300명 데이터 초기 로딩 느림, Open API pIndex 미작동, 프론트엔드 중복 요청
- **해결**:
  - 안건 정보와 표결 데이터 분리 로딩
  - API는 한번만 호출하여 모든 데이터 DB 저장
  - 프론트엔드에서 50명씩 페이지네이션 (DB에서)
  - `loadedPages` Set + `isFetchingRef`로 중복 방지
  - 새로운 아이템만 fade-in 애니메이션 적용
- **결과**: 빠른 초기 로딩 + 부드러운 스크롤 + 중복 없음
- **상세**: `src/docs/infinite-scroll-nightmare.md` 참고

## 블로그 작성

- src/docs 폴더에 md파일로 작성
- 말투는 일기 쓰듯이 자유롭게
- 코드 스니펫 포함 가능

## git

- commit, pr은 .github/contributing.md 참고
- commit은 하나로 합치기 보다는, 기능별로 여러개로 묶어서 해도 됨
