import pandas as pd
import re

# Leer el archivo generado
df = pd.read_excel("ventas.xlsx")

# Renombrar columna MODELO -> CODIGO
df = df.rename(columns={"MODELO": "CODIGO"})

# --- NUEVA COLUMNA basada en CODIGO ---
def obtener_tamano(codigo):
    if pd.isna(codigo):
        return ""
    
    # Buscar números dentro del texto (ej: 43, 55, 65, etc.)
    match = re.search(r"\d{2,3}", str(codigo))
    if match:
        return f"TV de {match.group()}"
    return ""

df["MODELO"] = df["CODIGO"].apply(obtener_tamano)

# Filtrar filas donde CONTRATO no esté vacío
df_limpio = df[df["CONTRATO"].notna()]
df_limpio = df_limpio[df_limpio["CONTRATO"].astype(str).str.strip() != ""]

# Guardar el resultado
df_limpio.to_excel("ventas_limpio.xlsx", index=False)

print("Archivo limpio generado: ventas_limpio.xlsx")