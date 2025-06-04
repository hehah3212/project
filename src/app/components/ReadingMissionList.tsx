"use client";

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
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
};

export default function ReadingMissionList({ onReward }: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState(100);
  const [reward, setReward] = useState(100);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchMissions = async () => {
      if (!user) return;
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

      setMissions(data);
      setLoading(false);
    };

    fetchMissions();
  }, [user]);

  const updateProgress = async (id: string, delta: number) => {
    if (!user) return;

    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== id || m.completed) return m;

        const newProgress = Math.min(100, Math.max(0, m.progress + delta));
        const justCompleted = newProgress >= 100 && !m.completed;

        const ref = doc(db, "users", user.uid, "missions", id);
        updateDoc(ref, {
          progress: newProgress,
          completed: justCompleted ? true : m.completed,
        });

        if (justCompleted) {
          onReward(m.reward);
        }

        return {
          ...m,
          progress: newProgress,
          completed: justCompleted ? true : m.completed,
        };
      })
    );
  };

  const addMission = async () => {
    if (!user || !title || !startDate || !endDate) return;

    const ref = collection(db, "users", user.uid, "missions");
    const docRef = await addDoc(ref, {
      title,
      startDate,
      endDate,
      goal,
      reward,
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
        goal,
        reward,
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

  const deleteMission = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "missions", id));
    setMissions((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) return <p>로딩 중...</p>;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">🎯 독서 미션</h3>

      {/* 미션 추가 폼 */}
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

        {/* ⬇ 이 부분이 수정된 핵심 부분 */}
        <div className="flex gap-2">
          <div className="flex flex-col w-full">
            <label className="text-sm text-gray-600 mb-1">🎯 목표 페이지 수</label>
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              placeholder="예: 100"
              className="border px-2 py-1 rounded"
            />
          </div>
          <div className="flex flex-col w-full">
            <label className="text-sm text-gray-600 mb-1">🏅 보상 포인트</label>
            <input
              type="number"
              value={reward}
              onChange={(e) => setReward(Number(e.target.value))}
              placeholder="예: 100"
              className="border px-2 py-1 rounded"
            />
          </div>
        </div>

        <button
          onClick={addMission}
          className="w-full bg-blue-500 text-white text-sm py-1 rounded"
        >
          미션 추가
        </button>
      </div>

      {/* 미션 목록 */}
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

          <p className="text-sm text-right text-gray-500">진행률: {m.progress}%</p>

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
