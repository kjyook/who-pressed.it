import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchVoteRecords } from '@/lib/assembly-api';

const VOTES_PER_PAGE = 50;

// 특정 안건에 대한 표결 결과 조회 (어떤 의원이 어떻게 투표했는지)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || String(VOTES_PER_PAGE));

    // 1. DB에서 안건과 표결 결과 조회
    let bill = await prisma.bill.findUnique({
      where: { id: parseInt(id) },
      include: {
        votes: {
          include: {
            member: true,
          },
          orderBy: {
            member: {
              name: 'asc',
            },
          },
        },
      },
    });

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // 2. DB에 표결 데이터가 없으면 API 호출 (한번에 모두 가져오기)
    // DB에 이미 데이터가 있으면 API는 호출하지 않음
    if (bill.votes.length === 0) {
      try {
        // Open API는 BILL_ID로 조회 시 pIndex가 작동하지 않고 모든 데이터를 반환
        // 따라서 한 번에 모두 가져옴 (pSize 500)
        const apiData = await fetchVoteRecords({
          billId: bill.billId,
          pIndex: 1,
          pSize: 500,
        });

        console.log(`Bill votes API request: fetching all data for bill ${bill.billId}`);

        // API 응답 확인 (타입 단언 사용)
        const apiResponse = apiData as any;
        if (apiResponse.RESULT) {
          console.log(`No vote data from API: ${apiResponse.RESULT.MESSAGE}`);
          // 데이터가 없으면 그냥 종료
        } else {
          // API 응답 파싱
          const responseKey = Object.keys(apiData)[0];
          const responseData = apiData[responseKey];

          // responseData가 배열인지 확인
          if (!Array.isArray(responseData)) {
            console.log('Unexpected API response format:', responseData);
            return;
          }

          const rowData = responseData.find((item: any) => item.row);

          if (rowData && rowData.row && rowData.row.length > 0) {
            console.log(`API returned ${rowData.row.length} vote records`);

            // ✨ 성능 개선: 병렬 처리 + 트랜잭션으로 속도 향상 및 원자성 보장
            const BATCH_SIZE = 50;
            const voteData = rowData.row;
            const savedVotes: any[] = []; // 저장된 표결 데이터 누적

            for (let batchStart = 0; batchStart < voteData.length; batchStart += BATCH_SIZE) {
              const batch = voteData.slice(batchStart, batchStart + BATCH_SIZE);

              const batchVotes = await prisma.$transaction(async (tx) => {
                // 1. 의원 정보 병렬 저장
                const memberPromises = batch.map((vote: any) =>
                  tx.assemblyMember.upsert({
                    where: { memberId: vote.MONA_CD },
                    create: {
                      memberId: vote.MONA_CD,
                      name: vote.HG_NM,
                      engName: null,
                      party: vote.POLY_NM,
                      district: vote.ORIG_NM,
                      committee: null,
                      termNumber: parseInt(vote.AGE) || 22,
                      reelection: false,
                      profileUrl: null,
                    },
                    update: {
                      name: vote.HG_NM,
                      party: vote.POLY_NM,
                      district: vote.ORIG_NM,
                    },
                  })
                );

                const members = await Promise.all(memberPromises);

                // 2. 표결 정보 병렬 저장 및 member 데이터와 함께 반환
                const votePromises = batch.map(async (vote: any, index: number) => {
                  // 표결 결과 매핑
                  const voteResultMap: Record<string, 'FAVOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT'> = {
                    '찬성': 'FAVOR',
                    '가': 'FAVOR',
                    '반대': 'AGAINST',
                    '부': 'AGAINST',
                    '기권': 'ABSTAIN',
                    '불참': 'ABSENT',
                  };

                  const rawResult = vote.RESULT_VOTE_MOD?.trim();
                  const voteResult = voteResultMap[rawResult];

                  // ✨ 예상치 못한 표결 결과 값 검증
                  if (!voteResult) {
                    console.error(`⚠️ 알 수 없는 표결 결과: "${rawResult}" (안건: ${bill.billName})`);
                    throw new Error(`Unknown vote result: ${rawResult}`);
                  }

                  const savedVote = await tx.vote.upsert({
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

                  // 저장된 표결 정보와 의원 정보를 함께 반환
                  return {
                    ...savedVote,
                    member: members[index],
                  };
                });

                return await Promise.all(votePromises);
              });

              savedVotes.push(...batchVotes);

              // 진행 상황 표시
              if (voteData.length > BATCH_SIZE) {
                console.log(`  └─ ${Math.min(batchStart + BATCH_SIZE, voteData.length)}/${voteData.length} 처리됨...`);
              }
            }

            console.log(`✅ Saved ${voteData.length} vote records for bill ${bill.id}`);

            // ✨ 불필요한 DB 조회 제거: 이미 저장된 데이터를 재사용
            // 이름순으로 정렬
            bill.votes = savedVotes.sort((a, b) => a.member.name.localeCompare(b.member.name));
          } else {
            // API가 빈 데이터를 반환
            console.log('API returned no vote records');
          }
        }
      } catch (error) {
        console.error('External API error:', error);
      }
    }

    // 3. 표결 결과 통계 계산 (전체 데이터 기준)
    const voteStats = bill.votes.reduce(
      (acc, vote) => {
        acc[vote.result.toLowerCase()]++;
        return acc;
      },
      { favor: 0, against: 0, abstain: 0, absent: 0 } as Record<string, number>
    );

    // 4. 페이지네이션된 응답 반환 (DB에서만 처리)
    const totalVotes = bill.votes.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedVotes = bill.votes.slice(startIndex, endIndex);

    // hasMore 판단: DB에 더 많은 데이터가 있는지만 확인
    const hasMore = endIndex < totalVotes;

    console.log(`Pagination: page=${page}, totalVotes=${totalVotes}, returning ${paginatedVotes.length} votes, hasMore=${hasMore}`);

    return NextResponse.json({
      bill: {
        ...bill,
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
    console.error('Error fetching bill votes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bill votes' },
      { status: 500 }
    );
  }
}
