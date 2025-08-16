"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, orderBy,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import ReadingMissionList from "./ReadingMissionList";

export default function MyPage() {
  const [nickname, setNickname] = useState("");
  const [inputNickname, setInputNickname] = useState("");
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState(0);
  const [email, setEmail] = useState("");
  const [userUid, setUserUid] = useState<string | null>(null);

  // 랭킹/총 인원
  const [rank, setRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const topPercent =
    rank && totalUsers ? Math.min(100, Math.max(1, Math.round((rank / totalUsers) * 100))) : null;

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      setUserUid(user.uid);
      setEmail(user.email || "");

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        const fetchedNickname = data.nickname || user.email || "";
        setNickname(fetchedNickname);
        setInputNickname(fetchedNickname);
        setPoints(data.point || 0);
      }

      await computeMyRank(user.uid);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userUid) computeMyRank(userUid);
  }, [points, userUid]);

  // 내 등수 계산 (포인트 내림차순)
  const computeMyRank = async (uid: string) => {
    try {
      const qy = query(collection(db, "users"), orderBy("point", "desc"));
      const snap = await getDocs(qy);
      const ids = snap.docs.map((d) => d.id);
      setTotalUsers(ids.length);
      const idx = ids.indexOf(uid);
      setRank(idx === -1 ? null : idx + 1);
    } catch (e) {
      console.error("랭킹 계산 실패:", e);
    }
  };

  const updatePoints = async (newPoints: number) => {
    if (!userUid) return;
    const ref = doc(db, "users", userUid);
    await setDoc(ref, { point: newPoints }, { merge: true });
    setPoints(newPoints);
  };

  const handleMissionReward = (reward: number) => {
    updatePoints(points + reward);
  };

  const getRankName = (p: number): string => {
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
    return ranks.find(([cut]) => p >= cut)?.[1] || "";
  };

  const getNextRankPoint = (p: number): number => {
    const cuts = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
    for (let i = 0; i < cuts.length; i++) if (p < cuts[i]) return cuts[i] - p;
    return 0;
  };

  const progressToNext = () => {
    const cuts = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
    const next = cuts.find((c) => c > points);
    if (!next) return 100;
    const prev = [...cuts].reverse().find((c) => c <= points) || 0;
    return ((points - prev) / (next - prev)) * 100;
  };

  return (
    // 홈 컨테이너 폭과 동일
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 space-y-10">
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
                  await updateDoc(doc(db, "users", user.uid), { nickname: inputNickname });
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
              <span className="font-semibold text-lg text-gray-800">
                {nickname || email || "이름 없음"}
              </span>
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

      {/* 포인트/등급 + 내 등수·상위% */}
      <section className="bg-white p-6 rounded-2xl shadow-md space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold text-gray-800">
            🏅 포인트: <span className="text-yellow-500">{points}p</span>
          </p>
          <p className="text-sm text-gray-500">
            {totalUsers === 0 ? (
              "랭킹 계산 중..."
            ) : rank ? (
              <>
                내 등수 <span className="font-semibold">{rank}위</span>
                {" · "}
                상위 <span className="font-semibold">{topPercent}%</span>
              </>
            ) : (
              "랭킹 정보 없음"
            )}
          </p>
        </div>

        <p className="text-sm text-gray-700">
          등급: <span className="font-semibold">{getRankName(points)}</span>
        </p>
        <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-300 rounded-full transition-all duration-300"
            style={{ width: `${progressToNext()}%` }}
          />
        </div>
        <p className="text-sm text-right text-gray-500">
          다음 등급까지 {getNextRankPoint(points)}p 남음
        </p>
      </section>

      {/* 내 독서 기록 */}
      <section className="bg-white p-6 rounded-2xl shadow-md space-y-4">
        <h2 className="text-lg font-bold text-gray-800">📖 내 독서 미션</h2>
        <ReadingMissionList showForm={true} onReward={handleMissionReward} />
      </section>
    </div>
  );
}
