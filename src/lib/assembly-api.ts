// 열린국회정보 Open API 클라이언트

const VOTE_API_URL =
  'https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi';
const MEMBER_API_URL =
  'https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu';
const BILL_API_URL =
  'https://open.assembly.go.kr/portal/openapi/nwbpacrgavhjryiph';
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;

// API 응답 타입
interface VoteRecord {
  HG_NM: string; // 의원명
  HJ_NM: string; // 한자명
  POLY_NM: string; // 정당
  ORIG_NM: string; // 선거구
  MEMBER_NO: string; // 의원번호
  POLY_CD: string; // 소속정당코드
  ORIG_CD: string; // 선거구코드
  VOTE_DATE: string; // 의결일자
  BILL_NO: string; // 의안번호
  BILL_NAME: string; // 의안명
  BILL_ID: string; // 의안ID
  LAW_TITLE: string; // 법률명
  CURR_COMMITTEE: string; // 소관위원회
  RESULT_VOTE_MOD: string; // 표결결과 (찬성/반대/기권)
  CURR_COMMITTEE_ID: string; // 소관위코드
  BILL_URL: string; // 의안URL
  SESSION_CD: string; // 회기
  CURRENTS_CD: string; // 차수
  AGE: string; // 대
  MONA_CD: string; // 국회의원코드
}

interface ApiResponse {
  [key: string]: Array<{ row: VoteRecord[] }>;
}

