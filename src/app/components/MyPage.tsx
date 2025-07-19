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

  const updatePoints = async (newPoints: number) => {
    if (!userUid) return;
    const ref = doc(db, "users", userUid);
    await setDoc(ref, { point: newPoints }, { merge: true });
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
    <div className="p-6 max-w-4xl mx-auto space-y-10">
      <h2 className="text-2xl font-bold text-gray-800">📘 내 정보</h2>

      {/* 닉네임 카드 */}
      <section className="bg-white p-6 rounded-2xl shadow-md space-y-3">
        <p className="text-sm text-gray-500 font-medium">닉네임</p>
        <div className="flex gap-3 items-center">
          {editing ? (
            <>
              <input
                className="border rounded px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-yellow-300"
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
                className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-2 rounded"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setInputNickname(nickname);
                }}
                className="text-sm text-gray-400 hover:underline"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <span className="font-semibold text-lg text-gray-800">{nickname || email || "이름 없음"}</span>
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

      {/* 포인트 등급 카드 */}
      <section className="bg-white p-6 rounded-2xl shadow-md space-y-3">
        <p className="text-lg font-bold text-gray-800">🏅 포인트: <span className="text-yellow-500">{points}p</span></p>
        <p className="text-sm text-gray-700">등급: <span className="font-semibold">{getRankName(points)}</span></p>
        <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-300 rounded-full transition-all duration-300"
            style={{ width: `${progressToNext()}%` }}
          ></div>
        </div>
        <p className="text-sm text-right text-gray-500">
          다음 등급까지 {getNextRankPoint(points)}p 남음
        </p>
        <div className="flex gap-2 mt-2">
        </div>
      </section>

      {/* 탭 버튼 */}
      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded font-semibold border ${
            tab === "friend" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
          }`}
          onClick={() => setTab("friend")}
        >
          친구 관리
        </button>
        <button
          className={`px-4 py-2 rounded font-semibold border ${
            tab === "history" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
          }`}
          onClick={() => setTab("history")}
        >
          내 독서 기록
        </button>
      </div>

      {/* 탭 내용 */}
      <div>
        {tab === "friend" && <FriendTab />}
        {tab === "history" && (
          <section className="bg-white p-6 rounded-2xl shadow-md space-y-4">
            <h2 className="text-lg font-bold text-gray-800">📖 내 독서 미션</h2>
            <ReadingMissionList showForm={true} onReward={handleMissionReward} />
          </section>
        )}
      </div>
    </div>
  );
}