import glob
import os
import re
import unicodedata


def clean_cell(text):
    if text is None:
        return ""

    text = re.sub(r"[\n\r]+", " ", str(text))
    text = re.sub(r"\s+", " ", text).strip()

    if text.lower() in {"nan", "none", "null"}:
        return ""

    return text


def _unique_columns(columns):
    seen = {}
    normalized = []

    for index, column in enumerate(columns):
        name = clean_cell(column) or f"columna_{index + 1}"
        count = seen.get(name, 0)
        seen[name] = count + 1
        normalized.append(name if count == 0 else f"{name}_{count + 1}")

    return normalized


def clean_dataframe(df):
    import pandas as pd

    df = df.copy()
    df.columns = _unique_columns(df.columns)
    df = df.apply(lambda col: col.map(clean_cell))
    df = df[
        ~df.apply(
            lambda row: row.astype(str)
            .str.contains("TOTALES GENERALES", case=False, na=False)
            .any(),
            axis=1,
        )
    ]
    return df.replace("", pd.NA).dropna(how="all").fillna("")


def extract_tables_from_pdf(pdf_path):
    try:
        import pandas as pd
        import pdfplumber
    except ImportError as exc:
        raise RuntimeError(
            "Faltan dependencias Python. Instala pandas y pdfplumber en el entorno del backend."
        ) from exc

    dataframes = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()

            for table_index, table in enumerate(tables, start=1):
                if not table or len(table) < 2:
                    continue

                df = pd.DataFrame(table[1:], columns=table[0])
                df = clean_dataframe(df)
                if df.empty:
                    continue

                df["archivo_origen"] = os.path.basename(pdf_path)
                df["_pagina_pdf"] = page_number
                df["_tabla_pdf"] = table_index
                dataframes.append(df)

    return dataframes


def list_pdf_files(input_path):
    if os.path.isfile(input_path):
        return [input_path] if input_path.lower().endswith(".pdf") else []

    return sorted(glob.glob(os.path.join(input_path, "*.pdf")))


def normalize_text(value):
    value = clean_cell(value)
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", value).strip().upper()


def normalize_header(value):
    value = normalize_text(value)
    return re.sub(r"[^A-Z0-9]", "", value)


def normalize_code(value):
    value = normalize_text(value)
    return re.sub(r"\s+", " ", value)


def row_to_dict(row):
    return {str(key): clean_cell(value) for key, value in row.items()}


def get_first(row, aliases):
    alias_set = {normalize_header(alias) for alias in aliases}

    for key, value in row.items():
        if normalize_header(key) in alias_set and clean_cell(value):
            return clean_cell(value)

    for key, value in row.items():
        normalized_key = normalize_header(key)
        if any(alias in normalized_key for alias in alias_set) and clean_cell(value):
            return clean_cell(value)

    return ""


def to_int(value, default=1):
    value = clean_cell(value)
    if not value:
        return default

    match = re.search(r"\d+", value)
    if not match:
        return default

    return int(match.group())


def to_decimal(value, default=0):
    value = clean_cell(value)
    if not value:
        return default

    cleaned = re.sub(r"[^0-9,.-]", "", value)
    if not cleaned:
        return default

    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return default


COMMON_ALIASES = {
    "factura": [
        "FACTURA",
        "N FACTURA",
        "NO FACTURA",
        "NUMERO FACTURA",
        "CONTRATO",
        "N CONTRATO",
        "NO CONTRATO",
        "DOCUMENTO",
        "COMPROBANTE",
    ],
    "fecha": ["FECHA", "FECHA EMISION", "FECHA FACTURA", "FEC EMISION"],
    "cliente": [
        "CLIENTE",
        "NOMBRE CLIENTE",
        "RAZON SOCIAL",
        "RAZON SOCIAL CLIENTE",
        "NOMBRES",
    ],
    "codigo_pdf": [
        "MODELO",
        "CODIGO",
        "CODIGO PDF",
        "CODIGO PRODUCTO",
        "PRODUCTO",
        "DESCRIPCION",
        "ARTICULO",
        "REFERENCIA",
        "ITEM",
    ],
    "imei": ["IMEI", "IMEI 1", "SERIE", "SERIAL", "N SERIE", "NO SERIE"],
    "cantidad": ["CANTIDAD", "CANT", "UNIDADES", "QTY"],
    "precio": [
        "PRECIO",
        "PRECIO UNITARIO",
        "PVP",
        "VALOR",
        "TOTAL",
        "SUBTOTAL",
    ],
    "precio_vendedor": [
        "PRECIO VENDEDOR",
        "PRECIO DE VENDEDOR",
        "VALOR VENDEDOR",
    ],
    "valor_ventas": [
        "VENTAS",
        "VENTA",
        "VALOR VENTAS",
        "VALOR DE VENTAS",
        "VALOR VENTA",
        "PRECIO VENTA",
        "TOTAL VENTAS",
        "VALOR TOTAL",
        "TOTAL",
    ],
    "entrada": [
        "ENTRADA",
        "ENGANCHE",
        "CUOTA INICIAL",
        "ABONO",
        "INICIAL",
    ],
}


def base_record(row, tipo_producto, origen):
    factura = get_first(row, COMMON_ALIASES["factura"])
    fecha = get_first(row, COMMON_ALIASES["fecha"])
    cliente = get_first(row, COMMON_ALIASES["cliente"])
    codigo_pdf = get_first(row, COMMON_ALIASES["codigo_pdf"])
    cantidad = to_int(get_first(row, COMMON_ALIASES["cantidad"]), default=1)
    precio_raw = get_first(row, COMMON_ALIASES["precio"])
    precio_vendedor_raw = get_first(row, COMMON_ALIASES["precio_vendedor"])
    valor_ventas_raw = get_first(row, COMMON_ALIASES["valor_ventas"])
    entrada_raw = get_first(row, COMMON_ALIASES["entrada"])
    precio = to_decimal(precio_raw, default=0)
    precio_vendedor = to_decimal(precio_vendedor_raw, default=0)
    valor_ventas = to_decimal(valor_ventas_raw, default=0)
    entrada = to_decimal(entrada_raw, default=0)

    return {
        "tipo_producto": tipo_producto,
        "origen": origen,
        "archivo_origen": row.get("archivo_origen", ""),
        "factura": factura,
        "fecha": fecha,
        "cliente": cliente,
        "codigo_pdf": codigo_pdf,
        "modelo_normalizado": normalize_code(codigo_pdf) if codigo_pdf else "NO_MAPEADO",
        "imei": None,
        "cantidad": cantidad or 1,
        "precio": precio or 0,
        "valor_ventas": valor_ventas or 0,
        "valor_ventas_detectado": bool(valor_ventas_raw),
        "precio_vendedor": valor_ventas or precio_vendedor or precio or 0,
        "precio_vendedor_detectado": bool(
            valor_ventas_raw or precio_vendedor_raw or precio_raw
        ),
        "entrada": entrada or 0,
        "entrada_detectada": bool(entrada_raw),
    }


def append_pdf_read_error(errores, archivo, motivo, detalle):
    errores.append(
        {
            "archivo_origen": os.path.basename(archivo),
            "fila": None,
            "motivo": motivo,
            "detalle": clean_cell(detalle),
        }
    )
