import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchVoteRecords } from '@/lib/assembly-api';

// 특정 의원의 표결 내역 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. DB에서 의원 정보와 표결 내역 조회
    const memberData = await prisma.assemblyMember.findUnique({
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
        // Step 1: 안건 목록 가져오기 (최근 100개)
        const { fetchBills } = await import('@/lib/assembly-api');
        const billsData = await fetchBills({
          age: '22',
          pSize: 20, // 일단 20개만
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
              const voteData = await fetchVoteRecords({
                billId: billData.BILL_ID,
                age: '22',
              });

              const voteResponseKey = Object.keys(voteData)[0];
              const voteResponseData = voteData[voteResponseKey];
              const voteRowData = voteResponseData.find((item: any) => item.row);

              if (voteRowData && voteRowData.row && member) {
                // 해당 의원의 표결만 찾기
                const memberVote = voteRowData.row.find(
                  (vote: any) => vote.HG_NM === member.name
                );

                if (memberVote) {
                  console.log(`Found vote for ${member.name} on ${billData.BILL_NM}: ${memberVote.RESULT_VOTE_MOD}`);
                  votesFound++;

                  // DB에 저장
                  // 1. Bill 저장
                  const savedBill = await prisma.bill.upsert({
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

                  // 2. Vote 저장
                  const voteResultMap: Record<string, any> = {
                    '찬성': 'FAVOR',
                    '반대': 'AGAINST',
                    '기권': 'ABSTAIN',
                    '불참': 'ABSENT',
                  };

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
                      result: voteResultMap[memberVote.RESULT_VOTE_MOD] || 'ABSTAIN',
                    },
                    update: {
                      result: voteResultMap[memberVote.RESULT_VOTE_MOD] || 'ABSTAIN',
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
          member = await prisma.assemblyMember.findUnique({
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
          }) || member;
        }
      } catch (error) {
        console.error('External API error:', error);
      }
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Error fetching member votes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member votes' },
      { status: 500 }
    );
  }
}
