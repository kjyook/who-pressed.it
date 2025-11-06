'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';

interface Vote {
  id: number;
  result: string;
  createdAt: string;
  bill: {
    id: number;
    billName: string;
    billNumber: string;
    voteDate: string;
    isPassed: boolean;
  };
}

interface Member {
  id: number;
  name: string;
  engName: string;
  party: string;
  district: string;
  committee: string;
  profileUrl: string | null;
  votes: Vote[];
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const response = await fetch(`/api/members/${params.id}/votes`);
        const data = await response.json();
        setMember(data.member);
      } catch (error) {
        console.error('Failed to fetch member:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    if (params.id) {
      fetchMember();
    }
  }, [params.id]);

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">의원 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const voteStats = member.votes.reduce(
    (acc, vote) => {
      acc[vote.result]++;
      return acc;
    },
    { FAVOR: 0, AGAINST: 0, ABSTAIN: 0, ABSENT: 0 } as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-2"
        >
          ← 홈으로 돌아가기
        </button>

        {/* Member Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {member.name}
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
                {member.engName}
              </p>
              <div className="space-y-2">
                <p className="text-lg">
                  <span className="font-semibold">정당:</span>{' '}
                  <span className="text-blue-600 dark:text-blue-400">{member.party}</span>
                </p>
                <p className="text-lg">
                  <span className="font-semibold">선거구:</span> {member.district}
                </p>
                <p className="text-lg">
                  <span className="font-semibold">소속 위원회:</span>{' '}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {member.committee}
                  </span>
                </p>
              </div>
              {member.profileUrl && (
                <a
                  href={member.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  홈페이지 방문 →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Vote Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-green-100 dark:bg-green-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {voteStats.FAVOR}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-2">찬성</div>
          </div>
          <div className="bg-red-100 dark:bg-red-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-red-700 dark:text-red-300">
              {voteStats.AGAINST}
            </div>
            <div className="text-sm text-red-600 dark:text-red-400 mt-2">반대</div>
          </div>
          <div className="bg-yellow-100 dark:bg-yellow-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
              {voteStats.ABSTAIN}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">기권</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
              {voteStats.ABSENT}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">불참</div>
          </div>
        </div>

        {/* Vote History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            표결 내역 ({member.votes.length}건)
          </h2>

          {member.votes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              표결 내역이 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {member.votes.map((vote) => (
                <div
                  key={vote.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {vote.bill.billName}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>의안번호: {vote.bill.billNumber}</span>
                        <span>•</span>
                        <span>
                          표결일:{' '}
                          {new Date(vote.bill.voteDate).toLocaleDateString('ko-KR')}
                        </span>
                        <span>•</span>
                        <span
                          className={
                            vote.bill.isPassed ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {vote.bill.isPassed ? '가결' : '부결'}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        vote.result === 'FAVOR'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : vote.result === 'AGAINST'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : vote.result === 'ABSTAIN'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {vote.result === 'FAVOR'
                        ? '찬성'
                        : vote.result === 'AGAINST'
                        ? '반대'
                        : vote.result === 'ABSTAIN'
                        ? '기권'
                        : '불참'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
