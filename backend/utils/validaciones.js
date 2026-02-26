export const validarCedula = (cedula) => {
  if (!/^\d{10}$/.test(cedula)) return false;

  const digitos = cedula.split("").map(Number);
  const provincia = parseInt(cedula.substring(0, 2), 10);

  if (provincia < 1 || provincia > 24) return false;

  const coef = [2,1,2,1,2,1,2,1,2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let val = digitos[i] * coef[i];
    if (val > 9) val -= 9;
    suma += val;
  }

  const verificador = (10 - (suma % 10)) % 10;

  return verificador === digitos[9];
};

export const validarTelefono = (telefono) => {
  return /^09\d{8}$/.test(telefono);
};
