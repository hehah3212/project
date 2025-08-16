// src/app/components/RankingCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../utils/firebase";

type UserRow = {
  id: string; // UID
  nickname?: string;
  email?: string;
  point?: number;
  booksReadCount?: number;
};

function getRankName(points: number): string {
  const ranks: [number, string][] = [
    [8000, "독서의 끝을 본 자"],
    [7000, "활자에 빠진 자"],
    [6000, "활자의 즐거움을 아는 자"],
    [5000, "독서가 일상인 자"],
    [4000, "책과 친구가 된 자"],
    [3000, "꾸준히 읽는 자"],
    [2000, "책장을 익히는 자"],
    [1000, "한 장을 넘긴 자"],
    [0, "독서의 문을 두드리는 자"],
  ];
  return ranks.find(([p]) => points >= p)?.[1] || "";
}

export default function RankingCard() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uid, setUid] = useState<string | null>(null);

  // 로그인 유저 감시
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // uid 있을 때만 실시간 구독
  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "users"), orderBy("point", "desc"), limit(10));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UserRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setRows(list);
        setLoading(false);
      },
      (err: any) => {
        if (err?.code !== "permission-denied") console.error("ranking onSnapshot:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  const filtered = useMemo(() => {
    const key = search.trim().toLowerCase();
    if (!key) return rows;
    return rows.filter((u) => (u.nickname || u.email || u.id).toLowerCase().includes(key));
  }, [rows, search]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
      <h2 className="text-xl font-bold text-gray-800">🏆 전체 랭킹</h2>

      <input
        type="text"
        placeholder="닉네임/UID 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">사용자가 없습니다.</p>
      ) : (
        <ol className="space-y-3">
          {filtered.map((u, i) => {
            const pts = Number(u.point || 0);
            return (
              <li
                key={u.id}
                className="bg-gray-50 p-4 rounded-xl flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-base">
                    {i + 1}. {u.nickname || u.email || `${u.id.slice(0, 8)}…`}
                    {u.id === uid && <span className="ml-1 text-xs text-blue-500">(나)</span>}
                  </p>
                  <p className="text-sm text-gray-500">
                    {pts}p <span className="text-gray-300">·</span> {getRankName(pts)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
