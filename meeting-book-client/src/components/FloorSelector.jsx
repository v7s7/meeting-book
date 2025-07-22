import React from "react";

function FloorSelector({ selectedFloor, onChange }) {
  return (
    <div style={{ textAlign: "center", margin: "20px" }}>
      <span
        style={{
          marginRight: "10px",
          fontWeight: "bold",
          color: "#333",
        }}
      >
        Current floor is :  {selectedFloor}
      </span>
      <select
        value={selectedFloor}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          padding: "6px 10px",
          borderRadius: "5px",
          border: "1px solid #ccc",
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        <option value={10}>10th Floor</option>
        <option value={7}>7th Floor</option>
      </select>
    </div>
  );
}

export default FloorSelector;
