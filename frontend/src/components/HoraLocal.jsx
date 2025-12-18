import { useEffect, useState } from "react";

function HoraLocal() {
  const [hora, setHora] = useState("");

  useEffect(() => {
    const actualizarHora = () => {
      const ahora = new Date();
      setHora(
        ahora.toLocaleTimeString("es-EC", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    actualizarHora();
    const intervalo = setInterval(actualizarHora, 1000);

    return () => clearInterval(intervalo);
  }, []);

  return (
<div
  className="absolute bottom-4 left-36 text-4xl font-extrabold text-white"
  style={{
    textShadow: `
      -1px -1px 0 #000,
       1px -1px 0 #000,
      -1px  1px 0 #000,
       1px  1px 0 #000
    `,
  }}
>
  {hora}
</div>

  );
}

export default HoraLocal;
