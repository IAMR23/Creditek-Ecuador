export const USUARIOS_UPHONE_POR_AGENCIA = [
  {
    agencia: "SANGOLQUI",
    usuarios: [
      "ARI2028",
      "MARCEL",
      "ERICK2027",
      "JON2028",
      "KELL2028",
      "ERI2028",
      "PABLO2028",
      "FER2028",
    ],
  },
  {
    agencia: "CAUPICHO",
    usuarios: [
      "VENTAS2",
      "DEREK2026",
      "NAOR2",
      "ARI2026",
      "KELL2026",
      "JIMEG2",
      "KEVINC2",
      "STEEV2026",
      "JON2026",
      "ERI2026",
      "PABLO2026",
      "FER2026",
      "NAOMI2026",
    ],
  },
  {
    agencia: "CHILLOGALLO",
    usuarios: [
      "ARI2027",
      "STEEV2027",
      "ERICK2028",
      "NAOMI2028",
      "JON2027",
      "KELL2027",
      "ERI2027",
      "FER2027",
      "LIBIA",
      "PABLO2027",
    ],
  },
  {
    agencia: "NUEVA AURORA",
    usuarios: [
      "ERICK2025",
      "JON2025",
      "FER2025",
      "NAOR",
      "VENTAS1",
      "KELL2025",
      "VENTAS3",
      "PABLO2025",
      "DEREK2025",
      "ARI2025",
      "STEEV2025",
      "ERI2025",
      "JIMEG1",
      "KEVINC1",
      "ANDRES1",
      "ANGEL1",
    ],
  },
];

const AGENCIA_POR_USUARIO = new Map(
  USUARIOS_UPHONE_POR_AGENCIA.flatMap(({ agencia, usuarios }) =>
    usuarios.map((usuario) => [usuario.toLowerCase(), agencia]),
  ),
);

const USUARIO_CANONICO = new Map(
  USUARIOS_UPHONE_POR_AGENCIA.flatMap(({ usuarios }) =>
    usuarios.map((usuario) => [usuario.toLowerCase(), usuario]),
  ),
);

export const obtenerAgenciaUsuarioUphone = (usuario) =>
  AGENCIA_POR_USUARIO.get(String(usuario || "").trim().toLowerCase()) || null;

export const obtenerUsuarioUphoneCanonico = (usuario) => {
  const valor = String(usuario || "").trim();
  return USUARIO_CANONICO.get(valor.toLowerCase()) || valor;
};
