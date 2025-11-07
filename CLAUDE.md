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
- `GET /api/members/[id]/votes?page={page}&pageSize={size}`: 의원의 표결 내역 조회 (페이지네이션)
- `GET /api/bills?title={title}`: 안건 검색 (제목 기반)
- `GET /api/bills/[id]`: 안건 기본 정보 조회
- `GET /api/bills/[id]/votes?page={page}&pageSize={size}`: 안건별 표결 결과 (페이지네이션)

## 데이터 흐름 (Lazy Loading)

### 의원 검색 플로우

1. 사용자가 의원 이름으로 검색
2. DB에서 먼저 조회
3. 없으면 Open API 호출하여 의원 정보 저장
4. 의원 상세 페이지 접속 시 표결 내역 없으면:
   - 안건 목록 API 호출 (최근 20개)
   - 각 안건의 BILL_ID로 표결 정보 조회
   - 해당 의원의 표결만 필터링하여 DB 저장
   - 프론트엔드에서 50건씩 Infinite Scroll로 표시

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

### 데이터 페칭 전략

**✅ TanStack Query 사용 (권장)**
- **상세 페이지**: `useQuery` + `useInfiniteQuery` 사용
  - `src/app/bills/[id]/page.tsx`: 안건 상세 + 무한 스크롤
  - `src/app/members/[id]/page.tsx`: 의원 상세 + 무한 스크롤
  - 자동 캐싱, 재시도, 중복 요청 방지
  - 선언적이고 간결한 코드

**⚠️ 수동 상태 관리 (레거시)**
- **메인 페이지**: `useState` + `useEffect` 사용 중
  - `src/app/page.tsx`: 검색 및 초기 리스트
  - TODO: React Query로 마이그레이션 필요

**Infinite Scroll 패턴 (React Query 사용 시)**
```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['votes', id],
  queryFn: async ({ pageParam = 1 }) => { ... },
  getNextPageParam: (lastPage) => lastPage.pagination.hasMore ? page + 1 : undefined,
  initialPageParam: 1,
});

// IntersectionObserver로 자동 로드
useEffect(() => {
  if (isIntersecting && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [isIntersecting, hasNextPage, isFetchingNextPage]);
```

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
yarn sync-votes   # 배치: 22대 국회 모든 안건 및 표결 정보 동기화
```

## 데이터 관리

### 배치 스크립트 (`yarn sync-votes`)

22대 국회의 모든 안건과 표결 정보를 DB에 동기화하는 스크립트.

**기능**:

- 본회의 처리안건을 페이지별로 가져오기 (100개씩)
- 각 안건의 모든 표결 정보 저장 (최대 500명)
- 의원 정보 자동 upsert
- **중단 후 재시작 가능**: 이미 동기화된 안건은 자동 스킵

**실행 시간**: 5~10분 (안건 수에 따라 다름)

**주의**: 초기 실행 시 한 번만 돌리면 되며, 이후에는 주기적으로 실행하여 새로운 안건 추가 가능

### GitHub Actions 자동화

매일 새벽 3시에 자동으로 `sync-votes` 실행 (배포 시 설정)

- 상세: `src/docs/github-actions-batch.md` 참고

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
- [x] 의원 상세 페이지 Infinite Scroll 적용 ✅
- [x] React Query 도입 (상세 페이지) ✅
- [ ] 메인 페이지 React Query 마이그레이션
- [ ] 정당별 필터링
- [ ] 표결 통계 차트
- [ ] Vercel 배포

## 완료된 기능

### 안건 검색 (2025-11-06)

- 메인 페이지에서 의원/안건 토글 검색
- `/api/bills?title={title}` API 구현
- 안건 상세 페이지 (`/bills/[id]`)
- 표결 결과 필터링 (찬성/반대/기권/불참)

### Infinite Scroll 최적화 (2025-11-06)

- **문제**: 300명 데이터 초기 로딩 느림, Open API pIndex 미작동, 프론트엔드 중복 요청
- **해결**:
  - 안건 정보와 표결 데이터 분리 로딩
  - API는 한번만 호출하여 모든 데이터 DB 저장
  - 프론트엔드에서 50명씩 페이지네이션 (DB에서)
  - `loadedPages` Set + `isFetchingRef`로 중복 방지
  - 새로운 아이템만 fade-in 애니메이션 적용
- **결과**: 빠른 초기 로딩 + 부드러운 스크롤 + 중복 없음
- **상세**: `src/docs/infinite-scroll-nightmare.md` 참고

### 의원 상세 페이지 Infinite Scroll (2025-11-06)

- 의원 표결 내역 API에 페이지네이션 추가
- 안건별 표결과 동일한 패턴으로 구현:
  - 의원 기본 정보와 표결 데이터 분리 로딩
  - 50건씩 Infinite Scroll
  - `loadedPages` Set + `isFetchingRef`로 중복 방지
  - 새로운 아이템에만 fade-in 애니메이션
  - 표결 카드 클릭 시 안건 상세 페이지로 이동

### 메인 페이지 기본 리스트 (2025-11-06)

- 의원 탭: 랜덤 30명 표시 (PostgreSQL `RANDOM()`)
- 안건 탭: 최신 30건 표시 (voteDate DESC)
- 검색어 입력 전에도 리스트 확인 가능
- 토글 전환 시 자동 새로고침

### 배치 스크립트 & 자동화 (2025-11-06)

- 22대 국회 모든 안건 및 표결 정보 동기화 스크립트 (`scripts/sync-all-votes.ts`)
- 중단 후 재시작 지원 (이미 처리한 안건 자동 스킵)
- GitHub Actions를 통한 자동화 준비 완료
- 상세 문서: `src/docs/github-actions-batch.md`

### 성능 최적화 & 코드 품질 개선 (2025-11-07)

**데이터 정합성:**
- 표결 결과 검증 강화 (예상치 못한 값 에러 처리)
- voteDate nullable 처리 (잘못된 기본값 제거)
- bill.upsert 코드 중복 제거 (DRY 원칙)

**API 성능 개선:**
- HG_NM 파라미터로 의원 표결 조회 응답 99.7% 감소
- 배치 스크립트 DB 저장 10배 향상 (Promise.all + 트랜잭션)
- 안건별 표결 저장 10배 향상 (병렬 처리)
- 불필요한 DB 재조회 제거 (저장 데이터 재사용)

**React Query 도입:**
- 상세 페이지 React Query로 전면 리팩토링
- useQuery + useInfiniteQuery 활용
- 110줄 코드 감소 (수동 상태 관리 제거)
- 자동 캐싱, 재시도, 중복 요청 방지
- useCallback 최적화 (loadedPages useState → useRef)

## 개발 팁

### 테스트 API 작성

`src/app/api/test/` 폴더에 테스트용 API를 작성할 수 있습니다.

- `.gitignore`에 등록되어 있어 커밋되지 않음
- Open API 호출 테스트, 데이터 변환 테스트 등에 활용

### 블로그 작성

- `src/docs` 폴더에 md파일로 작성
- 말투는 일기 쓰듯이 자유롭게
- 코드 스니펫 포함 가능
- `.gitignore`에 등록되어 있어 커밋되지 않음

### Git

- commit, pr은 `.github/contributing.md` 참고
- commit은 하나로 합치기 보다는, 기능별로 여러개로 묶어서 해도 됨