// 본회의 표결 정보 조회
export async function fetchVoteRecords(params?: {
  memberName?: string; // HG_NM
  party?: string; // POLY_NM
  memberNo?: string; // MEMBER_NO
  voteDate?: string; // VOTE_DATE
  billNo?: string; // BILL_NO
  billName?: string; // BILL_NAME
  billId?: string; // BILL_ID
  age?: string; // AGE (대)
  pIndex?: number;
  pSize?: number;
}) {
  const url = new URL(VOTE_API_URL);
  url.searchParams.append('KEY', API_KEY!);
  url.searchParams.append('Type', 'json');
  url.searchParams.append('pIndex', String(params?.pIndex || 1));
  url.searchParams.append('pSize', String(params?.pSize || 100));
  url.searchParams.append('AGE', params?.age || '22'); // AGE는 필수

  if (params?.memberName) url.searchParams.append('HG_NM', params.memberName);
  if (params?.party) url.searchParams.append('POLY_NM', params.party);
  if (params?.memberNo) url.searchParams.append('MEMBER_NO', params.memberNo);
  if (params?.voteDate) url.searchParams.append('VOTE_DATE', params.voteDate);
  if (params?.billNo) url.searchParams.append('BILL_NO', params.billNo);
  if (params?.billName) url.searchParams.append('BILL_NAME', params.billName);
  if (params?.billId) url.searchParams.append('BILL_ID', params.billId);

  console.log('Vote API Request URL:', url.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  const data: ApiResponse = await response.json();
  return data;
}

// 의원별 표결 내역 조회
export async function fetchMemberVotes(memberName: string, age: string = '22') {
  return fetchVoteRecords({ memberName, age });
}

// 안건별 표결 결과 조회
export async function fetchBillVotes(billId: string) {
  return fetchVoteRecords({ billId });
}

// 국회의원 인적사항 타입
interface MemberInfo {
  HG_NM: string; // 이름
  HJ_NM: string; // 한자명
  ENG_NM: string; // 영문명칭
  BTH_GBN_NM: string; // 음/양력
  BTH_DATE: string; // 생년월일
  JOB_RES_NM: string; // 직책명
  POLY_NM: string; // 정당명
  ORIG_NM: string; // 선거구
  ELECT_GBN_NM: string; // 선거구구분
  CMIT_NM: string; // 대표 위원회
  CMITS: string; // 소속 위원회 목록
  REELE_GBN_NM: string; // 재선구분명
  UNITS: string; // 당선
  SEX_GBN_NM: string; // 성별
  TEL_NO: string; // 전화번호
  E_MAIL: string; // 이메일
  HOMEPAGE: string; // 홈페이지
  STAFF: string; // 보좌관
  SECRETARY: string; // 선임비서관
  SECRETARY2: string; // 비서관
  MONA_CD: string; // 국회의원코드
  MEM_TITLE: string; // 약력
  ASSEM_ADDR: string; // 사무실 호실
}

interface MemberApiResponse {
  [key: string]: Array<{ row: MemberInfo[] }>;
}

// 국회의원 인적사항 조회
export async function fetchMembers(params?: {
  name?: string; // HG_NM
  party?: string; // POLY_NM
  district?: string; // ORIG_NM
  committee?: string; // CMITS
  gender?: string; // SEX_GBN_NM
  memberCode?: string; // MONA_CD
  pIndex?: number;
  pSize?: number;
}) {
  const url = new URL(MEMBER_API_URL);
  url.searchParams.append('KEY', API_KEY!);
  url.searchParams.append('Type', 'json');
  url.searchParams.append('pIndex', String(params?.pIndex || 1));
  url.searchParams.append('pSize', String(params?.pSize || 100));

  if (params?.name) url.searchParams.append('HG_NM', params.name);
  if (params?.party) url.searchParams.append('POLY_NM', params.party);
  if (params?.district) url.searchParams.append('ORIG_NM', params.district);
  if (params?.committee) url.searchParams.append('CMITS', params.committee);
  if (params?.gender) url.searchParams.append('SEX_GBN_NM', params.gender);
  if (params?.memberCode) url.searchParams.append('MONA_CD', params.memberCode);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  const data: MemberApiResponse = await response.json();
  return data;
}

// 본회의 처리안건 타입
interface BillInfo {
  AGE: string; // 대수
  BILL_NO: string; // 의안번호
  BILL_NM: string; // 의안명
  BILL_KIND: string; // 의안활동구분
  PROPOSER: string; // 제안자
  COMMITTEE_NM: string; // 소관위원회
  PROC_RESULT_CD: string; // 의결결과
  VOTE_TCNT: string; // 총투표수
  YES_TCNT: string; // 찬성
  NO_TCNT: string; // 반대
  BLANK_TCNT: string; // 기권
  PROPOSE_DT: string; // 제안일
  RGS_PROC_DT: string; // 본회의심의_의결일
  CURR_TRANS_DT: string; // 정부이송일
  ANNOUNCE_DT: string; // 공포일
  BILL_ID: string; // 의안ID
  LINK_URL: string; // 링크URL
  CURR_COMMITTEE_ID: string; // 소관위원회ID
}

interface BillApiResponse {
  [key: string]: Array<{ row: BillInfo[] }>;
}

// 본회의 처리안건 조회 (법률안)
export async function fetchBills(params?: {
  age?: string; // AGE (필수)
  billNo?: string; // BILL_NO
  billName?: string; // BILL_NM
  proposer?: string; // PROPOSER
  committee?: string; // COMMITTEE_NM
  procResult?: string; // PROC_RESULT_CD
  proposeDt?: string; // PROPOSE_DT
  rgsProcDt?: string; // RGS_PROC_DT
  billId?: string; // BILL_ID
  pIndex?: number;
  pSize?: number;
}) {
  const url = new URL(BILL_API_URL);
  url.searchParams.append('KEY', API_KEY!);
  url.searchParams.append('Type', 'json');
  url.searchParams.append('pIndex', String(params?.pIndex || 1));
  url.searchParams.append('pSize', String(params?.pSize || 100));
  url.searchParams.append('AGE', params?.age || '22'); // AGE는 필수

  if (params?.billNo) url.searchParams.append('BILL_NO', params.billNo);
  if (params?.billName) url.searchParams.append('BILL_NM', params.billName);
  if (params?.proposer) url.searchParams.append('PROPOSER', params.proposer);
  if (params?.committee) url.searchParams.append('COMMITTEE_NM', params.committee);
  if (params?.procResult) url.searchParams.append('PROC_RESULT_CD', params.procResult);
  if (params?.proposeDt) url.searchParams.append('PROPOSE_DT', params.proposeDt);
  if (params?.rgsProcDt) url.searchParams.append('RGS_PROC_DT', params.rgsProcDt);
  if (params?.billId) url.searchParams.append('BILL_ID', params.billId);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  const data: BillApiResponse = await response.json();
  return data;
}
