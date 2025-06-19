"use client";

import { useEffect, useState } from "react";
import { getFirestore, collection, query, orderBy, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../utils/firebase";

export default function RankingCard() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const currentUser = getAuth().currentUser;

  useEffect(() => {
    const fetchRankings = async () => {
      const ref = collection(db, "users");
      const q = query(ref, orderBy("booksReadCount", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRankings(list);
    };
    fetchRankings();
  }, []);

  const filtered = rankings.filter((user) =>
    user.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md space-y-6">
      <h2 className="text-xl font-bold text-gray-800">🏆 친구 랭킹</h2>

      <input
        type="text"
        placeholder="닉네임 검색"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full border rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      <ol className="space-y-3">
        {filtered.map((user, index) => (
          <li
            key={user.id}
            className="bg-gray-50 p-4 rounded-xl flex justify-between items-center"
          >
            <div>
              <p className="font-semibold text-base">
                {index + 1}. {user.nickname || user.email}
              </p>
              <p className="text-sm text-gray-500">
                {user.booksReadCount || 0}권 읽음
              </p>
            </div>
            {user.id === currentUser?.uid && (
              <span className="text-xs text-blue-500">(나)</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
