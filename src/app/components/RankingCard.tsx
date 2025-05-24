// src/app/components/RankingCard.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../utils/firebase";

type UserRanking = {
  nickname: string;
  booksReadCount: number;
};

export default function RankingCard() {
  const [rankings, setRankings] = useState<UserRanking[]>([]);

  useEffect(() => {
    const fetchRankings = async () => {
      const q = query(
        collection(db, "users"),
        orderBy("booksReadCount", "desc"),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const result: UserRanking[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          nickname: data.nickname || "익명",
          booksReadCount: data.booksReadCount || 0
        };
      });;
      setRankings(result);
    };

    fetchRankings();
  }, []);

  return (
    <div className="bg-white p-4 rounded-xl shadow space-y-2">
      <h2 className="font-bold text-lg mb-2">🏆 친구 랭킹</h2>
      {rankings.length === 0 ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <ol className="space-y-1">
          {rankings.map((user, index) => (
            <li key={index} className="flex justify-between">
              <span>
                {index + 1}. {user.nickname}
              </span>
              <span className="text-sm text-gray-500">
                {user.booksReadCount}권
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
