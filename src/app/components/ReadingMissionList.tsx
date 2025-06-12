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

export default function ReadingMissionList({ onReward, showForm = true, onlyActive = false }: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState(100);
  const [reward, setReward] = useState(100);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserUid(user.uid);

      const ref = collection(db, "users", user.uid, "missions");
      const snapshot = await getDocs(ref);
      const data: Mission[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: d.title,
          startDate: d.startDate,
          endDate: d.endDate,
          goal: d.goal,
          progress: d.progress,
          reward: d.reward,
          completed: d.completed,
        };
      });

      const filtered = onlyActive ? data.filter(m => !m.completed) : data;
      setMissions(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onlyActive]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      updateMissionProgressFromReading(customEvent.detail);
    };

    window.addEventListener("reading-progress", handler);
    return () => window.removeEventListener("reading-progress", handler);
  }, [missions]);

  const updateMissionProgressFromReading = async (delta: number) => {
    if (!userUid) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    setMissions((prev) => {
      const updated = prev.map((m) => {
        const missionStart = new Date(m.startDate);
        missionStart.setHours(0, 0, 0, 0);

        const missionEnd = new Date(m.endDate);
        missionEnd.setHours(0, 0, 0, 0);

        if (
          m.completed ||
          today < missionStart ||
          today > missionEnd
        ) return m;

        const addedProgress = (delta / m.goal) * 100;
        const newProgress = Math.min(100, m.progress + addedProgress);
        const justCompleted = newProgress >= 100 && !m.completed;

        if (justCompleted) {
          console.log("✅ 미션 완료 - 보상 지급:", m.reward);
          onReward(m.reward);
        }

        const ref = doc(db, "users", userUid, "missions", m.id);
        updateDoc(ref, {
          progress: newProgress,
          completed: justCompleted ? true : m.completed,
        });

        return {
          ...m,
          progress: newProgress,
          completed: justCompleted ? true : m.completed,
        };
      });

      return onlyActive ? updated.filter(m => !m.completed) : updated;
    });
  };

  const updateProgress = async (id: string, delta: number) => {
    if (!userUid) return;

    setMissions((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== id || m.completed) return m;

        const newProgress = Math.min(100, Math.max(0, m.progress + delta));
        const justCompleted = newProgress >= 100 && !m.completed;

        const ref = doc(db, "users", userUid, "missions", id);
        updateDoc(ref, {
          progress: newProgress,
          completed: justCompleted ? true : m.completed,
        });

        if (justCompleted) {
          console.log("✅ 수동 완료 - 보상 지급:", m.reward);
          onReward(m.reward);
        }

        return {
          ...m,
          progress: newProgress,
          completed: justCompleted ? true : m.completed,
        };
      });

      return onlyActive ? updated.filter(m => !m.completed) : updated;
    });
  };

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

    const newMission = {
      id: docRef.id,
      title,
      startDate,
      endDate,
      goal: goalNum,
      reward: rewardNum,
      progress: 0,
      completed: false,
    };

    setMissions((prev) => onlyActive ? [...prev, newMission].filter(m => !m.completed) : [...prev, newMission]);

    setTitle("");
    setStartDate("");
    setEndDate("");
    setGoal(100);
    setReward(100);
  };

  const deleteMission = async (id: string) => {
    if (!userUid) return;
    await deleteDoc(doc(db, "users", userUid, "missions", id));
    setMissions((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) return <p>로딩 중...</p>;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">🎯 독서 미션</h3>

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
                placeholder="예: 100"
                className="border px-2 py-1 rounded"
              />
            </div>
            <div className="flex flex-col w-full">
              <label className="text-sm text-gray-600 mb-1">🏅 보상 포인트 (자동 계산)</label>
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
            ></div>
          </div>
          <p className="text-sm text-right text-gray-500">
            진행률: {Math.round(m.progress)}%
          </p>
          <div className="flex gap-2">
            <button
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
              onClick={() => updateProgress(m.id, 10)}
            >
              +10%
            </button>
            <button
              className="text-xs bg-red-500 text-white px-2 py-1 rounded"
              onClick={() => updateProgress(m.id, -10)}
            >
              -10%
            </button>
            <button
              className="text-xs bg-gray-300 text-black px-2 py-1 rounded ml-auto"
              onClick={() => deleteMission(m.id)}
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
