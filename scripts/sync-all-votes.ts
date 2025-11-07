/**
 * 22대 국회 모든 안건 및 표결 정보 동기화 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/sync-all-votes.ts
 *
 * 주의:
 * - 시간이 오래 걸립니다 (수백 개 안건 × 100ms delay)
 * - 중간에 멈추면 이어서 실행 가능 (upsert 사용)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VOTE_API_URL = 'https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi';
const BILL_API_URL = 'https://open.assembly.go.kr/portal/openapi/nwbpacrgavhjryiph';
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;

// API 호출 딜레이
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 본회의 처리안건 조회
async function fetchBills(pIndex: number, pSize: number = 100) {
  const url = new URL(BILL_API_URL);
  url.searchParams.append('KEY', API_KEY!);
  url.searchParams.append('Type', 'json');
  url.searchParams.append('pIndex', String(pIndex));
  url.searchParams.append('pSize', String(pSize));
  url.searchParams.append('AGE', '22');

  console.log(`Fetching bills: page ${pIndex}, size ${pSize}`);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  return await response.json();
}

// 표결 정보 조회
async function fetchVoteRecords(billId: string) {
  const url = new URL(VOTE_API_URL);
  url.searchParams.append('KEY', API_KEY!);
  url.searchParams.append('Type', 'json');
  url.searchParams.append('pIndex', '1');
  url.searchParams.append('pSize', '500');
  url.searchParams.append('AGE', '22');
  url.searchParams.append('BILL_ID', billId);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  return await response.json();
}

async function main() {
  console.log('🚀 22대 국회 안건 및 표결 정보 동기화 시작\n');

  let totalBills = 0;
  let totalVotes = 0;
  let totalMembers = 0;
  let currentPage = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      // Step 1: 안건 목록 가져오기
      const billsData = await fetchBills(currentPage, pageSize);
      const responseKey = Object.keys(billsData)[0];
      const responseData = billsData[responseKey];

      if (!Array.isArray(responseData)) {
        console.log('더 이상 데이터가 없습니다.');
        break;
      }

      const rowData = responseData.find((item: any) => item.row);

      if (!rowData || !rowData.row || rowData.row.length === 0) {
        console.log(`Page ${currentPage}: 데이터 없음`);
        break;
      }

      const bills = rowData.row;
      console.log(`\n📄 Page ${currentPage}: ${bills.length}개 안건 발견`);

      // Step 2: 각 안건 처리
      for (let i = 0; i < bills.length; i++) {
        const billData = bills[i];
        const progress = `[${i + 1}/${bills.length}]`;

        // 표결이 없는 안건은 스킵
        if (!billData.VOTE_TCNT || parseInt(billData.VOTE_TCNT) === 0) {
          console.log(`${progress} SKIP: ${billData.BILL_NM} (표결 없음)`);
          continue;
        }

        try {
          // 안건이 이미 DB에 있고, 표결 정보도 있으면 스킵
          const existingBill = await prisma.bill.findUnique({
            where: { billId: billData.BILL_ID },
            include: {
              votes: { take: 1 }, // 표결 정보가 1개라도 있는지만 확인
            },
          });

          if (existingBill && existingBill.votes.length > 0) {
            console.log(`${progress} ⏭️  SKIP: ${billData.BILL_NM.substring(0, 30)}... (이미 동기화됨)`);
            continue;
          }

          // 안건 저장
          const bill = await prisma.bill.upsert({
            where: { billId: billData.BILL_ID },
            create: {
              billId: billData.BILL_ID,
              billNumber: billData.BILL_NO,
              billName: billData.BILL_NM,
              proposer: billData.PROPOSER || null,
              voteDate: new Date(billData.RGS_PROC_DT),
              isPassed: billData.PROC_RESULT_CD?.includes('가결') || false,
              favorCount: billData.YES_TCNT ? parseInt(billData.YES_TCNT) : null,
              againstCount: billData.NO_TCNT ? parseInt(billData.NO_TCNT) : null,
              abstainCount: billData.BLANK_TCNT ? parseInt(billData.BLANK_TCNT) : null,
            },
            update: {
              billNumber: billData.BILL_NO,
              billName: billData.BILL_NM,
              proposer: billData.PROPOSER || null,
              voteDate: new Date(billData.RGS_PROC_DT),
              isPassed: billData.PROC_RESULT_CD?.includes('가결') || false,
              favorCount: billData.YES_TCNT ? parseInt(billData.YES_TCNT) : null,
              againstCount: billData.NO_TCNT ? parseInt(billData.NO_TCNT) : null,
              abstainCount: billData.BLANK_TCNT ? parseInt(billData.BLANK_TCNT) : null,
            },
          });

          totalBills++;

          // 표결 정보 가져오기
          console.log(`${progress} 표결 정보 조회: ${billData.BILL_NM.substring(0, 30)}...`);
          const voteData = await fetchVoteRecords(billData.BILL_ID);
          await delay(100); // Rate limit 방지

          const voteResponseKey = Object.keys(voteData)[0];
          const voteResponseData = voteData[voteResponseKey];

          if (!Array.isArray(voteResponseData)) {
            console.log(`${progress} ⚠️ 표결 데이터 없음`);
            continue;
          }

          const voteRowData = voteResponseData.find((item: any) => item.row);

          if (!voteRowData || !voteRowData.row || voteRowData.row.length === 0) {
            console.log(`${progress} ⚠️ 표결 데이터 없음`);
            continue;
          }

          const votes = voteRowData.row;
          console.log(`${progress} 💾 ${votes.length}명의 표결 정보 저장 중...`);

          // ✨ 성능 개선: 병렬 처리 + 트랜잭션으로 속도 향상 및 원자성 보장
          const BATCH_SIZE = 50; // 한 번에 처리할 배치 크기
          let voteCount = 0;
          let memberCount = votes.length;

          // 배치별로 처리
          for (let batchStart = 0; batchStart < votes.length; batchStart += BATCH_SIZE) {
            const batch = votes.slice(batchStart, batchStart + BATCH_SIZE);

            try {
              await prisma.$transaction(async (tx) => {
                // 1. 의원 정보 병렬 처리 (먼저 모든 의원 저장)
                const memberPromises = batch.map((voteRecord: any) =>
                  tx.assemblyMember.upsert({
                    where: { memberId: voteRecord.MONA_CD },
                    create: {
                      memberId: voteRecord.MONA_CD,
                      name: voteRecord.HG_NM,
                      engName: null,
                      party: voteRecord.POLY_NM,
                      district: voteRecord.ORIG_NM,
                      committee: null,
                      termNumber: parseInt(voteRecord.AGE) || 22,
                      reelection: false,
                      profileUrl: null,
                    },
                    update: {
                      name: voteRecord.HG_NM,
                      party: voteRecord.POLY_NM,
                      district: voteRecord.ORIG_NM,
                    },
                  })
                );

                const members = await Promise.all(memberPromises);

                // 2. 표결 정보 병렬 처리
                const votePromises = batch.map((voteRecord: any, index: number) => {
                  // 표결 결과 매핑
                  let voteResult: 'FAVOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT';
                  const resultStr = voteRecord.RESULT_VOTE_MOD?.trim();

                  if (resultStr === '찬성' || resultStr === '가') {
                    voteResult = 'FAVOR';
                  } else if (resultStr === '반대' || resultStr === '부') {
                    voteResult = 'AGAINST';
                  } else if (resultStr === '기권') {
                    voteResult = 'ABSTAIN';
                  } else {
                    voteResult = 'ABSENT';
                  }

                  return tx.vote.upsert({
                    where: {
                      memberId_billId: {
                        memberId: members[index].id,
                        billId: bill.id,
                      },
                    },
                    create: {
                      memberId: members[index].id,
                      billId: bill.id,
                      result: voteResult,
                    },
                    update: {
                      result: voteResult,
                    },
                  });
                });

                await Promise.all(votePromises);
                voteCount += batch.length;
              });

              // 진행 상황 표시 (큰 데이터셋인 경우)
              if (votes.length > BATCH_SIZE) {
                const progress = Math.min(batchStart + BATCH_SIZE, votes.length);
                console.log(`  └─ ${progress}/${votes.length} 처리됨...`);
              }
            } catch (error: any) {
              console.error(`  └─ ❌ 배치 ${batchStart}-${batchStart + BATCH_SIZE} 저장 실패:`, error.message);
              throw error; // 전체 안건 실패로 처리
            }
          }

          totalVotes += voteCount;
          totalMembers = memberCount;

          console.log(`${progress} ✅ 완료: ${voteCount}개 표결 저장\n`);

        } catch (error: any) {
          console.error(`${progress} ❌ 에러: ${billData.BILL_NM}`, error.message);
          continue;
        }
      }

      // 다음 페이지로
      currentPage++;

      // 데이터가 pageSize보다 적으면 마지막 페이지
      if (bills.length < pageSize) {
        hasMore = false;
      }

    } catch (error: any) {
      console.error(`\n❌ Page ${currentPage} 처리 중 에러:`, error.message);
      break;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ 동기화 완료!');
  console.log('='.repeat(50));
  console.log(`📊 통계:`);
  console.log(`  - 처리한 페이지: ${currentPage - 1}`);
  console.log(`  - 저장된 안건: ${totalBills}개`);
  console.log(`  - 저장된 표결: ${totalVotes}개`);
  console.log(`  - 저장된 의원: ${totalMembers}명`);
  console.log('='.repeat(50));
}

main()
  .catch((error) => {
    console.error('❌ 스크립트 실행 중 에러:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
