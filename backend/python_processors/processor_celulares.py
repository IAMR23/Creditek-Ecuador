from processor_common import (
    COMMON_ALIASES,
    append_pdf_read_error,
    base_record,
    extract_tables_from_pdf,
    get_first,
    list_pdf_files,
    normalize_code,
    row_to_dict,
)


def process_celulares(input_path):
    registros_validos = []
    errores = []
    total_registros = 0
    pdf_files = list_pdf_files(input_path)

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
                record = base_record(row, "CELULAR", "PDF_UPHONE")
                imei = get_first(row, COMMON_ALIASES["imei"])

                if not imei:
                    errores.append(
                        {
                            "archivo_origen": record["archivo_origen"],
                            "fila": fila,
                            "motivo": "IMEI_OBLIGATORIO",
                            "codigo_pdf": record["codigo_pdf"],
                        }
                    )
                    continue

                if not record["codigo_pdf"]:
                    errores.append(
                        {
                            "archivo_origen": record["archivo_origen"],
                            "fila": fila,
                            "motivo": "CODIGO_VACIO",
                            "imei": imei,
                        }
                    )

                record["imei"] = imei
                record["modelo_normalizado"] = (
                    normalize_code(record["codigo_pdf"])
                    if record["codigo_pdf"]
                    else "NO_MAPEADO"
                )
                registros_validos.append(record)

    return {
        "ok": True,
        "tipo": "CELULAR",
        "pdfs_procesados": len(pdf_files),
        "total_registros": total_registros,
        "registros_validos": registros_validos,
        "errores": errores,
    }
