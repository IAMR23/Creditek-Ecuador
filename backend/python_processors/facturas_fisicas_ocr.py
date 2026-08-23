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
import time
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from statistics import median
from typing import Any


OCR_VERSION = "4.0.0"
MAX_PDF_PAGES = 25
MAX_METADATA_LINES = 120
MAX_OCR_PASSES = 6
EARLY_STOP_SCORE = 88.0
INVOICE_SCORE_PATTERNS = (
    "RUC",
    "FACTURA",
    "FECHA",
    "CLIENTE",
    "SUBTOTAL",
    "IVA",
    "TOTAL",
    "AUTORIZACION",
    "RUC/CI",
    "FORMA DE PAGO",
)


class OcrEmptyOutputError(RuntimeError):
    """El motor se ejecuto, pero no produjo texto utilizable."""
FIELD_NAMES = (
    "proveedor",
    "rucProveedor",
    "numeroFactura",
    "numeroAutorizacion",
    "claveAcceso",
    "fechaEmision",
    "horaEmision",
    "cliente",
    "identificacionCliente",
    "codigoCliente",
    "placa",
    "condicionPago",
    "formaPago",
    "ambiente",
    "tipoEmision",
    "subtotal",
    "impuestos",
    "total",
    "datosAdicionales",
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
    "SUB TOTAL",
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
    r"^(?:\$)?\d+(?:[.,]\d{1,6})?%?$"
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


def conservar_texto_original(value: str) -> str:
    """Conserva contenido y saltos; solo elimina NUL y normaliza fin de linea."""
    return (
        str(value or "")
        .replace("\x00", "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .strip("\n")
    )


def _lineas_desde_texto(
    value: str,
    *,
    pagina: int,
    modo: str,
) -> list[dict[str, Any]]:
    return [
        {
            "numero": 0,
            "pagina": pagina,
            "texto": line,
            "modo": modo,
            "bloque": None,
            "parrafo": None,
            "lineaOcr": index,
            "left": None,
            "top": None,
            "width": None,
            "height": None,
            "confianza": None,
        }
        for index, line in enumerate(conservar_texto_original(value).splitlines(), 1)
        if line.strip()
    ]


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
    context_labels = ("RUC", "R.U.C", "CONTRIBUYENTE")

    for index, line in enumerate(lines):
        context = _ascii_upper(_nearby_context(lines, index))
        for match in pattern.finditer(line):
            digits = _digits_from_ocr(match.group(0))
            if len(digits) != 13:
                continue
            score = 0
            same_line = _ascii_upper(line)
            if any(label in same_line for label in context_labels):
                score += 10
            if any(label in context for label in ("CLIENTE", "COMPRADOR", "RUC/CI", "RUC / CI")):
                score -= 20
            score += max(0, 5 - index)
            candidates.append((score, index, digits))

    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    all_candidates = _unique([item[2] for item in ordered])
    selected = ordered[0][2] if ordered and ordered[0][0] >= 10 else None
    return selected, all_candidates


def detectar_identificacion_cliente(lines: list[str]) -> tuple[str | None, list[str]]:
    candidates: list[tuple[int, int, str]] = []
    pattern = re.compile(
        r"(?<![0-9A-Z])(?:[0-9OIl|][\s.\-]*){10,13}(?![0-9A-Z])",
        re.IGNORECASE,
    )
    for index, line in enumerate(lines):
        same_line = _ascii_upper(line)
        context = _ascii_upper(" ".join(lines[max(0, index - 2) : index + 1]))
        for match in pattern.finditer(line):
            digits = _digits_from_ocr(match.group(0))
            if len(digits) not in (10, 13):
                continue
            score = 0
            if any(label in same_line for label in ("RUC/CI", "RUC / CI", "CEDULA", "IDENTIFICACION")):
                score += 20
            if any(label in context for label in ("CLIENTE", "COMPRADOR", "ADQUIRENTE")):
                score += 12
            if same_line.startswith(("RUC:", "R.U.C:")) and "RUC/CI" not in same_line:
                score -= 12
            candidates.append((score, index, digits))
    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    values = _unique([item[2] for item in ordered if item[0] > 0])
    return (ordered[0][2] if ordered and ordered[0][0] > 0 else None), values


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
            if "AUTORIZACI" in context:
                score -= 4
            candidates.append((score, index, number))

    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    all_candidates = _unique([item[2] for item in ordered])
    return (ordered[0][2] if ordered else None), all_candidates


def _valor_etiquetado(
    lines: list[str],
    labels: tuple[str, ...],
    *,
    max_length: int = 500,
    allow_next_line: bool = True,
    excluded_labels: tuple[str, ...] = (),
) -> str | None:
    ascii_labels = tuple(_ascii_upper(label) for label in labels)
    for index, line in enumerate(lines):
        upper = _ascii_upper(line)
        if any(excluded in upper for excluded in excluded_labels):
            continue
        for label in ascii_labels:
            match = re.search(rf"(?:^|\b){re.escape(label)}\s*[:\-]?\s*(.*)$", upper)
            if not match:
                continue
            start = match.start(1)
            value = line[start:].strip(" :-")
            if not value and allow_next_line and index + 1 < len(lines):
                value = lines[index + 1].strip(" :-")
            value = re.sub(r"\s+", " ", value).strip()
            if value and not any(_ascii_upper(value).startswith(other) for other in ascii_labels):
                return value[:max_length]
    return None


def detectar_claves_sri(
    lines: list[str],
) -> tuple[str | None, str | None, list[str], list[str]]:
    authorization: list[str] = []
    access_keys: list[str] = []
    warnings: list[str] = []
    long_digits = re.compile(r"(?:[0-9OIl|][\s\-]*){35,60}", re.IGNORECASE)
    for index, line in enumerate(lines):
        upper_line = _ascii_upper(line)
        target = None
        if "CLAVE" in upper_line and "ACCESO" in upper_line:
            target = access_keys
        elif "AUTORIZACI" in upper_line:
            target = authorization
        if target is None:
            continue
        for match in long_digits.finditer(" ".join(lines[index : min(len(lines), index + 3)])):
            digits = _digits_from_ocr(match.group(0))
            if 35 <= len(digits) <= 60:
                target.append(digits)
                if len(digits) != 49:
                    warnings.append(
                        "La clave o autorizacion SRI detectada no tiene 49 digitos; revise el candidato."
                    )
                break
    return (
        _unique(authorization)[0] if authorization else None,
        _unique(access_keys)[0] if access_keys else None,
        _unique(authorization + access_keys),
        _unique(warnings),
    )


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


def detectar_hora_emision(lines: list[str]) -> str | None:
    pattern = re.compile(r"\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b")
    preferred = ("FECHA", "EMISION", "FACTURA")
    excluded = ("AUTORIZACI", "IMPRESION", "VENCIMIENTO")
    candidates: list[tuple[int, int, str]] = []
    for index, line in enumerate(lines):
        context = _ascii_upper(_nearby_context(lines, index))
        for match in pattern.finditer(line):
            score = 1
            if any(label in context for label in preferred):
                score += 10
            if any(label in context for label in excluded):
                score -= 10
            value = f"{match.group(1)}:{match.group(2)}:{match.group(3) or '00'}"
            candidates.append((score, index, value))
    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    return ordered[0][2] if ordered and ordered[0][0] > 0 else None


def normalizar_numero(
    value: str,
    *,
    scale: int,
    decimal_lengths: tuple[int, ...],
    maximum: Decimal = Decimal("9999999999.999999"),
) -> float | None:
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
        if len(last) in decimal_lengths:
            cleaned = cleaned.replace(separator, "", cleaned.count(separator) - 1).replace(separator, ".")
        else:
            cleaned = cleaned.replace(separator, "")
    try:
        parsed = Decimal(cleaned)
    except InvalidOperation:
        return None
    if parsed < 0 or parsed > maximum:
        return None
    quantum = Decimal("1").scaleb(-scale)
    return float(parsed.quantize(quantum))


def normalizar_monto(value: str) -> float | None:
    return normalizar_numero(value, scale=2, decimal_lengths=(1, 2))


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
        if any(label in upper for label in ("SIN SUBSIDIO", "AHORRO", "SUBSIDIO")):
            continue
        if "SUBTOTAL" in upper or "SUB TOTAL" in upper:
            matches["subtotal"].append((10, index, value))
        if any(label in upper for label in ("IVA", "IMPUESTO", "I.V.A")) and not any(
            label in upper for label in ("SUBTOTAL", "SUB TOTAL")
        ):
            matches["impuestos"].append((10, index, value))
        if "TOTAL" in upper and not any(label in upper for label in ("SUBTOTAL", "SUB TOTAL")):
            score = 12 if any(label in upper for label in ("TOTAL A PAGAR", "VALOR TOTAL", "TOTAL FACTURA")) else 8
            matches["total"].append((score, index, value))

    result: dict[str, float | None] = {}
    for field, values in matches.items():
        ordered = sorted(values, key=lambda item: (-item[0], -item[1]))
        result[field] = ordered[0][2] if ordered else None
    return result


def detectar_proveedor(lines: list[str]) -> str | None:
    label_pattern = re.compile(
        r"^(?:RAZ.N\s+SOCIAL|PROVEEDOR|EMISOR|NOMBRE\s+COMERCIAL)\s*[:\-]\s*(.+)$",
        re.IGNORECASE,
    )
    for index, line in enumerate(lines):
        match = label_pattern.match(line)
        if not match:
            continue
        context = _ascii_upper(_nearby_context(lines, index))
        if "CLIENTE" in context or "ADQUIRENTE" in context:
            continue
        candidate = re.sub(r"\s+", " ", match.group(1)).strip(" :-")
        if 3 <= len(candidate) <= 255 and not re.fullmatch(r"[\d\W]+", candidate):
            return candidate
    ruc_pattern = re.compile(r"\bR\.?U\.?C\.?\b", re.IGNORECASE)
    for index, line in enumerate(lines[:15]):
        if not ruc_pattern.search(line):
            continue
        for candidate in reversed(lines[max(0, index - 3) : index]):
            upper = _ascii_upper(candidate)
            if any(label in upper for label in ("FACTURA", "DIRECCION", "TELEFONO", "AUTORIZACI")):
                continue
            if 3 <= len(candidate) <= 255 and re.search(r"[A-Za-z]", candidate):
                return candidate.strip(" :-")
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
    parsed = normalizar_numero(
        value.rstrip("%"),
        scale=3,
        decimal_lengths=(1, 2, 3),
        maximum=Decimal("1000000"),
    )
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
    unit_price = normalizar_numero(
        trailing[1],
        scale=6,
        decimal_lengths=(1, 2, 3, 4, 5, 6),
    )
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
        "precioUnitarioExacto": unit_price,
        "descuento": discount,
        "totalLinea": line_total,
        "codigo": code,
        "datosAdicionales": None,
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

    if len(trailing) == 2 and parts:
        leading = parts[0].strip("|;()")
        if NUMERIC_PRODUCT_TOKEN.fullmatch(leading):
            trailing.insert(0, leading)
            parts.pop(0)

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
            "precioUnitarioExacto": None,
            "descuento": None,
            "totalLinea": None,
            "codigo": code,
            "datosAdicionales": None,
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


def detectar_cliente(lines: list[str]) -> str | None:
    for line in lines:
        direct_match = re.match(
            r"^\s*(?:CLIENTE|COMPRADOR|ADQUIRENTE)\s*[:\-]\s*(.+)$",
            _ascii_upper(line),
        )
        if direct_match:
            direct = line[direct_match.start(1) :].strip(" :-")[:255]
            if re.search(r"[A-Za-z]", direct):
                return direct
    for index, line in enumerate(lines):
        if not any(label in _ascii_upper(line) for label in ("RAZON SOCIAL", "NOMBRE")):
            continue
        context = _ascii_upper(" ".join(lines[max(0, index - 2) : index + 1]))
        if "CLIENTE" not in context and "ADQUIRENTE" not in context:
            continue
        value = _valor_etiquetado([line], ("RAZON SOCIAL", "NOMBRE"), max_length=255)
        if value and re.search(r"[A-Za-z]", value):
            return value
    return None


def detectar_codigo_cliente(lines: list[str]) -> str | None:
    direct = _valor_etiquetado(
        lines,
        ("CODIGO CLIENTE", "COD CLIENTE", "COD. CLIENTE"),
        max_length=80,
    )
    if direct:
        return direct.split()[0].strip(" :-")[:80]
    for index, line in enumerate(lines):
        if not re.match(r"^\s*CODIGO\s*[:\-]", _ascii_upper(line)):
            continue
        context = _ascii_upper(" ".join(lines[index : min(len(lines), index + 3)]))
        if "CLIENTE" in context:
            value = re.split(r"[:\-]", line, maxsplit=1)[-1].strip()
            return value.split()[0][:80] if value else None
    return None


def detectar_placa(lines: list[str]) -> str | None:
    for line in lines:
        match = re.search(
            r"\bPLACA\s*[:\-]?\s*([A-Z]{2,4}[\s\-]?\d{3,5})\b",
            _ascii_upper(line),
        )
        if match:
            return re.sub(r"[\s\-]", "", match.group(1))[:20]
    return None


def _valor_pago(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+(?:\$\s*)?\d+[.,]\d{1,2}\s*$", "", value).strip(" :-")
    return re.sub(r"\s+", " ", cleaned).upper()[:500] or None


def detectar_datos_adicionales(lines: list[str]) -> dict[str, Any]:
    additional: dict[str, Any] = {}
    client_index = next(
        (index for index, line in enumerate(lines) if "CLIENTE" in _ascii_upper(line)),
        len(lines),
    )
    provider_section = lines[:client_index]
    address = _valor_etiquetado(
        provider_section,
        ("DIRECCION MATRIZ", "DIRECCION", "DIR."),
        max_length=500,
    )
    phone = _valor_etiquetado(
        provider_section,
        ("TELEFONO", "TELF", "TEL."),
        max_length=80,
    )
    if address:
        additional["direccionProveedor"] = address
    if phone and re.search(r"\d{6,}", _digits_from_ocr(phone)):
        additional["telefonoProveedor"] = phone

    for line in lines:
        upper = _ascii_upper(line)
        if "OBLIGADO" in upper and "CONTABILIDAD" in upper:
            if re.search(r"\bSI\b", upper):
                additional["obligadoContabilidad"] = True
            elif re.search(r"\bNO\b", upper):
                additional["obligadoContabilidad"] = False
        if "CONTRIBUYENTE ESPECIAL" in upper:
            additional["contribuyenteEspecial"] = not bool(re.search(r"\bNO\b", upper))
            resolution = re.search(r"(?:RESOLUCION|NRO|NO\.?|#)\s*[:#-]?\s*([A-Z0-9./-]{3,80})", upper)
            if resolution:
                additional["resolucionContribuyenteEspecial"] = resolution.group(1)
        if "AGENTE" in upper and "RETENCION" in upper:
            additional["agenteRetencion"] = not bool(re.search(r"\bNO\b", upper))
            resolution = re.search(r"(?:RESOLUCION|NRO|NO\.?|#)\s*[:#-]?\s*([A-Z0-9./-]{3,80})", upper)
            if resolution:
                additional["resolucionAgenteRetencion"] = resolution.group(1)

        labeled_amounts = (
            ("valorTotalSinSubsidio", ("VALOR TOTAL SIN SUBSIDIO", "TOTAL SIN SUBSIDIO")),
            ("ahorroSubsidio", ("AHORRO POR SUBSIDIO", "AHORRO SUBSIDIO")),
            ("subsidio", ("SUBSIDIO",)),
        )
        for key, labels in labeled_amounts:
            if key in additional or not any(label in upper for label in labels):
                continue
            if key == "subsidio" and any(label in upper for label in ("SIN SUBSIDIO", "AHORRO")):
                continue
            amounts = _amounts_in_line(line)
            if amounts:
                additional[key] = amounts[-1]

        iva_match = re.search(r"\b(?:IVA|I\.V\.A)\s*([0-9]{1,2}(?:[.,][0-9]+)?)\s*%", upper)
        if iva_match:
            tariff = normalizar_numero(
                iva_match.group(1), scale=2, decimal_lengths=(1, 2), maximum=Decimal("100")
            )
            if tariff is not None:
                additional["tarifaIva"] = int(tariff) if tariff.is_integer() else tariff

    operational_labels = {
        "despacho": ("DESPACHO",),
        "despachador": ("DESPACHADOR",),
        "dispensador": ("DISPENSADOR",),
        "surtidor": ("SURTIDOR",),
        "manguera": ("MANGUERA",),
    }
    for key, labels in operational_labels.items():
        value = _valor_etiquetado(lines, labels, max_length=120, allow_next_line=False)
        if value:
            additional[key] = value
    return additional


def extraer_campos(texto: str) -> tuple[dict[str, Any], list[str], dict[str, Any]]:
    lines = [line for line in limpiar_texto(texto).splitlines() if line]
    ruc, ruc_candidates = detectar_ruc(lines)
    client_id, client_id_candidates = detectar_identificacion_cliente(lines)
    invoice, invoice_candidates = detectar_numero_factura(lines)
    authorization, access_key, sri_candidates, sri_warnings = detectar_claves_sri(lines)
    emission_date, date_candidates = detectar_fecha(lines)
    amounts = detectar_montos(lines)
    condition = _valor_pago(
        _valor_etiquetado(
            lines,
            ("CONDICION DE PAGO", "CONDICION PAGO", "M.PAGO", "PAGO"),
            max_length=120,
            excluded_labels=("FORMA DE PAGO",),
        )
    )
    payment_method = _valor_pago(
        _valor_etiquetado(lines, ("FORMA DE PAGO",), max_length=500)
    )
    fields = {
        "proveedor": detectar_proveedor(lines),
        "rucProveedor": ruc,
        "numeroFactura": invoice,
        "numeroAutorizacion": authorization,
        "claveAcceso": access_key,
        "fechaEmision": emission_date,
        "horaEmision": detectar_hora_emision(lines),
        "cliente": detectar_cliente(lines),
        "identificacionCliente": client_id,
        "codigoCliente": detectar_codigo_cliente(lines),
        "placa": detectar_placa(lines),
        "condicionPago": condition,
        "formaPago": payment_method,
        "ambiente": _valor_pago(
            _valor_etiquetado(lines, ("AMBIENTE",), max_length=120)
        ),
        "tipoEmision": _valor_pago(
            _valor_etiquetado(
                lines,
                ("TIPO DE EMISION", "TIPO EMISION", "EMISION"),
                max_length=120,
                excluded_labels=("FECHA",),
            )
        ),
        **amounts,
        "datosAdicionales": detectar_datos_adicionales(lines),
    }
    warnings: list[str] = list(sri_warnings)
    if not ruc:
        warnings.append("No se detecto un RUC de proveedor con contexto suficiente.")
    if len(ruc_candidates) > 1:
        warnings.append("Se detectaron multiples candidatos de RUC; revise la sugerencia seleccionada.")
    if client_id and client_id == ruc:
        fields["identificacionCliente"] = None
        warnings.append("La identificacion del cliente coincide con el RUC proveedor y no se sugirio automaticamente.")
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
        "candidatosIdentificacionCliente": client_id_candidates,
        "candidatosNumeroFactura": invoice_candidates,
        "candidatosFecha": date_candidates,
        "candidatosClaveSri": sri_candidates,
    }
    return fields, warnings, metadata


def _confianzas_campos(fields: dict[str, Any], lines: list[str]) -> dict[str, float]:
    joined = _ascii_upper("\n".join(lines))
    labels = {
        "proveedor": ("RAZON SOCIAL", "PROVEEDOR", "EMISOR"),
        "rucProveedor": ("RUC", "R.U.C"),
        "numeroFactura": ("FACTURA", "COMPROBANTE"),
        "numeroAutorizacion": ("AUTORIZACI",),
        "claveAcceso": ("CLAVE", "ACCESO"),
        "fechaEmision": ("FECHA", "EMISION"),
        "horaEmision": ("FECHA", "EMISION"),
        "cliente": ("CLIENTE", "COMPRADOR", "ADQUIRENTE"),
        "identificacionCliente": ("RUC/CI", "CEDULA", "IDENTIFICACION"),
        "codigoCliente": ("CODIGO CLIENTE", "COD CLIENTE"),
        "placa": ("PLACA",),
        "condicionPago": ("CONDICION", "M.PAGO"),
        "formaPago": ("FORMA DE PAGO",),
        "ambiente": ("AMBIENTE",),
        "tipoEmision": ("EMISION",),
        "subtotal": ("SUBTOTAL", "SUB TOTAL"),
        "impuestos": ("IVA", "IMPUESTO"),
        "total": ("TOTAL",),
    }
    confidences: dict[str, float] = {}
    for field, field_labels in labels.items():
        value = fields.get(field)
        if value is None or value == "":
            continue
        label_matches = sum(1 for label in field_labels if label in joined)
        confidence = 0.72 + min(label_matches, 2) * 0.1
        if field in ("rucProveedor", "identificacionCliente") and len(str(value)) in (10, 13):
            confidence += 0.06
        if field in ("numeroAutorizacion", "claveAcceso") and len(str(value)) == 49:
            confidence += 0.08
        confidences[field] = round(min(confidence, 0.98), 2)
    return confidences


def _candidatos_con_contexto(
    lines: list[str],
    field_metadata: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    groups = {
        "ruc": field_metadata.get("candidatosRuc", []),
        "identificacionCliente": field_metadata.get("candidatosIdentificacionCliente", []),
        "numeroFactura": field_metadata.get("candidatosNumeroFactura", []),
        "fecha": field_metadata.get("candidatosFecha", []),
        "claveSri": field_metadata.get("candidatosClaveSri", []),
    }
    contextual: dict[str, list[dict[str, Any]]] = {}
    for group, values in groups.items():
        candidates: list[dict[str, Any]] = []
        for value in values:
            digits = re.sub(r"\D", "", str(value))
            selected_index = None
            for index, line in enumerate(lines):
                comparable = _ascii_upper(line)
                if str(value).upper() in comparable or (digits and digits in _digits_from_ocr(line)):
                    selected_index = index
                    break
            context = (
                _nearby_context(lines, selected_index)
                if selected_index is not None
                else ""
            )
            upper_context = _ascii_upper(context)
            suggested_type = None
            if "CLIENTE" in upper_context or "RUC/CI" in upper_context:
                suggested_type = "cliente"
            elif "RUC" in upper_context or "EMISOR" in upper_context:
                suggested_type = "proveedor"
            candidates.append(
                {
                    "valor": value,
                    "linea": selected_index + 1 if selected_index is not None else None,
                    "contexto": context[:500],
                    "tipoSugerido": suggested_type,
                }
            )
        contextual[group] = candidates
    return contextual


def _clasificar_lineas(
    line_records: list[dict[str, Any]],
    fields: dict[str, Any],
    products: list[dict[str, Any]],
) -> dict[str, Any]:
    interpreted_numbers: list[int] = []
    unclassified: list[dict[str, Any]] = []
    classified_records: list[dict[str, Any]] = []
    field_values = [
        _ascii_upper(str(value))
        for key, value in fields.items()
        if key != "datosAdicionales" and value not in (None, "")
    ]
    additional_values = [
        _ascii_upper(str(value))
        for value in (fields.get("datosAdicionales") or {}).values()
        if value not in (None, "")
    ]
    product_descriptions = [
        _ascii_upper(str(product.get("descripcion")))
        for product in products
        if product.get("descripcion")
    ]
    for record in line_records:
        upper = _ascii_upper(record["texto"])
        categories: list[str] = []
        if any(value and value in upper for value in field_values):
            categories.append("campo")
        if any(value and value in upper for value in additional_values):
            categories.append("adicional")
        if any(description in upper for description in product_descriptions):
            categories.append("producto")
        if any(label in upper for label in ("CANT", "DESCRIPCION", "P.UNIT", "PRECIO UNITARIO")):
            categories.append("encabezadoProducto")
        if categories:
            interpreted_numbers.append(record["numero"])
        else:
            unclassified.append(
                {"numero": record["numero"], "texto": record["texto"][:300]}
            )
        classified_records.append({**record, "clasificaciones": _unique(categories)})
    return {
        "lineas": classified_records[:MAX_METADATA_LINES],
        "lineasInterpretadas": interpreted_numbers,
        "lineasNoClasificadas": unclassified[:MAX_METADATA_LINES],
        "totalLineas": len(line_records),
        "totalLineasInterpretadas": len(interpreted_numbers),
        "totalLineasNoClasificadas": len(unclassified),
        "lineasMetadataTruncadas": max(0, len(line_records) - MAX_METADATA_LINES),
    }


def _usable_pdf_text(text: str) -> bool:
    cleaned = limpiar_texto(text)
    alphanumeric = sum(char.isalnum() for char in cleaned)
    return alphanumeric >= 40 and alphanumeric / max(len(cleaned), 1) >= 0.35


def _resize_for_ocr(image: Any) -> tuple[Any, float]:
    from PIL import Image as PILImage

    smallest = min(image.size)
    largest = max(image.size)
    factor = 1.0
    if smallest < 1200:
        factor = min(2.0, 1200 / max(smallest, 1))
    elif largest > 5000:
        factor = 5000 / largest
    if abs(factor - 1.0) < 0.01:
        return image, 1.0
    return (
        image.resize(
            (round(image.width * factor), round(image.height * factor)),
            resample=PILImage.Resampling.LANCZOS,
        ),
        factor,
    )


def _otsu_threshold(gray: Any) -> int:
    histogram = gray.histogram()[:256]
    total = sum(histogram)
    weighted_total = sum(index * count for index, count in enumerate(histogram))
    background_weight = 0
    background_sum = 0.0
    maximum_variance = -1.0
    selected = 128
    for threshold, count in enumerate(histogram):
        background_weight += count
        if not background_weight:
            continue
        foreground_weight = total - background_weight
        if not foreground_weight:
            break
        background_sum += threshold * count
        background_mean = background_sum / background_weight
        foreground_mean = (weighted_total - background_sum) / foreground_weight
        variance = background_weight * foreground_weight * (
            background_mean - foreground_mean
        ) ** 2
        if variance > maximum_variance:
            maximum_variance = variance
            selected = threshold
    return selected


def _safe_content_crop(gray: Any) -> tuple[Any | None, dict[str, Any]]:
    content_mask = gray.point(lambda pixel: 255 if pixel < 242 else 0)
    bounds = content_mask.getbbox()
    if not bounds:
        return None, {"aplicado": False, "motivo": "sin_limites_confiables"}
    left, top, right, bottom = bounds
    content_width = right - left
    content_height = bottom - top
    retained_ratio = (content_width * content_height) / (gray.width * gray.height)
    if not (
        0.35 <= retained_ratio <= 0.88
        and content_width >= gray.width * 0.45
        and content_height >= gray.height * 0.55
    ):
        return None, {
            "aplicado": False,
            "motivo": "limites_no_conservadores",
            "proporcionRetenida": round(retained_ratio, 4),
        }
    padding = max(16, round(min(gray.size) * 0.025))
    crop_bounds = (
        max(0, left - padding),
        max(0, top - padding),
        min(gray.width, right + padding),
        min(gray.height, bottom + padding),
    )
    return gray.crop(crop_bounds), {
        "aplicado": True,
        "limites": list(crop_bounds),
        "proporcionRetenida": round(retained_ratio, 4),
    }


def _build_image_variants(image: Any) -> tuple[dict[str, Any], list[str], dict[str, Any]]:
    from PIL import ImageChops, ImageEnhance, ImageFilter, ImageOps, ImageStat

    oriented = ImageOps.exif_transpose(image).convert("RGB")
    optimized, scale = _resize_for_ocr(oriented)
    gray = ImageOps.grayscale(optimized)
    contrast_value = float(ImageStat.Stat(gray).stddev[0])
    warnings: list[str] = []
    if contrast_value < 18:
        warnings.append("La calidad del documento parece insuficiente por bajo contraste.")

    contrasted = ImageOps.autocontrast(gray, cutoff=1)
    contrasted = ImageEnhance.Contrast(contrasted).enhance(1.15)
    local_radius = max(8, round(min(contrasted.size) / 120))
    local_background = contrasted.filter(ImageFilter.GaussianBlur(radius=local_radius))
    locally_normalized = ImageChops.add(
        contrasted,
        ImageChops.invert(local_background),
        scale=1.0,
        offset=-128,
    )
    # La resta local queda centrada en 128: fondo ~= 128 y tinta < 128.
    # Un umbral apenas inferior conserva trazos termicos finos sin ennegrecer el papel.
    adaptive_threshold = 120 if contrast_value < 24 else 116
    adaptive = locally_normalized.point(
        lambda pixel: 255 if pixel > adaptive_threshold else 0
    )
    otsu_value = _otsu_threshold(contrasted)
    otsu = contrasted.point(lambda pixel: 255 if pixel > otsu_value else 0)
    cropped, crop_metadata = _safe_content_crop(contrasted)

    variants = {
        "original_optimizada": optimized,
        "grises_contraste": contrasted,
        "umbral_adaptativo": adaptive,
        "otsu": otsu,
    }
    if cropped is not None:
        variants["recorte_seguro_contraste"] = cropped
        warnings.append(
            "Se preparo una copia con recorte conservador; el archivo original permanecio intacto."
        )
    return variants, warnings, {
        "escala": round(scale, 3),
        "contrasteOriginal": round(contrast_value, 2),
        "umbralOtsu": otsu_value,
        "recorte": crop_metadata,
        "dimensionesOriginales": list(oriented.size),
        "dimensionesOptimizadas": list(optimized.size),
    }


def _prepare_image(image: Any, output_path: Path) -> tuple[Any, list[str]]:
    """Contrato legado: prepara una copia temporal sin modificar el origen."""
    variants, warnings, _metadata = _build_image_variants(image)
    prepared = variants["grises_contraste"]
    prepared.save(output_path, format="PNG")
    return prepared, warnings


def _configure_tesseract(pytesseract: Any) -> tuple[str, str | None, str, bool]:
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
    if "spa" in languages:
        fallback = "spa+eng" if "eng" in languages else None
        return "spa", fallback, tessdata_config, True
    if "eng" in languages:
        return "eng", None, tessdata_config, False
    raise RuntimeError("Tesseract no tiene instalados los idiomas spa o eng.")


def _data_value(data: dict[str, Any], key: str, index: int, default: Any) -> Any:
    values = data.get(key) or []
    return values[index] if index < len(values) else default


def _tokens_from_tesseract_data(data: dict[str, Any]) -> list[dict[str, Any]]:
    tokens: list[dict[str, Any]] = []
    for index, raw_word in enumerate(data.get("text") or []):
        word = str(raw_word or "").strip()
        if not word:
            continue
        try:
            confidence = float(_data_value(data, "conf", index, -1))
        except (TypeError, ValueError):
            confidence = -1.0
        try:
            left = int(_data_value(data, "left", index, 0))
            top = int(_data_value(data, "top", index, 0))
            width = max(0, int(_data_value(data, "width", index, 0)))
            height = max(1, int(_data_value(data, "height", index, 1)))
        except (TypeError, ValueError):
            left, top, width, height = 0, 0, 0, 1
        tokens.append(
            {
                "text": word,
                "conf": confidence,
                "left": left,
                "top": top,
                "width": width,
                "height": height,
                "right": left + width,
                "centerY": top + (height / 2),
                "page_num": int(_data_value(data, "page_num", index, 1) or 1),
                "block_num": int(_data_value(data, "block_num", index, 0) or 0),
                "par_num": int(_data_value(data, "par_num", index, 0) or 0),
                "line_num": int(_data_value(data, "line_num", index, 0) or 0),
                "word_num": int(_data_value(data, "word_num", index, 0) or 0),
            }
        )
    return tokens


def _line_text_with_spacing(tokens: list[dict[str, Any]]) -> str:
    ordered = sorted(tokens, key=lambda token: (token["left"], token["word_num"]))
    character_widths = [
        token["width"] / max(len(token["text"]), 1)
        for token in ordered
        if token["width"] > 0
    ]
    typical_width = median(character_widths) if character_widths else 8.0
    parts: list[str] = []
    previous_right: int | None = None
    for token in ordered:
        if previous_right is not None:
            gap = token["left"] - previous_right
            spaces = 1
            if gap > typical_width * 3:
                spaces = min(8, max(2, round(gap / max(typical_width, 1))))
            parts.append(" " * spaces)
        parts.append(token["text"])
        previous_right = max(previous_right or 0, token["right"])
    return "".join(parts).strip()


def _line_record(
    tokens: list[dict[str, Any]],
    *,
    variant: str,
    reconstruction: str,
    key: tuple[int, int, int, int] | None = None,
) -> dict[str, Any]:
    confidences = [token["conf"] for token in tokens if token["conf"] >= 0]
    left = min(token["left"] for token in tokens)
    top = min(token["top"] for token in tokens)
    right = max(token["right"] for token in tokens)
    bottom = max(token["top"] + token["height"] for token in tokens)
    page, block, paragraph, line_number = key or (
        tokens[0]["page_num"],
        None,
        None,
        None,
    )
    return {
        "numero": 0,
        "pagina": page,
        "texto": _line_text_with_spacing(tokens),
        "modo": "ocr",
        "variante": variant,
        "reconstruccion": reconstruction,
        "bloque": block,
        "parrafo": paragraph,
        "lineaOcr": line_number,
        "left": left,
        "top": top,
        "width": right - left,
        "height": bottom - top,
        "confianza": round(sum(confidences) / len(confidences), 2)
        if confidences
        else None,
        "totalPalabras": len(tokens),
    }


def _reconstruct_by_tesseract_lines(
    tokens: list[dict[str, Any]], variant: str
) -> list[dict[str, Any]]:
    groups: dict[tuple[int, int, int, int], list[dict[str, Any]]] = {}
    for token in tokens:
        key = (
            token["page_num"],
            token["block_num"],
            token["par_num"],
            token["line_num"],
        )
        groups.setdefault(key, []).append(token)
    records = [
        _line_record(group, variant=variant, reconstruction="lineas_tesseract", key=key)
        for key, group in groups.items()
    ]
    return sorted(records, key=lambda record: (record["pagina"], record["top"], record["left"]))


def _reconstruct_by_geometry(
    tokens: list[dict[str, Any]], variant: str
) -> list[dict[str, Any]]:
    if not tokens:
        return []
    typical_height = median(token["height"] for token in tokens)
    tolerance = max(2.0, typical_height * 0.65)
    groups: list[dict[str, Any]] = []
    for token in sorted(tokens, key=lambda item: (item["page_num"], item["centerY"], item["left"])):
        candidate = None
        candidate_distance = None
        for group in reversed(groups[-12:]):
            if group["pagina"] != token["page_num"]:
                continue
            distance = abs(token["centerY"] - group["centerY"])
            if distance <= tolerance and (
                candidate_distance is None or distance < candidate_distance
            ):
                candidate = group
                candidate_distance = distance
        if candidate is None:
            groups.append(
                {"pagina": token["page_num"], "centerY": token["centerY"], "tokens": [token]}
            )
        else:
            candidate["tokens"].append(token)
            candidate["centerY"] = sum(
                item["centerY"] for item in candidate["tokens"]
            ) / len(candidate["tokens"])
    records = [
        _line_record(
            group["tokens"], variant=variant, reconstruction="coordenadas_y"
        )
        for group in groups
    ]
    return sorted(records, key=lambda record: (record["pagina"], record["top"], record["left"]))


def _reconstruction_quality(records: list[dict[str, Any]]) -> float:
    if not records:
        return -100.0
    useful = sum(len(record["texto"].strip()) >= 3 for record in records)
    fragments = sum(
        record.get("totalPalabras", 0) == 1 and len(record["texto"].strip()) <= 3
        for record in records
    )
    return useful - (fragments * 1.5) - (len(records) * 0.03)


def _reconstruct_tokens(
    tokens: list[dict[str, Any]], variant: str
) -> tuple[str, list[dict[str, Any]], str]:
    tesseract_lines = _reconstruct_by_tesseract_lines(tokens, variant)
    geometry_lines = _reconstruct_by_geometry(tokens, variant)
    if _reconstruction_quality(geometry_lines) > _reconstruction_quality(
        tesseract_lines
    ) + 0.5:
        selected, strategy = geometry_lines, "coordenadas_y"
    else:
        selected, strategy = tesseract_lines, "lineas_tesseract"
    text = conservar_texto_original("\n".join(record["texto"] for record in selected))
    return text, selected, strategy


def _evaluate_ocr_result(
    text: str, tokens: list[dict[str, Any]]
) -> dict[str, Any]:
    confidences = [token["conf"] for token in tokens if token["conf"] >= 0]
    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    characters = len(text)
    valid_characters = sum(char.isalnum() for char in text)
    valid_ratio = valid_characters / max(characters, 1)
    lines = [line for line in text.splitlines() if line.strip()]
    useful_lines = sum(sum(char.isalnum() for char in line) >= 3 for line in lines)
    normalized = _ascii_upper(text)
    recognizable = sum(pattern in normalized for pattern in INVOICE_SCORE_PATTERNS)
    replacements = text.count("�") + text.count("ï¿½")
    allowed_punctuation = set(".,:;/-_$%()[]#&+*=|'\"")
    strange = sum(
        not char.isalnum()
        and not char.isspace()
        and char not in allowed_punctuation
        for char in text
    )
    isolated = sum(len(line.strip()) == 1 for line in lines)
    low_confidence = sum(confidence < 35 for confidence in confidences)
    noise_ratio = strange / max(characters, 1)
    score = (
        (average_confidence * 0.50)
        + (valid_ratio * 15)
        + (min(valid_characters / 800, 1) * 8)
        + (min(useful_lines / 25, 1) * 7)
        + (min(recognizable, 8) * 2)
        - (noise_ratio * 30)
        - (replacements * 5)
        - ((isolated / max(len(lines), 1)) * 8)
        - ((low_confidence / max(len(confidences), 1)) * 8)
    )
    return {
        "score": round(max(0.0, min(100.0, score)), 2),
        "confianzaMedia": round(average_confidence, 2) if confidences else None,
        "caracteres": characters,
        "caracteresValidos": valid_characters,
        "lineas": len(lines),
        "lineasUtiles": useful_lines,
        "totalPalabras": len(tokens),
        "camposReconocibles": recognizable,
        "proporcionRuido": round(noise_ratio, 4),
        "reemplazosInvalidos": replacements,
    }


def _select_best_ocr(results: list[dict[str, Any]]) -> dict[str, Any]:
    if not results:
        raise OcrEmptyOutputError("El OCR no produjo resultados evaluables.")
    return max(
        results,
        key=lambda result: (
            result["metricas"]["score"],
            result["metricas"]["confianzaMedia"] or 0,
            result["metricas"]["caracteresValidos"],
            -result["orden"],
        ),
    )


def _ocr_image(image: Any, output_path: Path) -> tuple[dict[str, Any], list[str], str]:
    import pytesseract
    from pytesseract import Output

    started = time.perf_counter()
    variants, warnings, preprocessing = _build_image_variants(image)
    variants["grises_contraste"].save(output_path, format="PNG")
    primary_language, fallback_language, tessdata_config, spanish_available = (
        _configure_tesseract(pytesseract)
    )
    if not spanish_available:
        warnings.append(
            "El idioma espanol no esta instalado en Tesseract; se proceso solamente con ingles."
        )

    plans: list[tuple[str, int, str]] = [
        ("original_optimizada", 6, primary_language),
        ("grises_contraste", 4, primary_language),
        ("grises_contraste", 11, primary_language),
        ("grises_contraste", 6, primary_language),
    ]
    threshold_variant = (
        "umbral_adaptativo"
        if preprocessing["contrasteOriginal"] < 35
        else "otsu"
    )
    plans.append((threshold_variant, 6, primary_language))
    if "recorte_seguro_contraste" in variants:
        plans.append(("recorte_seguro_contraste", 6, primary_language))
    elif threshold_variant != "otsu":
        plans.append(("otsu", 6, primary_language))

    results: list[dict[str, Any]] = []
    early_stop = False
    for order, (variant, psm, language) in enumerate(plans[:MAX_OCR_PASSES], 1):
        pass_started = time.perf_counter()
        config = " ".join(
            value for value in (tessdata_config, f"--oem 1 --psm {psm}") if value
        )
        data = pytesseract.image_to_data(
            variants[variant],
            lang=language,
            config=config,
            output_type=Output.DICT,
        )
        tokens = _tokens_from_tesseract_data(data)
        reconstructed, line_records, reconstruction = _reconstruct_tokens(
            tokens, variant
        )
        metrics = _evaluate_ocr_result(reconstructed, tokens)
        metrics["duracionMs"] = round((time.perf_counter() - pass_started) * 1000)
        results.append(
            {
                "orden": order,
                "variante": variant,
                "psm": psm,
                "idioma": language,
                "imagen": variants[variant],
                "textoReconstruido": reconstructed,
                "lineas": line_records,
                "tokens": tokens,
                "reconstruccion": reconstruction,
                "metricas": metrics,
            }
        )
        best_so_far = _select_best_ocr(results)
        if (
            order >= 3
            and best_so_far["metricas"]["score"] >= EARLY_STOP_SCORE
            and (best_so_far["metricas"]["confianzaMedia"] or 0) >= 82
            and best_so_far["metricas"]["camposReconocibles"] >= 4
        ):
            early_stop = True
            break

    selected = _select_best_ocr(results)
    if (
        not early_stop
        and fallback_language
        and selected["metricas"]["score"] < 68
        and len(results) < MAX_OCR_PASSES
    ):
        variant = selected["variante"]
        psm = selected["psm"]
        pass_started = time.perf_counter()
        config = " ".join(
            value for value in (tessdata_config, f"--oem 1 --psm {psm}") if value
        )
        data = pytesseract.image_to_data(
            variants[variant],
            lang=fallback_language,
            config=config,
            output_type=Output.DICT,
        )
        tokens = _tokens_from_tesseract_data(data)
        reconstructed, line_records, reconstruction = _reconstruct_tokens(tokens, variant)
        metrics = _evaluate_ocr_result(reconstructed, tokens)
        metrics["duracionMs"] = round((time.perf_counter() - pass_started) * 1000)
        results.append(
            {
                "orden": len(results) + 1,
                "variante": variant,
                "psm": psm,
                "idioma": fallback_language,
                "imagen": variants[variant],
                "textoReconstruido": reconstructed,
                "lineas": line_records,
                "tokens": tokens,
                "reconstruccion": reconstruction,
                "metricas": metrics,
            }
        )
        selected = _select_best_ocr(results)

    selected_config = " ".join(
        value
        for value in (
            tessdata_config,
            f"--oem 1 --psm {selected['psm']}",
        )
        if value
    )
    try:
        raw_text = conservar_texto_original(
            pytesseract.image_to_string(
                selected["imagen"],
                lang=selected["idioma"],
                config=selected_config,
            )
        )
    except Exception:
        raw_text = selected["textoReconstruido"]
        warnings.append(
            "No se pudo obtener la salida RAW adicional; se conservo la reconstruccion espacial."
        )

    confidence = selected["metricas"]["confianzaMedia"]
    if confidence is not None and confidence < 45:
        warnings.append("La confianza promedio del OCR es baja; revise los valores sugeridos.")
    if selected["metricas"]["score"] < 50:
        warnings.append(
            "El OCR produjo texto de baja calidad; se conservo para revision sin marcar un fallo tecnico."
        )
    evaluated = [
        {
            "nombre": f"{result['variante']}_psm{result['psm']}_{result['idioma']}",
            "variante": result["variante"],
            "psm": result["psm"],
            "idioma": result["idioma"],
            **result["metricas"],
        }
        for result in results
    ]
    duration_ms = round((time.perf_counter() - started) * 1000)
    strategy = f"{selected['variante']}_psm{selected['psm']}_{selected['idioma']}"
    payload = {
        "textoCompleto": selected["textoReconstruido"],
        "textoReconstruido": selected["textoReconstruido"],
        "textoRaw": raw_text,
        "textoNormalizado": limpiar_texto(selected["textoReconstruido"]),
        "lineas": selected["lineas"],
        "confianza": confidence,
        "variante": selected["variante"],
        "psm": selected["psm"],
        "idioma": selected["idioma"],
        "estrategiaSeleccionada": strategy,
        "reconstruccion": selected["reconstruccion"],
        "score": selected["metricas"]["score"],
        "variantesEvaluadas": evaluated,
        "numeroPasadas": len(results),
        "earlyStop": early_stop,
        "duracionMs": duration_ms,
        "preprocesamiento": preprocessing,
    }
    return payload, warnings, str(pytesseract.get_tesseract_version()).splitlines()[0]


def _adaptar_resultado_pagina(
    result: Any,
    *,
    pagina: int,
) -> tuple[dict[str, Any], list[str], str | None]:
    """Acepta el contrato actual y el tuple legado usado por integraciones/pruebas."""
    if isinstance(result, tuple) and len(result) == 3 and isinstance(result[0], dict):
        payload, warnings, version = result
    elif isinstance(result, tuple) and len(result) == 4:
        text, confidence, warnings, version = result
        original = conservar_texto_original(text)
        payload = {
            "textoCompleto": original,
            "textoReconstruido": original,
            "textoRaw": original,
            "textoNormalizado": limpiar_texto(original),
            "lineas": _lineas_desde_texto(original, pagina=pagina, modo="ocr"),
            "confianza": confidence,
            "variante": "integracion_legada",
        }
    else:
        raise RuntimeError("El motor OCR devolvio un formato de pagina invalido.")
    payload = dict(payload)
    payload["textoCompleto"] = conservar_texto_original(payload.get("textoCompleto", ""))
    payload["textoReconstruido"] = conservar_texto_original(
        payload.get("textoReconstruido") or payload["textoCompleto"]
    )
    payload["textoRaw"] = conservar_texto_original(
        payload.get("textoRaw") or payload["textoCompleto"]
    )
    payload["textoNormalizado"] = limpiar_texto(
        payload.get("textoNormalizado") or payload["textoCompleto"]
    )
    normalized_lines = []
    for record in payload.get("lineas") or _lineas_desde_texto(
        payload["textoCompleto"], pagina=pagina, modo="ocr"
    ):
        normalized_lines.append({**record, "pagina": pagina})
    payload["lineas"] = normalized_lines
    return payload, list(warnings or []), version


def _interpretar_documento(
    normalized_text: str,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[str], dict[str, Any]]:
    fields = {field: ({} if field == "datosAdicionales" else None) for field in FIELD_NAMES}
    products: list[dict[str, Any]] = []
    warnings: list[str] = []
    metadata: dict[str, Any] = {}
    try:
        parsed_fields, field_warnings, field_metadata = extraer_campos(normalized_text)
        fields.update(parsed_fields)
        warnings.extend(field_warnings)
        metadata.update(field_metadata)
    except Exception as error:
        warnings.append(
            "El texto OCR se conservo completo, pero no se pudo interpretar la cabecera del documento."
        )
        metadata["errorParserCabecera"] = type(error).__name__
    try:
        products, product_warnings, product_metadata = extraer_productos(
            normalized_text, fields
        )
        warnings.extend(product_warnings)
        metadata["productosResumen"] = product_metadata
    except Exception as error:
        warnings.append(
            "El texto OCR se conservo completo, pero no se pudieron interpretar los productos."
        )
        metadata["errorParserProductos"] = type(error).__name__
        metadata["productosResumen"] = {
            "cantidadProductos": 0,
            "sumaTotalesLinea": None,
            "diferenciaSubtotal": None,
            "diferenciaTotal": None,
        }
    return fields, products, warnings, metadata


def procesar_documento(path: Path, mime: str, extension: str) -> dict[str, Any]:
    from PIL import Image

    page_payloads: list[dict[str, Any]] = []
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
                extracted = [
                    conservar_texto_original(pdf.pages[index].extract_text() or "")
                    for index in range(process_count)
                ]

            rendered_pdf = None
            try:
                for index, page_text in enumerate(extracted):
                    if _usable_pdf_text(page_text):
                        page_payloads.append(
                            {
                                "textoCompleto": page_text,
                                "textoNormalizado": limpiar_texto(page_text),
                                "lineas": _lineas_desde_texto(
                                    page_text, pagina=index + 1, modo="texto_pdf"
                                ),
                                "confianza": None,
                                "variante": "texto_pdf",
                            }
                        )
                        modes.append("texto_pdf")
                        continue
                    if rendered_pdf is None:
                        rendered_pdf = pdfium.PdfDocument(str(path))
                    page = rendered_pdf[index]
                    image = page.render(scale=2.5).to_pil()
                    page_path = temp_dir / f"pagina_{index + 1}.png"
                    payload, page_warnings, version = _adaptar_resultado_pagina(
                        _ocr_image(image, page_path), pagina=index + 1
                    )
                    page_payloads.append(payload)
                    modes.append("ocr")
                    warnings.extend(page_warnings)
                    if payload.get("confianza") is not None:
                        confidences.append(payload["confianza"])
                    engine_version = engine_version or version
                    page.close()
            finally:
                if rendered_pdf is not None:
                    rendered_pdf.close()
        else:
            with Image.open(path) as image:
                image_path = temp_dir / "imagen_preparada.png"
                payload, image_warnings, engine_version = _adaptar_resultado_pagina(
                    _ocr_image(image, image_path), pagina=1
                )
            page_payloads.append(payload)
            modes.append("ocr")
            warnings.extend(image_warnings)
            if payload.get("confianza") is not None:
                confidences.append(payload["confianza"])

    reconstructed_text = conservar_texto_original(
        "\n\n".join(
            payload.get("textoReconstruido") or payload["textoCompleto"]
            for payload in page_payloads
            if payload.get("textoCompleto")
        )
    )
    raw_text = conservar_texto_original(
        "\n\n".join(
            payload.get("textoRaw") or payload["textoCompleto"]
            for payload in page_payloads
            if payload.get("textoCompleto")
        )
    )
    normalized_text = limpiar_texto(reconstructed_text)
    if sum(char.isalnum() for char in reconstructed_text) < 3:
        raise OcrEmptyOutputError("El OCR no produjo texto utilizable.")
    if sum(char.isalnum() for char in reconstructed_text) < 30:
        warnings.append("El OCR produjo poco texto; la calidad del documento puede ser insuficiente.")
    line_records: list[dict[str, Any]] = []
    for payload in page_payloads:
        for record in payload.get("lineas", []):
            line_records.append({**record, "numero": len(line_records) + 1})
    fields, products, parser_warnings, parser_metadata = _interpretar_documento(
        normalized_text
    )
    warnings.extend(parser_warnings)
    normalized_lines = [record["texto"] for record in line_records]
    classification = _clasificar_lineas(line_records, fields, products)
    metadata_lines = classification.pop("lineas")
    field_metadata = {
        **parser_metadata,
        "candidatos": _candidatos_con_contexto(normalized_lines, parser_metadata),
        "confianzasCampos": _confianzas_campos(fields, normalized_lines),
        **classification,
    }
    if classification["lineasMetadataTruncadas"]:
        warnings.append(
            "La metadata espacial se limito para controlar el tamano; el texto OCR completo permanece intacto."
        )
    engine = "pdfplumber" if modes and all(mode == "texto_pdf" for mode in modes) else "tesseract"
    if "texto_pdf" in modes and "ocr" in modes:
        engine = "pdfplumber+tesseract"
    return {
        "ok": True,
        "texto": reconstructed_text,
        "ocr": {
            "textoCompleto": reconstructed_text,
            "textoReconstruido": reconstructed_text,
            "textoRaw": raw_text,
            "textoNormalizado": normalized_text,
            "lineas": metadata_lines,
        },
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
            "variantesSeleccionadas": [
                payload.get("variante") for payload in page_payloads
            ],
            "ocr": {
                "estrategiaSeleccionada": page_payloads[0].get(
                    "estrategiaSeleccionada"
                )
                if len(page_payloads) == 1
                else None,
                "confianzaMedia": round(sum(confidences) / len(confidences), 2)
                if confidences
                else None,
                "totalLineas": len(line_records),
                "totalPalabras": sum(
                    len(payload.get("tokens") or []) for payload in page_payloads
                )
                or sum(
                    item.get("totalPalabras", 0)
                    for payload in page_payloads
                    for item in payload.get("lineas", [])
                ),
                "duracionMs": sum(
                    int(payload.get("duracionMs") or 0) for payload in page_payloads
                ),
                "numeroPasadas": sum(
                    int(payload.get("numeroPasadas") or 0) for payload in page_payloads
                ),
                "earlyStop": bool(page_payloads)
                and all(payload.get("earlyStop") is True for payload in page_payloads),
                "psm": page_payloads[0].get("psm")
                if len(page_payloads) == 1
                else None,
                "idioma": page_payloads[0].get("idioma")
                if len(page_payloads) == 1
                else None,
                "reconstruccion": page_payloads[0].get("reconstruccion")
                if len(page_payloads) == 1
                else None,
                "score": page_payloads[0].get("score")
                if len(page_payloads) == 1
                else None,
            },
            "variantes": [
                variant
                for payload in page_payloads
                for variant in payload.get("variantesEvaluadas", [])
            ],
            "preprocesamiento": [
                payload.get("preprocesamiento")
                for payload in page_payloads
                if payload.get("preprocesamiento")
            ],
            **field_metadata,
        },
    }


def _configure_utf8_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict")


def _serialize_result(result: dict[str, Any]) -> str:
    return json.dumps(result, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    _configure_utf8_stdio()
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
    except OcrEmptyOutputError:
        result = {
            "ok": False,
            "error": "El OCR no produjo texto utilizable.",
            "codigo": "OCR_EMPTY_OUTPUT",
        }
    except Exception as error:  # El detalle tecnico se registra solamente en stderr.
        print(f"OCR error: {type(error).__name__}: {error}", file=sys.stderr)
        result = {"ok": False, "error": "No se pudo leer o procesar el documento.", "codigo": "OCR_FAILED"}
    print(_serialize_result(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
