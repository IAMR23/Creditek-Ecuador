import React from "react";

const Field = ({ label, value }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
      {label}
    </label>
    <input
      type="text"
      readOnly
      value={value || ""}
      className="
        w-full px-4 py-2 rounded-lg
        bg-gray-50 text-gray-800
        border border-gray-200
        shadow-inner
        cursor-default
      "
    />
  </div>
);

export default Field;
