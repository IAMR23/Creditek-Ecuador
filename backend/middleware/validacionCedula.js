function validarCedulaEC(cedula) {
  // 1️⃣ No vacía
  if (!cedula) return false;

  // 2️⃣ Solo números y longitud exacta
  if (!/^\d{10}$/.test(cedula)) return false;

  // 3️⃣ Provincia válida (01–24)
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;

  // 4️⃣ Tercer dígito < 6
  const tercerDigito = parseInt(cedula[2], 10);
  if (tercerDigito >= 6) return false;

  // 5️⃣ Algoritmo Módulo 10
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let digito = parseInt(cedula[i], 10);

    if (i % 2 === 0) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }

    suma += digito;
  }

  const digitoVerificador = (10 - (suma % 10)) % 10;

  return digitoVerificador === parseInt(cedula[9], 10);
}

module.exports = { validarCedulaEC };
