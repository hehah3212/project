"use client";

import { useState } from "react";

export default function FriendTab() {
  const [search, setSearch] = useState("");

  const friends = [
    { name: "지우", point: 7200 },
    { name: "민기", point: 6000 },
    { name: "정환", point: 4300 },
    { name: "유진", point: 2100 },
  ];

  const getRankName = (points: number): string => {
    const ranks: [number, string][] = [
      [8000, "독서의 끝을 본 자"],
      [7000, "활자에 빠진 자"],
      [6000, "활자의 즐거움을 아는 자"],
      [5000, "독서가 일상인 자"],
      [4000, "책과 친구가 된 자"],
      [3000, "꾸준히 읽는 자"],
      [2000, "책장을 익히는 자"],
      [1000, "한 장을 넘긴 자"],
      [0, "독서의 문을 두드리는 자"]
    ];
    return ranks.find(([p]) => points >= p)?.[1] || "";
  };

  const filtered = friends
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.point - a.point);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">👥 친구 관리</h2>

      <input
        type="text"
        placeholder="친구 이름 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded px-4 py-2"
      />

      {/* Top 3 그래프 */}
      <div className="space-y-2">
        {filtered.slice(0, 3).map((f, i) => (
          <div key={f.name} className="space-y-1">
            <div className="flex justify-between">
              <span className="font-medium">
                {["🥇","🥈","🥉"][i]}: {f.name} ({getRankName(f.point)})
              </span>
              <span className="text-sm text-gray-500">{f.point}p</span>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded">
              <div
                className="bg-yellow-400 h-3 rounded"
                style={{ width: `${(f.point / filtered[0].point) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* 친구 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-400">친구를 찾을 수 없습니다.</p>
        ) : (
          filtered.map((f, i) => (
            <div
              key={f.name}
              className="bg-white p-4 rounded-xl shadow flex justify-between items-center"
            >
              <div>
                <p className="font-medium">{i + 1}. {f.name}</p>
                <p className="text-sm text-gray-500">포인트: {f.point}점</p>
                <p className="text-sm text-gray-400">등급: {getRankName(f.point)}</p>
              </div>
              <button className="text-sm text-red-500 hover:underline">삭제</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
