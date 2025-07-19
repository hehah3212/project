"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../utils/firebase";

type Mission = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  goal: number;
  progress: number;
  reward: number;
  completed: boolean;
};

type Props = {
  onReward: (reward: number) => void;
  showForm?: boolean;
  onlyActive?: boolean;
};

export default function ReadingMissionList({
  onReward,
  showForm = true,
  onlyActive = false,
}: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState(100);
  const [reward, setReward] = useState(100);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ─── 전체 미션 불러오는 함수 ───────────────────────────────────────
  const fetchMissions = async (uid: string) => {
    console.log("🔄 fetchMissions 호출, uid =", uid);
    const ref = collection(db, "users", uid, "missions");
    const snap = await getDocs(ref);
    const data: Mission[] = snap.docs.map((d) => {
      const m = d.data();
      return {
        id: d.id,
        title: m.title,
        startDate: m.startDate,
        endDate: m.endDate,
        goal: m.goal,
        progress: m.progress,
        reward: m.reward,
        completed: m.completed,
      };
    });
    console.log("🔄 원본 미션 데이터:", data);
    const filtered = onlyActive ? data.filter((m) => !m.completed) : data;
    console.log("🔄 필터링 후 미션 데이터:", filtered);
    setMissions(filtered);
    setLoading(false);
  };

  // ─── 로그인 후 최초 로드 + pending-delta 처리 ────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;


      setUserUid(user.uid);
      console.log("🔑 현재 로그인된 UID:", user.uid);

      // 2️⃣ 바로 missions 서브컬렉션에서 어떤 문서를 읽어 오는지 확인
      const testSnap = await getDocs(
        collection(db, "users", user.uid, "missions")
      );
      console.log(
        "📂 테스트로 읽어온 미션 IDs:",
        testSnap.docs.map((d) => d.id)
      );

      // 1) 미션 불러오기
      await fetchMissions(user.uid);

      // 2) localStorage에 남은 delta 처리
      const pending = localStorage.getItem("pending-delta");
      if (pending) {
        const delta = Number(pending);
        console.log("📌 [미션] fetch 후 pending-delta 처리:", delta);
        updateMissionProgressFromReading(delta, user.uid);
        localStorage.removeItem("pending-delta");
      }
    });
    return () => unsubscribe();
  }, [onlyActive]);

  // ─── reading-progress 이벤트로 즉시 진행률만 업데이트 ─────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const delta = (e as CustomEvent<number>).detail;
      console.log("📌 [미션] reading-progress 이벤트 받음:", delta);
      updateMissionProgressFromReading(delta);
    };
    window.addEventListener("reading-progress", handler);
    return () => window.removeEventListener("reading-progress", handler);
  }, [userUid]);

  // ─── 필요하면 전체 목록 재조회(sync) ──────────────────────────────
  useEffect(() => {
    const syncHandler = async () => {
      if (!userUid) return;
      console.log("📌 [미션] reading-progress-sync 수신 → fetch");
      await fetchMissions(userUid);
    };
    window.addEventListener("reading-progress-sync", syncHandler);
    return () => window.removeEventListener("reading-progress-sync", syncHandler);
  }, [userUid]);

  // ─── 진행률 계산 + DB 업데이트 ───────────────────────────────────
  const updateMissionProgressFromReading = async (
    delta: number,
    uidParam?: string
    ) => {
    const uid = uidParam ?? userUid;
    if (!uid) return;
    console.log("[🚧 MissionList] update 호출, delta =", delta);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    setMissions((prev) => {
      console.log("[🚧 이전 missions 상태]:", prev);
      const updated = prev.map((m) => {
        const s = new Date(m.startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(m.endDate);
        e.setHours(0, 0, 0, 0);

        if (m.completed || today < s || today > e) {
          return m;
        }

        const added = (delta / m.goal) * 100;
        const np = Math.min(100, m.progress + added);
        const justDone = np >= 100 && !m.completed;
        if (justDone) onReward(m.reward);

        // Firestore 업데이트
        updateDoc(doc(db, "users", uid, "missions", m.id), {
          progress: np,
          completed: justDone,
        });

        return { ...m, progress: np, completed: justDone };
      });
      console.log("[🚧 업데이트된 missions 상태]:", updated);
      return updated;
    });
  };



  // ─── 새 미션 추가 ───────────────────────────────────────────────
  const addMission = async () => {
    if (!userUid || !title || !startDate || !endDate) return;
    const goalNum = Number(goal);
    const rewardNum = Number(reward);
    const ref = collection(db, "users", userUid, "missions");
    const docRef = await addDoc(ref, {
      title,
      startDate,
      endDate,
      goal: goalNum,
      reward: rewardNum,
      progress: 0,
      completed: false,
    });
    setMissions((prev) => [
      ...prev,
      {
        id: docRef.id,
        title,
        startDate,
        endDate,
        goal: goalNum,
        reward: rewardNum,
        progress: 0,
        completed: false,
      },
    ]);
    setTitle("");
    setStartDate("");
    setEndDate("");
    setGoal(100);
    setReward(100);
  };

  // ─── 미션 삭제 ───────────────────────────────────────────────
  const deleteMission = async (id: string) => {
    if (!userUid) return;
    await deleteDoc(doc(db, "users", userUid, "missions", id));
    setMissions((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) return <p>로딩 중...</p>;

  // ─── 렌더링 ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">🎯 독서 미션</h3>

      {/* ➕ 새 미션 추가 폼 */}
      {showForm && (
        <div className="bg-white p-4 rounded-xl shadow space-y-2">
          <h4 className="font-semibold">➕ 새 미션 추가</h4>
          <input
            type="text"
            placeholder="미션 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border px-2 py-1 rounded"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border px-2 py-1 rounded w-full"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border px-2 py-1 rounded w-full"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col w-full">
              <label className="text-sm text-gray-600 mb-1">🎯 목표 페이지 수</label>
              <input
                type="number"
                value={goal}
                onChange={(e) => {
                  const g = Number(e.target.value);
                  setGoal(g);
                  setReward(g);
                }}
                className="border px-2 py-1 rounded"
              />
            </div>
            <div className="flex flex-col w-full">
              <label className="text-sm text-gray-600 mb-1">🏅 보상 포인트</label>
              <input
                type="number"
                value={reward}
                readOnly
                className="border px-2 py-1 rounded bg-gray-100 text-gray-600"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={addMission}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded"
            >
              ➕ 미션 추가
            </button>
          </div>
        </div>
      )}

      {/* 미션 리스트 */}
      {missions.map((m) => (
        <div key={m.id} className="bg-white p-4 rounded-xl shadow space-y-2">
          <p className="font-medium">{m.title}</p>
          <p className="text-sm text-gray-500">
            기간: {m.startDate} ~ {m.endDate}
          </p>
          <p className="text-sm text-gray-500">보상: {m.reward}포인트</p>
          <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400"
              style={{ width: `${m.progress}%` }}
            />
          </div>
          <p className="text-sm text-right text-gray-500">
            진행률: {Math.round(m.progress)}%
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteMission(m.id)}
              className="text-xs bg-gray-300 text-black px-2 py-1 rounded ml-auto"
            >
              삭제
            </button>
          </div>
          {m.completed && (
            <p className="text-green-600 text-sm font-semibold">
              ✅ 완료! {m.reward}포인트 획득
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
