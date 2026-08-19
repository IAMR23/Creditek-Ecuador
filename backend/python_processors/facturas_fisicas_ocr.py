#!/usr/bin/env python3
"""OCR local y extraccion conservadora para facturas fisicas.

El unico contenido enviado a stdout es el JSON final. Los documentos de
entrada se abren solo para lectura y toda imagen preparada vive en un
directorio temporal.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


OCR_VERSION = "2.0.0"
MAX_PDF_PAGES = 25
FIELD_NAMES = (
    "proveedor",
    "rucProveedor",
    "numeroFactura",
    "fechaEmision",
    "subtotal",
    "impuestos",
    "total",
)
MONTHS = {
    "ENE": 1,
    "ENERO": 1,
    "FEB": 2,
    "FEBRERO": 2,
    "MAR": 3,
    "MARZO": 3,
    "ABR": 4,
    "ABRIL": 4,
    "MAY": 5,
    "MAYO": 5,
    "JUN": 6,
    "JUNIO": 6,
    "JUL": 7,
    "JULIO": 7,
    "AGO": 8,
    "AGOSTO": 8,
    "SEP": 9,
    "SEPT": 9,
    "SEPTIEMBRE": 9,
    "OCT": 10,
    "OCTUBRE": 10,
    "NOV": 11,
    "NOVIEMBRE": 11,
    "DIC": 12,
    "DICIEMBRE": 12,
}

PRODUCT_DESCRIPTION_HEADERS = ("DESCRIPCION", "PRODUCTO", "DETALLE", "ARTICULO")
PRODUCT_QUANTITY_HEADERS = ("CANT", "CANTIDAD", "UND", "UNIDAD", "UNIDADES")
PRODUCT_UNIT_PRICE_HEADERS = (
    "P UNITARIO",
    "PRECIO UNITARIO",
    "V UNITARIO",
    "VALOR UNITARIO",
    "PRECIO",
)
PRODUCT_TOTAL_HEADERS = ("TOTAL LINEA", "VALOR TOTAL", "TOTAL")
PRODUCT_DISCOUNT_HEADERS = ("DESC", "DESCUENTO")
PRODUCT_CODE_HEADERS = ("COD", "CODIGO", "SKU", "REFERENCIA")
NON_PRODUCT_PREFIXES = (
    "SUBTOTAL",
    "IVA",
    "I.V.A",
    "TOTAL",
    "DESCUENTO GENERAL",
    "FORMA DE PAGO",
    "AUTORIZACION",
    "RUC",
    "R.U.C",
    "DIRECCION",
    "CLIENTE",
    "COMPRADOR",
    "VENDEDOR",
    "FECHA",
    "TELEFONO",
    "CORREO",
    "OBSERVACION",
    "GRACIAS",
)
NUMERIC_PRODUCT_TOKEN = re.compile(
    r"^(?:\$)?\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?%?$"
)


def _ascii_upper(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn").upper()


def limpiar_texto(value: str) -> str:
    lines = []
    for raw_line in str(value or "").replace("\x00", "").splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _unique(values: list[Any]) -> list[Any]:
    result = []
    for value in values:
        if value not in result:
            result.append(value)
    return result


def _nearby_context(lines: list[str], index: int) -> str:
    return " ".join(lines[max(0, index - 1) : min(len(lines), index + 2)])


def _digits_from_ocr(value: str) -> str:
    translation = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "|": "1"})
    return re.sub(r"\D", "", value.translate(translation))


def detectar_ruc(lines: list[str]) -> tuple[str | None, list[str]]:
    candidates: list[tuple[int, int, str]] = []
    pattern = re.compile(r"(?<![0-9A-Z])(?:[0-9OIl|][\s.\-]*){13}(?![0-9A-Z])", re.IGNORECASE)
    context_labels = ("RUC", "R.U.C", "IDENTIFICACION", "CONTRIBUYENTE")

    for index, line in enumerate(lines):
        context = _ascii_upper(_nearby_context(lines, index))
        for match in pattern.finditer(line):
            digits = _digits_from_ocr(match.group(0))
            if len(digits) != 13:
                continue
            score = 0
            if any(label in context for label in context_labels):
                score += 10
            if "CLIENTE" in context or "COMPRADOR" in context:
                score -= 5
            candidates.append((score, index, digits))

    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    all_candidates = _unique([item[2] for item in ordered])
    selected = ordered[0][2] if ordered and ordered[0][0] >= 10 else None
    return selected, all_candidates


def detectar_numero_factura(lines: list[str]) -> tuple[str | None, list[str]]:
    candidates: list[tuple[int, int, str]] = []
    pattern = re.compile(
        r"(?<![0-9A-Z])([0-9OI]{3})\s*[- ]\s*([0-9OI]{3})\s*[- ]\s*([0-9OI]{9})(?![0-9A-Z])",
        re.IGNORECASE,
    )
    for index, line in enumerate(lines):
        context = _ascii_upper(_nearby_context(lines, index))
        for match in pattern.finditer(line):
            sections = [_digits_from_ocr(value) for value in match.groups()]
            if [len(value) for value in sections] != [3, 3, 9]:
                continue
            number = "-".join(sections)
            score = 5
            if any(label in context for label in ("FACTURA", "COMPROBANTE", "NRO", "NUMERO", "NO.")):
                score += 5
            if "AUTORIZACION" in context:
                score -= 4
            candidates.append((score, index, number))

    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    all_candidates = _unique([item[2] for item in ordered])
    return (ordered[0][2] if ordered else None), all_candidates


def _valid_iso_date(year: int, month: int, day: int) -> str | None:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _dates_in_line(line: str) -> list[str]:
    values: list[str] = []
    for match in re.finditer(r"\b(20\d{2})[\-/](\d{1,2})[\-/](\d{1,2})\b", line):
        parsed = _valid_iso_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        if parsed:
            values.append(parsed)
    for match in re.finditer(r"\b(\d{1,2})[\-/](\d{1,2})[\-/](20\d{2})\b", line):
        parsed = _valid_iso_date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
        if parsed:
            values.append(parsed)
    month_pattern = "|".join(sorted(MONTHS, key=len, reverse=True))
    for match in re.finditer(rf"\b(\d{{1,2}})\s+({month_pattern})\.?\s+(20\d{{2}})\b", _ascii_upper(line)):
        parsed = _valid_iso_date(int(match.group(3)), MONTHS[match.group(2)], int(match.group(1)))
        if parsed:
            values.append(parsed)
    return _unique(values)


def detectar_fecha(lines: list[str]) -> tuple[str | None, list[str]]:
    candidates: list[tuple[int, int, str]] = []
    excluded = ("AUTORIZACION", "VENCIMIENTO", "IMPRESION", "CADUCIDAD")
    preferred = ("FECHA DE EMISION", "FECHA EMISION", "EMISION", "FECHA FACTURA")
    for index, line in enumerate(lines):
        context = _ascii_upper(_nearby_context(lines, index))
        for parsed in _dates_in_line(line):
            score = 1
            if any(label in context for label in preferred):
                score += 10
            if any(label in context for label in excluded):
                score -= 10
            candidates.append((score, index, parsed))
    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    values = _unique([item[2] for item in ordered])
    selected = ordered[0][2] if ordered and ordered[0][0] > 0 else None
    return selected, values


def normalizar_monto(value: str) -> float | None:
    cleaned = re.sub(r"[^0-9,.-]", "", str(value or "")).strip(".-,")
    if not cleaned or "-" in cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        decimal_separator = "," if cleaned.rfind(",") > cleaned.rfind(".") else "."
        thousands_separator = "." if decimal_separator == "," else ","
        cleaned = cleaned.replace(thousands_separator, "").replace(decimal_separator, ".")
    elif "," in cleaned or "." in cleaned:
        separator = "," if "," in cleaned else "."
        last = cleaned.rsplit(separator, 1)[-1]
        if len(last) in (1, 2):
            cleaned = cleaned.replace(separator, "", cleaned.count(separator) - 1).replace(separator, ".")
        else:
            cleaned = cleaned.replace(separator, "")
    try:
        parsed = Decimal(cleaned)
    except InvalidOperation:
        return None
    if parsed < 0 or parsed > Decimal("9999999999.99"):
        return None
    return float(parsed.quantize(Decimal("0.01")))


def _amounts_in_line(line: str) -> list[float]:
    raw_values = re.findall(r"(?:\$\s*)?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|(?:\$\s*)?\d+[.,]\d{1,2}", line)
    return [value for raw in raw_values if (value := normalizar_monto(raw)) is not None]


def detectar_montos(lines: list[str]) -> dict[str, float | None]:
    matches: dict[str, list[tuple[int, int, float]]] = {
        "subtotal": [],
        "impuestos": [],
        "total": [],
    }
    for index, line in enumerate(lines):
        upper = _ascii_upper(line)
        amounts = _amounts_in_line(line)
        if not amounts:
            continue
        value = amounts[-1]
        if "SUBTOTAL" in upper:
            matches["subtotal"].append((10, index, value))
        if any(label in upper for label in ("IVA", "IMPUESTO", "I.V.A")) and "SUBTOTAL" not in upper:
            matches["impuestos"].append((10, index, value))
        if "TOTAL" in upper and "SUBTOTAL" not in upper:
            score = 12 if any(label in upper for label in ("TOTAL A PAGAR", "VALOR TOTAL", "TOTAL FACTURA")) else 8
            matches["total"].append((score, index, value))

    result: dict[str, float | None] = {}
    for field, values in matches.items():
        ordered = sorted(values, key=lambda item: (-item[0], -item[1]))
        result[field] = ordered[0][2] if ordered else None
    return result


def detectar_proveedor(lines: list[str]) -> str | None:
    label_pattern = re.compile(
        r"^(?:RAZ[OÓ]N\s+SOCIAL|PROVEEDOR|EMISOR|NOMBRE\s+COMERCIAL)\s*[:\-]\s*(.+)$",
        re.IGNORECASE,
    )
    for line in lines:
        match = label_pattern.match(line)
        if not match:
            continue
        candidate = re.sub(r"\s+", " ", match.group(1)).strip(" :-")
        if 3 <= len(candidate) <= 255 and not re.fullmatch(r"[\d\W]+", candidate):
            return candidate
    return None


def _header_categories(line: str) -> set[str]:
    upper = re.sub(r"[^A-Z0-9]+", " ", _ascii_upper(line)).strip()
    categories: set[str] = set()
    groups = (
        ("descripcion", PRODUCT_DESCRIPTION_HEADERS),
        ("cantidad", PRODUCT_QUANTITY_HEADERS),
        ("precioUnitario", PRODUCT_UNIT_PRICE_HEADERS),
        ("totalLinea", PRODUCT_TOTAL_HEADERS),
        ("descuento", PRODUCT_DISCOUNT_HEADERS),
        ("codigo", PRODUCT_CODE_HEADERS),
    )
    for category, headers in groups:
        if any(re.search(rf"\b{re.escape(header)}\b", upper) for header in headers):
            categories.add(category)
    return categories


def _is_product_header(line: str) -> bool:
    categories = _header_categories(line)
    upper = re.sub(r"[^A-Z0-9]+", " ", _ascii_upper(line)).strip()
    exact_headers = {
        *PRODUCT_DESCRIPTION_HEADERS,
        *PRODUCT_QUANTITY_HEADERS,
        *PRODUCT_UNIT_PRICE_HEADERS,
        *PRODUCT_TOTAL_HEADERS,
        *PRODUCT_DISCOUNT_HEADERS,
        *PRODUCT_CODE_HEADERS,
    }
    return len(categories) >= 2 or upper in exact_headers


def _is_non_product_line(line: str) -> bool:
    upper = _ascii_upper(line).strip(" :-")
    return any(
        upper == prefix or upper.startswith(f"{prefix} ") or upper.startswith(f"{prefix}:")
        for prefix in NON_PRODUCT_PREFIXES
    )


def _parse_quantity(value: str) -> float | int | None:
    parsed = normalizar_monto(value.rstrip("%"))
    if parsed is None or parsed <= 0 or parsed > 1_000_000:
        return None
    return int(parsed) if parsed.is_integer() else parsed


def _product_warning(product: dict[str, Any]) -> list[str]:
    quantity = product.get("cantidad")
    unit_price = product.get("precioUnitario")
    line_total = product.get("totalLinea")
    discount = product.get("descuento") or 0
    if quantity is None or unit_price is None or line_total is None:
        return []
    expected = (Decimal(str(quantity)) * Decimal(str(unit_price))) - Decimal(str(discount))
    if abs(expected - Decimal(str(line_total))) > Decimal("0.02"):
        return ["La cantidad por precio unitario no coincide con el total de linea."]
    return []


def _extract_explicit_code(description: str, allow_leading_code: bool) -> tuple[str | None, str]:
    explicit = re.match(
        r"^(?:COD(?:IGO)?|SKU|REF(?:ERENCIA)?)\s*[:#-]?\s*(\S+)\s+(.+)$",
        description,
        re.IGNORECASE,
    )
    if explicit:
        return explicit.group(1)[:80], explicit.group(2).strip()
    if allow_leading_code:
        parts = description.split(maxsplit=1)
        if len(parts) == 2 and re.fullmatch(
            r"[A-Z0-9][A-Z0-9._/-]{2,39}", parts[0], re.IGNORECASE
        ):
            return parts[0][:80], parts[1].strip()
    return None, description


def _build_product(
    description: str,
    trailing: list[str],
    has_code_header: bool,
) -> dict[str, Any] | None:
    code, description = _extract_explicit_code(description, has_code_header)
    quantity = _parse_quantity(trailing[0])
    unit_price = normalizar_monto(trailing[1])
    discount = None
    warnings: list[str] = []
    if len(trailing) == 4:
        if trailing[2].endswith("%"):
            warnings.append("Se detecto un descuento porcentual que requiere revision manual.")
        else:
            discount = normalizar_monto(trailing[2])
    line_total = normalizar_monto(trailing[-1])
    if quantity is None or unit_price is None or line_total is None:
        return None
    product = {
        "descripcion": description[:500],
        "cantidad": quantity,
        "precioUnitario": unit_price,
        "descuento": discount,
        "totalLinea": line_total,
        "codigo": code,
        "advertencias": warnings,
    }
    product["advertencias"].extend(_product_warning(product))
    return product


def _parse_product_row(
    line: str,
    *,
    table_context: bool,
    has_code_header: bool,
) -> dict[str, Any] | None:
    normalized = re.sub(r"\$\s+(?=\d)", "$", re.sub(r"\s+", " ", line)).strip(" |;")
    if not normalized or _is_product_header(normalized) or _is_non_product_line(normalized):
        return None

    parts = normalized.split(" ")
    trailing: list[str] = []
    while parts and len(trailing) < 4:
        candidate = parts[-1].strip("|;()")
        if not NUMERIC_PRODUCT_TOKEN.fullmatch(candidate):
            break
        trailing.insert(0, candidate)
        parts.pop()

    if len(trailing) < 3:
        if not table_context:
            return None
        description = normalized.strip(" :-|")
        if len(description) < 3 or not re.search(r"[A-Za-z]", description):
            return None
        code, description = _extract_explicit_code(description, has_code_header)
        return {
            "descripcion": description[:500],
            "cantidad": None,
            "precioUnitario": None,
            "descuento": None,
            "totalLinea": None,
            "codigo": code,
            "advertencias": ["Linea de producto incompleta; revise cantidad y valores."],
        }

    description = " ".join(parts).strip(" :-|")
    if len(description) < 2 or not re.search(r"[A-Za-z]", description):
        return None
    product = _build_product(description, trailing, has_code_header)
    if not product:
        return None
    if not table_context and product["advertencias"]:
        return None
    return product


def extraer_productos(
    texto: str,
    campos_factura: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    lines = [line for line in limpiar_texto(texto).splitlines() if line]
    products: list[dict[str, Any]] = []
    table_context = False
    has_code_header = False
    index = 0
    while index < len(lines):
        line = lines[index]
        header_categories = _header_categories(line)
        if _is_product_header(line):
            table_context = True
            has_code_header = has_code_header or "codigo" in header_categories
            index += 1
            continue
        if _is_non_product_line(line):
            if _ascii_upper(line).strip().startswith(("SUBTOTAL", "IVA", "TOTAL")):
                table_context = False
            index += 1
            continue

        product = _parse_product_row(
            line,
            table_context=table_context,
            has_code_header=has_code_header,
        )
        if product and product["cantidad"] is None and index + 1 < len(lines):
            if _is_product_header(lines[index + 1]):
                product = None
            else:
                numeric_line = re.sub(r"\$\s+(?=\d)", "$", lines[index + 1]).split()
                numeric_line = [value.strip("|;()") for value in numeric_line]
                combined = None
                if len(numeric_line) in (3, 4) and all(
                    NUMERIC_PRODUCT_TOKEN.fullmatch(value) for value in numeric_line
                ):
                    combined = _build_product(
                        product["descripcion"],
                        numeric_line,
                        has_code_header=False,
                    )
                    if combined and product.get("codigo"):
                        combined["codigo"] = product["codigo"]
                if combined:
                    product = combined
                    index += 1
        if product:
            product["orden"] = len(products) + 1
            products.append(product)
        index += 1

    warnings: list[str] = []
    known_totals = [
        Decimal(str(item["totalLinea"]))
        for item in products
        if item["totalLinea"] is not None
    ]
    complete_total = bool(products) and len(known_totals) == len(products)
    sum_lines = sum(known_totals, Decimal("0")) if known_totals else None
    fields = campos_factura or {}
    subtotal = fields.get("subtotal")
    total = fields.get("total")
    difference_subtotal = None
    difference_total = None
    if complete_total and subtotal is not None:
        difference_subtotal = abs(sum_lines - Decimal(str(subtotal)))
        if difference_subtotal > Decimal("0.02"):
            warnings.append("La suma de productos no coincide con el subtotal de la factura.")
    elif complete_total and total is not None:
        difference_total = abs(sum_lines - Decimal(str(total)))
        if difference_total > Decimal("0.02"):
            warnings.append("La suma de productos no coincide con el total de la factura.")
    if not products:
        warnings.append("No se detectaron lineas de producto con confianza suficiente.")

    metadata = {
        "cantidadProductos": len(products),
        "sumaTotalesLinea": (
            float(sum_lines.quantize(Decimal("0.01"))) if sum_lines is not None else None
        ),
        "diferenciaSubtotal": (
            float(difference_subtotal.quantize(Decimal("0.01")))
            if difference_subtotal is not None
            else None
        ),
        "diferenciaTotal": (
            float(difference_total.quantize(Decimal("0.01")))
            if difference_total is not None
            else None
        ),
    }
    return products, warnings, metadata


def extraer_campos(texto: str) -> tuple[dict[str, Any], list[str], dict[str, Any]]:
    lines = [line for line in limpiar_texto(texto).splitlines() if line]
    ruc, ruc_candidates = detectar_ruc(lines)
    invoice, invoice_candidates = detectar_numero_factura(lines)
    emission_date, date_candidates = detectar_fecha(lines)
    amounts = detectar_montos(lines)
    fields = {
        "proveedor": detectar_proveedor(lines),
        "rucProveedor": ruc,
        "numeroFactura": invoice,
        "fechaEmision": emission_date,
        **amounts,
    }
    warnings: list[str] = []
    if not ruc:
        warnings.append("No se detecto un RUC de proveedor con contexto suficiente.")
    if len(ruc_candidates) > 1:
        warnings.append("Se detectaron multiples candidatos de RUC; revise la sugerencia seleccionada.")
    if not invoice:
        warnings.append("No se detecto el numero de factura.")
    if len(invoice_candidates) > 1:
        warnings.append("Se detectaron multiples candidatos de numero de factura.")
    if not amounts["total"]:
        warnings.append("No se detecto el total de la factura.")
    if all(amounts[field] is not None for field in ("subtotal", "impuestos", "total")):
        difference = abs(amounts["subtotal"] + amounts["impuestos"] - amounts["total"])
        if difference > 0.02:
            warnings.append("Los valores detectados no coinciden con el total de la factura.")
    metadata = {
        "candidatosRuc": ruc_candidates,
        "candidatosNumeroFactura": invoice_candidates,
        "candidatosFecha": date_candidates,
    }
    return fields, warnings, metadata


def _usable_pdf_text(text: str) -> bool:
    cleaned = limpiar_texto(text)
    alphanumeric = sum(char.isalnum() for char in cleaned)
    return alphanumeric >= 40 and alphanumeric / max(len(cleaned), 1) >= 0.35


def _prepare_image(image: Any, output_path: Path) -> tuple[Any, list[str]]:
    from PIL import Image as PILImage
    from PIL import ImageOps, ImageStat

    image = ImageOps.exif_transpose(image).convert("RGB")
    warnings: list[str] = []
    smallest = min(image.size)
    largest = max(image.size)
    if smallest < 1200:
        factor = min(2.0, 1200 / max(smallest, 1))
        image = image.resize(
            (round(image.width * factor), round(image.height * factor)),
            resample=PILImage.Resampling.LANCZOS,
        )
    elif largest > 5000:
        factor = 5000 / largest
        image = image.resize(
            (round(image.width * factor), round(image.height * factor)),
            resample=PILImage.Resampling.LANCZOS,
        )
    gray = ImageOps.grayscale(image)
    contrast = float(ImageStat.Stat(gray).stddev[0])
    if contrast < 18:
        warnings.append("La calidad del documento parece insuficiente por bajo contraste.")
    prepared = ImageOps.autocontrast(gray, cutoff=1)
    prepared.save(output_path, format="PNG")
    return prepared, warnings


def _configure_tesseract(pytesseract: Any) -> tuple[str, str, bool]:
    configured_command = str(os.environ.get("TESSERACT_CMD") or "").strip()
    executable_candidates = [configured_command, shutil.which("tesseract")]
    if os.name == "nt":
        executable_candidates.extend(
            [
                str(Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Tesseract-OCR" / "tesseract.exe"),
                str(Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Tesseract-OCR" / "tesseract.exe"),
            ]
        )
    executable = next(
        (
            str(Path(candidate))
            for candidate in executable_candidates
            if candidate and Path(candidate).is_file()
        ),
        None,
    )
    if executable:
        pytesseract.pytesseract.tesseract_cmd = executable

    tessdata_candidates = [str(os.environ.get("TESSDATA_PREFIX") or "").strip()]
    local_app_data = str(os.environ.get("LOCALAPPDATA") or "").strip()
    if local_app_data:
        tessdata_candidates.append(
            str(Path(local_app_data) / "Tesseract-OCR" / "tessdata")
        )
    tessdata_dir = next(
        (
            str(Path(candidate))
            for candidate in tessdata_candidates
            if candidate and Path(candidate).is_dir()
        ),
        "",
    )
    if tessdata_dir:
        os.environ["TESSDATA_PREFIX"] = tessdata_dir
    tessdata_config = ""
    languages = set(pytesseract.get_languages(config=tessdata_config))
    if {"spa", "eng"}.issubset(languages):
        return "spa+eng", tessdata_config, True
    if "spa" in languages:
        return "spa", tessdata_config, True
    if "eng" in languages:
        return "eng", tessdata_config, False
    raise RuntimeError("Tesseract no tiene instalados los idiomas spa o eng.")


def _ocr_image(image: Any, output_path: Path) -> tuple[str, float | None, list[str], str]:
    import pytesseract
    from pytesseract import Output

    prepared, warnings = _prepare_image(image, output_path)
    language, tessdata_config, spanish_available = _configure_tesseract(pytesseract)
    if not spanish_available:
        warnings.append(
            "El idioma espanol no esta instalado en Tesseract; se proceso solamente con ingles."
        )
    ocr_config = " ".join(
        value for value in (tessdata_config, "--oem 1 --psm 3") if value
    )
    data = pytesseract.image_to_data(
        prepared,
        lang=language,
        config=ocr_config,
        output_type=Output.DICT,
    )
    words: list[str] = []
    confidences: list[float] = []
    current_line: list[str] = []
    lines: list[str] = []
    previous_key = None
    for index, word in enumerate(data.get("text", [])):
        word = str(word or "").strip()
        key = (
            data.get("page_num", [0])[index],
            data.get("block_num", [0])[index],
            data.get("par_num", [0])[index],
            data.get("line_num", [0])[index],
        )
        if previous_key is not None and key != previous_key and current_line:
            lines.append(" ".join(current_line))
            current_line = []
        previous_key = key
        if not word:
            continue
        words.append(word)
        current_line.append(word)
        try:
            confidence = float(data.get("conf", ["-1"])[index])
            if confidence >= 0:
                confidences.append(confidence)
        except (TypeError, ValueError):
            pass
    if current_line:
        lines.append(" ".join(current_line))
    text = limpiar_texto("\n".join(lines) if lines else " ".join(words))
    average = round(sum(confidences) / len(confidences), 2) if confidences else None
    if average is not None and average < 45:
        warnings.append("La confianza promedio del OCR es baja; revise los valores sugeridos.")
    return text, average, warnings, str(pytesseract.get_tesseract_version()).splitlines()[0]


def procesar_documento(path: Path, mime: str, extension: str) -> dict[str, Any]:
    from PIL import Image

    texts: list[str] = []
    warnings: list[str] = []
    confidences: list[float] = []
    modes: list[str] = []
    engine_version = None
    pages = 1

    with tempfile.TemporaryDirectory(prefix="factura_ocr_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        if mime == "application/pdf" or extension.lower().lstrip(".") == "pdf":
            import pdfplumber
            import pypdfium2 as pdfium

            with pdfplumber.open(path) as pdf:
                pages = len(pdf.pages)
                if pages > 1:
                    warnings.append(f"El PDF contiene {pages} paginas; revise que la factura sea un solo documento.")
                process_count = min(pages, MAX_PDF_PAGES)
                if pages > MAX_PDF_PAGES:
                    warnings.append(f"El PDF supera el limite operativo; se procesaron las primeras {MAX_PDF_PAGES} paginas.")
                extracted = [limpiar_texto(pdf.pages[index].extract_text() or "") for index in range(process_count)]

            rendered_pdf = None
            try:
                for index, page_text in enumerate(extracted):
                    if _usable_pdf_text(page_text):
                        texts.append(page_text)
                        modes.append("texto_pdf")
                        continue
                    if rendered_pdf is None:
                        rendered_pdf = pdfium.PdfDocument(str(path))
                    page = rendered_pdf[index]
                    image = page.render(scale=2.5).to_pil()
                    page_path = temp_dir / f"pagina_{index + 1}.png"
                    text, confidence, page_warnings, version = _ocr_image(image, page_path)
                    texts.append(text)
                    modes.append("ocr")
                    warnings.extend(page_warnings)
                    if confidence is not None:
                        confidences.append(confidence)
                    engine_version = engine_version or version
                    page.close()
            finally:
                if rendered_pdf is not None:
                    rendered_pdf.close()
        else:
            with Image.open(path) as image:
                image_path = temp_dir / "imagen_preparada.png"
                text, confidence, image_warnings, engine_version = _ocr_image(image, image_path)
            texts.append(text)
            modes.append("ocr")
            warnings.extend(image_warnings)
            if confidence is not None:
                confidences.append(confidence)

    text = limpiar_texto("\n\n".join(value for value in texts if value))
    if sum(char.isalnum() for char in text) < 30:
        warnings.append("El OCR produjo poco texto; la calidad del documento puede ser insuficiente.")
    fields, field_warnings, field_metadata = extraer_campos(text)
    warnings.extend(field_warnings)
    products, product_warnings, product_metadata = extraer_productos(text, fields)
    warnings.extend(product_warnings)
    engine = "pdfplumber" if modes and all(mode == "texto_pdf" for mode in modes) else "tesseract"
    if "texto_pdf" in modes and "ocr" in modes:
        engine = "pdfplumber+tesseract"
    return {
        "ok": True,
        "texto": text,
        "campos": {field: fields.get(field) for field in FIELD_NAMES},
        "productos": products,
        "advertencias": _unique(warnings),
        "metadata": {
            "paginas": pages,
            "motor": engine,
            "versionMotor": engine_version,
            "versionProcesador": OCR_VERSION,
            "modosPorPagina": modes,
            "confianzaPromedio": round(sum(confidences) / len(confidences), 2) if confidences else None,
            "productosResumen": product_metadata,
            **field_metadata,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archivo", required=True)
    parser.add_argument("--mime", required=True)
    parser.add_argument("--extension", required=True)
    parser.add_argument("--factura-id")
    args = parser.parse_args()
    try:
        file_path = Path(args.archivo).resolve(strict=True)
        result = procesar_documento(file_path, args.mime, args.extension)
    except FileNotFoundError:
        result = {"ok": False, "error": "No se pudo localizar el documento.", "codigo": "FILE_NOT_FOUND"}
    except Exception as error:  # El detalle tecnico se registra solamente en stderr.
        print(f"OCR error: {type(error).__name__}: {error}", file=sys.stderr)
        result = {"ok": False, "error": "No se pudo leer o procesar el documento.", "codigo": "OCR_FAILED"}
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
