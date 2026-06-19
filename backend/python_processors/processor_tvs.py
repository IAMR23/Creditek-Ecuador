import json
import os

from processor_common import (
    append_pdf_read_error,
    base_record,
    extract_tables_from_pdf,
    list_pdf_files,
    normalize_code,
    row_to_dict,
)


EQUIVALENCIAS_FILE = os.path.join(
    os.path.dirname(__file__),
    "modelos_equivalencias.json",
)


def load_equivalencias(path=EQUIVALENCIAS_FILE):
    if not os.path.exists(path):
        return {}

    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)

    return {normalize_code(key): value for key, value in data.items()}


def process_tvs(input_path):
    registros_validos = []
    errores = []
    total_registros = 0
    pdf_files = list_pdf_files(input_path)
    equivalencias = load_equivalencias()

    for pdf_file in pdf_files:
        try:
            dataframes = extract_tables_from_pdf(pdf_file)
        except Exception as exc:
            append_pdf_read_error(errores, pdf_file, "PDF_NO_LEIDO", str(exc))
            continue

        for df in dataframes:
            for index, raw_row in df.iterrows():
                total_registros += 1
                row = row_to_dict(raw_row)
                fila = int(index) + 1
                record = base_record(row, "TV", "PDF_CREDITV")

                if not record["factura"]:
                    errores.append(
                        {
                            "archivo_origen": record["archivo_origen"],
                            "fila": fila,
                            "motivo": "CONTRATO_VACIO",
                            "codigo_pdf": record["codigo_pdf"],
                        }
                    )

                if not record["codigo_pdf"]:
                    errores.append(
                        {
                            "archivo_origen": record["archivo_origen"],
                            "fila": fila,
                            "motivo": "CODIGO_VACIO",
                        }
                    )
                    continue

                codigo_normalizado = normalize_code(record["codigo_pdf"])
                modelo_normalizado = equivalencias.get(codigo_normalizado)

                if not modelo_normalizado:
                    modelo_normalizado = "NO_MAPEADO"
                    errores.append(
                        {
                            "archivo_origen": record["archivo_origen"],
                            "fila": fila,
                            "motivo": "MODELO_NO_MAPEADO",
                            "codigo_pdf": record["codigo_pdf"],
                        }
                    )

                record["codigo_pdf"] = record["codigo_pdf"]
                record["modelo_normalizado"] = modelo_normalizado
                record["imei"] = None
                registros_validos.append(record)

    return {
        "ok": True,
        "tipo": "TV",
        "pdfs_procesados": len(pdf_files),
        "total_registros": total_registros,
        "registros_validos": registros_validos,
        "errores": errores,
    }
