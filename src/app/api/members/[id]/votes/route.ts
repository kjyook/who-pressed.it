import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchVoteRecords } from '@/lib/assembly-api';

const VOTES_PER_PAGE = 50;

// 특정 의원의 표결 내역 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || String(VOTES_PER_PAGE));

    // 1. DB에서 의원 정보와 표결 내역 조회
    let memberData = await prisma.assemblyMember.findUnique({
      where: { id: parseInt(id) },
      include: {
        votes: {
          include: {
            bill: true,
          },
          orderBy: {
            bill: {
              voteDate: 'desc',
            },
          },
        },
      },
    });

    if (!memberData) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    let member = memberData;

    // 2. 표결 내역이 없거나 오래된 경우 API 호출
    // 주의: 표결정보 API는 BILL_ID가 필수이므로,
    // 안건 목록을 먼저 가져온 후 각 안건별로 표결 정보를 조회해야 함
    if (member.votes.length === 0) {
      try {
        // Step 1: 안건 목록 가져오기 (최근 50개)
        const { fetchBills } = await import('@/lib/assembly-api');
        const billsData = await fetchBills({
          age: '22',
          pSize: 50,
        });

        // Step 2: 안건 데이터 파싱
        const responseKey = Object.keys(billsData)[0];
        const responseData = billsData[responseKey] as any[];
        const rowData = responseData.find((item: any) => item.row);

        console.log(`Processing bills data...`);

        if (rowData && rowData.row && rowData.row.length > 0) {
          let votesFound = 0;

          // Step 3: 각 안건의 BILL_ID로 표결 정보 조회 (최대 50개)
          for (const billData of rowData.row.slice(0, 50)) {
            // 표결이 있는 안건만 (원안가결, 수정가결 등)
            if (!billData.VOTE_TCNT || parseInt(billData.VOTE_TCNT) === 0) {
              continue;
            }

            try {
              // ✨ HG_NM 파라미터 추가: 해당 의원의 표결만 가져오기 (응답 크기 대폭 감소)
              const voteData = await fetchVoteRecords({
                billId: billData.BILL_ID,
                memberName: member.name, // HG_NM 필터 추가
                age: '22',
                pSize: 1, // 1명만 가져오면 충분
              });

              const voteResponseKey = Object.keys(voteData)[0];
              const voteResponseData = voteData[voteResponseKey];
              const voteRowData = voteResponseData.find((item: any) => item.row);

              if (voteRowData && voteRowData.row && voteRowData.row.length > 0 && member) {
                // HG_NM 필터 덕분에 첫 번째 항목이 바로 해당 의원의 표결
                const memberVote = voteRowData.row[0];

                if (memberVote) {
                  console.log(`✅ Found vote for ${member.name} on ${billData.BILL_NM}: ${memberVote.RESULT_VOTE_MOD}`);
                  votesFound++;

                  // DB에 저장
                  // 1. Bill 저장
                  const billCommonData = {
                    billNumber: billData.BILL_NO,
                    billName: billData.BILL_NM,
                    proposer: billData.PROPOSER || null,
                    voteDate: billData.RGS_PROC_DT ? new Date(billData.RGS_PROC_DT) : null,
                    isPassed: billData.PROC_RESULT_CD?.includes('가결') || false,
                    favorCount: billData.YES_TCNT ? parseInt(billData.YES_TCNT) : null,
                    againstCount: billData.NO_TCNT ? parseInt(billData.NO_TCNT) : null,
                    abstainCount: billData.BLANK_TCNT ? parseInt(billData.BLANK_TCNT) : null,
                  };

                  const savedBill = await prisma.bill.upsert({
                    where: { billId: billData.BILL_ID },
                    create: {
                      billId: billData.BILL_ID,
                      ...billCommonData,
                    },
                    update: billCommonData,
                  });

                  // 2. Vote 저장
                  const voteResultMap: Record<string, 'FAVOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT'> = {
                    '찬성': 'FAVOR',
                    '반대': 'AGAINST',
                    '기권': 'ABSTAIN',
                    '불참': 'ABSENT',
                  };

                  const rawResult = memberVote.RESULT_VOTE_MOD;
                  const voteResult = voteResultMap[rawResult];

                  // ✨ 예상치 못한 표결 결과 값 검증
                  if (!voteResult) {
                    console.error(`⚠️ 알 수 없는 표결 결과: "${rawResult}" (의원: ${member.name}, 안건: ${savedBill.billName})`);
                    throw new Error(`Unknown vote result: ${rawResult}`);
                  }

                  await prisma.vote.upsert({
                    where: {
                      memberId_billId: {
                        memberId: member.id,
                        billId: savedBill.id,
                      },
                    },
                    create: {
                      memberId: member.id,
                      billId: savedBill.id,
                      result: voteResult,
                    },
                    update: {
                      result: voteResult,
                    },
                  });
                }
              }

              // API 호출 제한을 위해 잠시 대기
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`Error fetching votes for bill ${billData.BILL_ID}:`, error);
            }
          }

          console.log(`Total votes found for ${member.name}: ${votesFound}`);

          // DB에서 다시 조회
          const updatedMember = await prisma.assemblyMember.findUnique({
            where: { id: member.id },
            include: {
              votes: {
                include: {
                  bill: true,
                },
                orderBy: {
                  bill: {
                    voteDate: 'desc',
                  },
                },
              },
            },
          });

          if (updatedMember) {
            member = updatedMember;
          }
        }
      } catch (error) {
        console.error('External API error:', error);
      }
    }

    // 3. 표결 결과 통계 계산 (전체 데이터 기준)
    const voteStats = member.votes.reduce(
      (acc, vote) => {
        acc[vote.result]++;
        return acc;
      },
      { FAVOR: 0, AGAINST: 0, ABSTAIN: 0, ABSENT: 0 } as Record<string, number>
    );

    // 4. 페이지네이션된 응답 반환 (DB에서만 처리)
    const totalVotes = member.votes.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedVotes = member.votes.slice(startIndex, endIndex);

    // hasMore 판단: DB에 더 많은 데이터가 있는지만 확인
    const hasMore = endIndex < totalVotes;

    console.log(`Pagination: page=${page}, totalVotes=${totalVotes}, returning ${paginatedVotes.length} votes, hasMore=${hasMore}`);

    return NextResponse.json({
      member: {
        ...member,
        votes: paginatedVotes,
      },
      stats: voteStats,
      pagination: {
        page,
        pageSize,
        total: totalVotes,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching member votes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member votes' },
      { status: 500 }
    );
  }
}
