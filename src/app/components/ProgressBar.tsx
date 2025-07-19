import React from "react";

type ProgressBarProps = {
  value: number;
  label?: string; // 이 줄이 핵심!
  max?:number;
};

export default function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div className="w-full">
      {label && <p className="mb-1 text-sm font-medium">{label}</p>}
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );
}