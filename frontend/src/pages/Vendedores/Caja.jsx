import React from "react";
import MovimientoCaja from "./MovimientoCaja";
import CierreCaja from "./CierreCaja";

export default function Caja() {
  return (
    <div className="flex justify-center items-center">
      <CierreCaja />
      <MovimientoCaja />
    </div>
  );
}
