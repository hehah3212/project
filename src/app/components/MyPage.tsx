"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import ReadingMissionList from "./ReadingMissionList";
import FriendTab from "./FriendTap";

export default function MyPage() {
  const [nickname, setNickname] = useState("");
  const [inputNickname, setInputNickname] = useState("");
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState(0);
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState<"friend" | "history">("friend");
  const [userUid, setUserUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserUid(user.uid);
        setEmail(user.email || "");

        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const fetchedNickname = data.nickname || user.email || "";
          setNickname(fetchedNickname);
          setInputNickname(fetchedNickname);
          setPoints(data.point || 0);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // ✅ setDoc 사용으로 문서가 없을 때 자동 생성됨
  const updatePoints = async (newPoints: number) => {
    if (!userUid) return;
    const ref = doc(db, "users", userUid);
    await setDoc(ref, { point: newPoints }, { merge: true }); // 🔥 문서 없을 시 생성
    setPoints(newPoints);
    console.log("🔥 포인트 저장됨:", newPoints);
  };

  const handleMissionReward = (reward: number) => {
    updatePoints(points + reward);
  };

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

  const getNextRankPoint = (points: number): number => {
    const ranks = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
    for (let i = 0; i < ranks.length; i++) {
      if (points < ranks[i]) return ranks[i] - points;
    }
    return 0;
  };

  const progressToNext = () => {
    const next = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000].find(p => p > points);
    if (!next) return 100;
    const prev = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000].reverse().find(p => p <= points) || 0;
    return ((points - prev) / (next - prev)) * 100;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">📘 내 정보</h2>

      <section className="bg-white p-4 rounded-xl shadow space-y-2">
        <p className="font-medium text-gray-600">닉네임</p>
        <div className="flex gap-2 items-center">
          {editing ? (
            <>
              <input
                className="border rounded px-2 py-1 flex-1"
                value={inputNickname}
                onChange={(e) => setInputNickname(e.target.value)}
              />
              <button
                onClick={async () => {
                  const user = getAuth().currentUser;
                  if (!user) return;
                  const ref = doc(db, "users", user.uid);
                  await updateDoc(ref, { nickname: inputNickname });
                  setNickname(inputNickname);
                  setEditing(false);
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setInputNickname(nickname);
                }}
                className="text-sm text-gray-500"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <span className="font-medium text-lg">{nickname || email || "이름 없음"}</span>
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-blue-500 hover:underline"
              >
                수정
              </button>
            </>
          )}
        </div>
      </section>

      <section className="bg-white p-4 rounded-xl shadow space-y-2">
        <p className="text-lg font-medium">📊 포인트: {points}점</p>
        <p className="text-sm text-gray-600">등급: {getRankName(points)}</p>
        <p className="text-sm text-gray-600">닉네임: {nickname || email || "이름 없음"}</p>
        <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-200 rounded-full"
            style={{ width: `${progressToNext()}%` }}
          ></div>
        </div>
        <p className="text-sm text-right text-gray-500">
          다음 등급까지 {getNextRankPoint(points)}p
        </p>
        <div className="flex gap-2 mt-2">
          <button
            className="px-4 py-1 bg-blue-500 text-white text-sm rounded"
            onClick={() => updatePoints(points + 100)}
          >
            +100 포인트
          </button>
          <button
            className="px-4 py-1 bg-red-500 text-white text-sm rounded"
            onClick={() => updatePoints(Math.max(0, points - 100))}
          >
            -100 포인트
          </button>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded ${tab === "friend" ? "bg-blue-100" : "bg-gray-100"} hover:bg-gray-200`}
          onClick={() => setTab("friend")}
        >
          친구 관리
        </button>
        <button
          className={`px-4 py-2 rounded ${tab === "history" ? "bg-blue-100" : "bg-gray-100"} hover:bg-gray-200`}
          onClick={() => setTab("history")}
        >
          내 독서 기록
        </button>
      </div>

      <div>
        {tab === "friend" && <FriendTab />}
        {tab === "history" && (
          <ReadingMissionList showForm={true} onReward={handleMissionReward} />
        )}
      </div>
    </div>
  );
}
