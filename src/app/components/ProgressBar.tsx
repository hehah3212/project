import React from "react";

type ProgressBarProps = {
  value: number;
  label?: string; // 이 줄이 핵심!
  max?:number;
};

export default function ProgressCard() {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col gap-4">
      <h2 className="text-lg font-bold text-gray-800">📈 오늘의 목표</h2>

      <div className="space-y-2">
        <div>
          <p className="text-sm text-gray-600 mb-1">오늘의 독서량</p>
          <div className="w-full bg-gray-200 h-3 rounded-full">
            <div className="bg-indigo-500 h-3 rounded-full w-1/2 transition-all duration-300"></div>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">주간 목표 달성률</p>
          <div className="w-full bg-gray-200 h-3 rounded-full">
            <div className="bg-indigo-500 h-3 rounded-full w-4/5 transition-all duration-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
}