import unittest
from pathlib import Path
import sys
import hashlib
import tempfile
from unittest.mock import MagicMock, patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from facturas_fisicas_ocr import (
    OcrEmptyOutputError,
    _evaluate_ocr_result,
    _prepare_image,
    _reconstruct_tokens,
    _select_best_ocr,
    _serialize_result,
    _tokens_from_tesseract_data,
    extraer_campos,
    extraer_productos,
    normalizar_monto,
    procesar_documento,
)


class FacturasFisicasOcrParserTest(unittest.TestCase):
    @staticmethod
    def _ocr_tokens(rows):
        data = {
            "text": [],
            "conf": [],
            "left": [],
            "top": [],
            "width": [],
            "height": [],
            "page_num": [],
            "block_num": [],
            "par_num": [],
            "line_num": [],
            "word_num": [],
        }
        for index, row in enumerate(rows, 1):
            text, left, top, line = row[:4]
            confidence = row[4] if len(row) > 4 else 90
            data["text"].append(text)
            data["conf"].append(str(confidence))
            data["left"].append(left)
            data["top"].append(top)
            data["width"].append(max(8, len(text) * 8))
            data["height"].append(18)
            data["page_num"].append(1)
            data["block_num"].append(1)
            data["par_num"].append(1)
            data["line_num"].append(line)
            data["word_num"].append(index)
        return _tokens_from_tesseract_data(data)

    def test_serializa_utf8_sin_forzar_ascii_ni_reemplazos(self):
        expected = "Teléfono Resolución Emisión Descripción Cédula Pichincha"
        serialized = _serialize_result({"ok": True, "texto": expected})
        self.assertIn(expected, serialized)
        self.assertNotIn("\\u00e9", serialized)
        self.assertNotIn("�", serialized)

    def test_reconstruye_fila_de_producto_por_posicion_x(self):
        tokens = self._ocr_tokens(
            [
                ("10.09", 450, 100, 1),
                ("3.52", 220, 100, 1),
                ("EXTRA", 90, 100, 1),
                ("3.578", 10, 100, 1),
                ("2.8191", 350, 100, 1),
                ("0.70", 290, 100, 1),
            ]
        )
        text, lines, _strategy = _reconstruct_tokens(tokens, "prueba")
        self.assertEqual(len(lines), 1)
        self.assertEqual(text.split(), ["3.578", "EXTRA", "3.52", "0.70", "2.8191", "10.09"])
        self.assertIn("  ", text)

    def test_reconstruccion_geometrica_conserva_lineas_separadas(self):
        tokens = self._ocr_tokens(
            [
                ("CLIENTE:", 10, 100, 0),
                ("GARCIA", 100, 101, 0),
                ("SALVADOR", 180, 99, 0),
                ("GABRIELA", 280, 100, 0),
                ("ELIZABETH", 10, 140, 0),
            ]
        )
        text, lines, strategy = _reconstruct_tokens(tokens, "prueba")
        self.assertEqual(strategy, "coordenadas_y")
        self.assertEqual(len(lines), 2)
        self.assertEqual(text.splitlines()[0].split(), ["CLIENTE:", "GARCIA", "SALVADOR", "GABRIELA"])
        self.assertEqual(text.splitlines()[1], "ELIZABETH")

    def test_score_prefiere_factura_legible_sobre_mas_texto_con_ruido(self):
        noisy_text = ("X � | ~ ^ ` " * 120) + "RUIDO"
        useful_text = (
            "RUC 1792291593001\nFACTURA 002-011-001277805\nFECHA 19/08/2026\n"
            "CLIENTE GARCIA\nSUBTOTAL 10.09\nIVA 1.51\nTOTAL 11.60\nFORMA DE PAGO EFECTIVO"
        )
        little_text = "TOTAL 1"
        noisy_tokens = self._ocr_tokens([("RUIDO", 10, 10, 1, 28)] * 80)
        useful_tokens = self._ocr_tokens(
            [(word, index * 70, (index // 4) * 25, (index // 4) + 1, 88) for index, word in enumerate(useful_text.split())]
        )
        little_tokens = self._ocr_tokens([("TOTAL", 10, 10, 1, 96), ("1", 80, 10, 1, 96)])
        candidates = [
            {"orden": 1, "metricas": _evaluate_ocr_result(noisy_text, noisy_tokens)},
            {"orden": 2, "metricas": _evaluate_ocr_result(useful_text, useful_tokens)},
            {"orden": 3, "metricas": _evaluate_ocr_result(little_text, little_tokens)},
        ]
        self.assertIs(_select_best_ocr(candidates), candidates[1])

    def test_extrae_campos_ecuatorianos_y_normaliza_montos(self):
        text = """
        Razon Social: EMPRESA XYZ S.A.
        RUC: 1790012345001
        FACTURA No. 001-002-000012345
        Fecha de emision: 19/08/2026
        SUBTOTAL $ 1.234,56
        IVA $ 185,18
        TOTAL A PAGAR $ 1.419,74
        """
        fields, warnings, metadata = extraer_campos(text)
        self.assertEqual(fields["proveedor"], "EMPRESA XYZ S.A.")
        self.assertEqual(fields["rucProveedor"], "1790012345001")
        self.assertEqual(fields["numeroFactura"], "001-002-000012345")
        self.assertEqual(fields["fechaEmision"], "2026-08-19")
        self.assertEqual(fields["subtotal"], 1234.56)
        self.assertEqual(fields["impuestos"], 185.18)
        self.assertEqual(fields["total"], 1419.74)
        self.assertNotIn("Los valores detectados no coinciden con el total de la factura.", warnings)
        self.assertEqual(metadata["candidatosRuc"], ["1790012345001"])

    def test_no_inventa_ruc_sin_contexto_y_advierte_diferencia(self):
        text = """
        Referencia 1790012345001
        FACTURA 001 001 000000123
        Fecha de autorizacion: 2026-08-19
        SUBTOTAL 100,00
        IVA 15,00
        TOTAL 120,00
        """
        fields, warnings, _metadata = extraer_campos(text)
        self.assertIsNone(fields["rucProveedor"])
        self.assertIsNone(fields["fechaEmision"])
        self.assertIn("Los valores detectados no coinciden con el total de la factura.", warnings)

    def test_normaliza_formatos_monetarios_frecuentes(self):
        self.assertEqual(normalizar_monto("1.234,56"), 1234.56)
        self.assertEqual(normalizar_monto("1,234.56"), 1234.56)
        self.assertEqual(normalizar_monto("1234,56"), 1234.56)
        self.assertEqual(normalizar_monto("$ 123.45"), 123.45)

    def test_factura_combustible_distingue_emisor_cliente_y_conserva_precision(self):
        access_key = "1908202601179229159300120020110012778051234557811"
        text = f"""
        AGRICOLA AGROTATI CIA. LTDA.
        RUC: 1792291593001
        FACTURA 002-011-001277805
        Número de Autorización:
        {access_key}
        Clave Acceso SRI:
        {access_key}
        AMBIENTE: PRODUCCION
        EMISION: NORMAL
        FECHA: 19/08/2026 11:42:23
        M.PAGO: CONTADO
        CODIGO: 580520
        CLIENTE: GARCIA SALVADOR GABRIELA ELIZABETH
        RUC/CI: 1721146080001
        PLACA: PDC5312
        CANT. DESCRIPCION VALOR UNIT. VALOR
        3.578 EXTRA 2.8191 10.09
        Sub Total: 10.09
        IVA 15.00%: 1.51
        Total: 11.60
        Valor total sin subsidio: 14.47
        Ahorro por subsidio: 2.87
        Forma de Pago:
        Sin utilización del Sistema Financiero 11.60
        """
        fields, _warnings, _metadata = extraer_campos(text)
        products, _warnings, _metadata = extraer_productos(text, fields)

        self.assertEqual(fields["rucProveedor"], "1792291593001")
        self.assertEqual(fields["identificacionCliente"], "1721146080001")
        self.assertEqual(fields["numeroFactura"], "002-011-001277805")
        self.assertEqual(fields["numeroAutorizacion"], access_key)
        self.assertEqual(fields["claveAcceso"], access_key)
        self.assertEqual(fields["fechaEmision"], "2026-08-19")
        self.assertEqual(fields["horaEmision"], "11:42:23")
        self.assertEqual(fields["placa"], "PDC5312")
        self.assertEqual(fields["condicionPago"], "CONTADO")
        self.assertEqual(
            fields["formaPago"], "SIN UTILIZACIÓN DEL SISTEMA FINANCIERO"
        )
        self.assertEqual(fields["datosAdicionales"]["tarifaIva"], 15)
        self.assertEqual(fields["datosAdicionales"]["valorTotalSinSubsidio"], 14.47)
        self.assertEqual(fields["datosAdicionales"]["ahorroSubsidio"], 2.87)
        self.assertEqual(products[0]["descripcion"], "EXTRA")
        self.assertEqual(products[0]["cantidad"], 3.578)
        self.assertEqual(products[0]["precioUnitario"], 2.8191)
        self.assertEqual(products[0]["precioUnitarioExacto"], 2.8191)
        self.assertEqual(products[0]["totalLinea"], 10.09)

    def test_campos_ausentes_permanecen_nulos_y_no_se_inventan(self):
        fields, _warnings, _metadata = extraer_campos(
            "Razon Social: PROVEEDOR S.A.\nRUC: 1790012345001\nTOTAL 25.00"
        )
        for field in (
            "numeroAutorizacion",
            "claveAcceso",
            "horaEmision",
            "cliente",
            "identificacionCliente",
            "codigoCliente",
            "placa",
            "formaPago",
        ):
            self.assertIsNone(fields[field])
        self.assertEqual(fields["datosAdicionales"], {})

    def test_cliente_con_cedula_y_tarifa_iva_distinta(self):
        fields, _warnings, _metadata = extraer_campos(
            """
            EMISOR DEMO
            RUC: 1790012345001
            FACTURA 001-001-000000321
            CLIENTE: ANA PEREZ
            CEDULA: 1721146080
            SUBTOTAL 100.00
            IVA 12% 12.00
            TOTAL A PAGAR 112.00
            """
        )
        self.assertEqual(fields["rucProveedor"], "1790012345001")
        self.assertEqual(fields["identificacionCliente"], "1721146080")
        self.assertEqual(fields["datosAdicionales"]["tarifaIva"], 12)
        self.assertIsNone(fields["placa"])
        self.assertIsNone(fields["horaEmision"])

    def test_clave_sri_incompleta_se_conserva_como_candidato_y_advierte(self):
        fields, warnings, _metadata = extraer_campos(
            "CLAVE DE ACCESO: 19082026011792291593001200201100127780512"
        )
        self.assertEqual(fields["claveAcceso"], "19082026011792291593001200201100127780512")
        self.assertTrue(any("49 digitos" in warning for warning in warnings))

    def test_extrae_tabla_clara_y_conserva_orden(self):
        products, warnings, metadata = extraer_productos(
            """
            DESCRIPCION CANTIDAD PRECIO UNITARIO TOTAL
            Monitor 24 pulgadas 2 100.00 200.00
            Teclado mecanico 1 80.00 80.00
            SUBTOTAL 280.00
            """,
            {"subtotal": 280.00, "total": 322.00},
        )
        self.assertEqual([product["descripcion"] for product in products], [
            "Monitor 24 pulgadas",
            "Teclado mecanico",
        ])
        self.assertEqual([product["orden"] for product in products], [1, 2])
        self.assertEqual(metadata["sumaTotalesLinea"], 280.0)
        self.assertEqual(warnings, [])

    def test_extrae_una_linea_poco_estructurada_sin_encabezado(self):
        products, _warnings, _metadata = extraer_productos(
            "SAMSUNG A16 128GB 2 120.00 240.00"
        )
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["descripcion"], "SAMSUNG A16 128GB")
        self.assertEqual(products[0]["cantidad"], 2)
        self.assertIsNone(products[0]["codigo"])

    def test_conserva_descripcion_larga_sin_confundir_numeros_del_modelo(self):
        description = (
            "Equipo SAMSUNG GALAXY A16 128GB color negro con accesorios incluidos"
        )
        products, _warnings, _metadata = extraer_productos(
            f"{description} 3 119,99 359,97"
        )
        self.assertEqual(products[0]["descripcion"], description)
        self.assertEqual(products[0]["precioUnitario"], 119.99)
        self.assertEqual(products[0]["totalLinea"], 359.97)

    def test_extrae_tabla_con_codigo_y_descuento_monetario(self):
        products, _warnings, _metadata = extraer_productos(
            """
            CODIGO DESCRIPCION CANT PRECIO UNITARIO DESCUENTO TOTAL
            MON-24 Monitor profesional 2 100,00 10,00 190,00
            """
        )
        self.assertEqual(products[0]["codigo"], "MON-24")
        self.assertEqual(products[0]["descripcion"], "Monitor profesional")
        self.assertEqual(products[0]["descuento"], 10.0)
        self.assertEqual(products[0]["totalLinea"], 190.0)
        self.assertEqual(products[0]["advertencias"], [])

    def test_descuento_porcentual_no_se_inventa_y_genera_advertencia(self):
        products, _warnings, _metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO DESCUENTO TOTAL
            Silla ergonomica 2 75.00 10% 135.00
            """
        )
        self.assertIsNone(products[0]["descuento"])
        self.assertTrue(any(
            "porcentual" in warning for warning in products[0]["advertencias"]
        ))

    def test_detecta_inconsistencia_aritmetica_sin_autocorregir(self):
        products, _warnings, _metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO TOTAL
            Mouse inalambrico 2 25.00 60.00
            """
        )
        self.assertEqual(products[0]["totalLinea"], 60.0)
        self.assertIn(
            "La cantidad por precio unitario no coincide con el total de linea.",
            products[0]["advertencias"],
        )

    def test_admite_formato_vertical_descripcion_y_valores_en_linea_siguiente(self):
        products, _warnings, _metadata = extraer_productos(
            """
            PRODUCTO
            CANTIDAD
            PRECIO UNITARIO
            TOTAL
            TV SMART 43 PULGADAS
            1 420.00 420.00
            SUBTOTAL 420.00
            """
        )
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["descripcion"], "TV SMART 43 PULGADAS")
        self.assertEqual(products[0]["cantidad"], 1)
        self.assertEqual(products[0]["totalLinea"], 420.0)

    def test_repite_encabezado_sin_convertirlo_en_producto(self):
        products, _warnings, _metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO TOTAL
            Producto pagina uno 1 10.00 10.00
            DESCRIPCION CANT PRECIO TOTAL
            Producto pagina dos 2 20.00 40.00
            """
        )
        self.assertEqual(len(products), 2)
        self.assertNotIn("DESCRIPCION", [item["descripcion"] for item in products])

    def test_excluye_lineas_administrativas_y_totales(self):
        products, _warnings, _metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO TOTAL
            Cable HDMI 1 8.00 8.00
            SUBTOTAL 8.00
            IVA 1.20
            TOTAL A PAGAR 9.20
            FORMA DE PAGO EFECTIVO
            """
        )
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["descripcion"], "Cable HDMI")

    def test_fila_parcial_en_tabla_conserva_nulos_y_pide_revision(self):
        products, _warnings, _metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO TOTAL
            Servicio de instalacion especial
            SUBTOTAL 100.00
            """
        )
        self.assertEqual(len(products), 1)
        self.assertIsNone(products[0]["cantidad"])
        self.assertIsNone(products[0]["precioUnitario"])
        self.assertIsNone(products[0]["totalLinea"])
        self.assertTrue(products[0]["advertencias"])

    def test_fuera_de_tabla_omite_ruido_y_no_inventa_producto(self):
        products, warnings, metadata = extraer_productos(
            "RUC 1790012345001\nAutorizacion 123456789\nGracias por su compra"
        )
        self.assertEqual(products, [])
        self.assertIsNone(metadata["sumaTotalesLinea"])
        self.assertTrue(any("No se detectaron" in warning for warning in warnings))

    def test_codigo_solo_se_extrae_con_contexto_explicito(self):
        without_code, _warnings, _metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO TOTAL
            ABC123 Adaptador USB 1 12.00 12.00
            """
        )
        explicit_code, _warnings, _metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO TOTAL
            COD: ABC123 Adaptador USB 1 12.00 12.00
            """
        )
        self.assertIsNone(without_code[0]["codigo"])
        self.assertEqual(explicit_code[0]["codigo"], "ABC123")

    def test_compara_suma_global_con_subtotal_y_no_con_iva(self):
        products, warnings, metadata = extraer_productos(
            """
            DESCRIPCION CANT PRECIO TOTAL
            Equipo A 1 100.00 100.00
            Equipo B 1 50.00 50.00
            """,
            {"subtotal": 160.00, "total": 184.00},
        )
        self.assertEqual(len(products), 2)
        self.assertEqual(metadata["diferenciaSubtotal"], 10.0)
        self.assertIsNone(metadata["diferenciaTotal"])
        self.assertIn(
            "La suma de productos no coincide con el subtotal de la factura.",
            warnings,
        )

    def test_preprocesamiento_conservador_advierte_bajo_contraste(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "prepared.png"
            prepared, warnings = _prepare_image(
                Image.new("RGB", (900, 1200), "#dddddd"),
                output,
            )
            self.assertTrue(output.exists())
            self.assertGreaterEqual(min(prepared.size), 1200)
            self.assertTrue(any("bajo contraste" in warning for warning in warnings))

    def test_documento_largo_conserva_todas_las_lineas_aunque_no_se_clasifiquen(self):
        known = [
            "PROVEEDOR DEMO CIA LTDA",
            "RUC: 1790012345001",
            "FACTURA 001-002-000012345",
            "FECHA: 19/08/2026",
            "CANT DESCRIPCION PRECIO TOTAL",
            "1 PRODUCTO DEMO 10.00 10.00",
            "TOTAL 11.50",
        ]
        unknown = [f"LINEA LIBRE {index:02d} CONTENIDO SIN CLASIFICAR" for index in range(1, 64)]
        complete_text = "\n".join(known + unknown)
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "long.png"
            Image.new("RGB", (1200, 1600), "white").save(source)
            with patch(
                "facturas_fisicas_ocr._ocr_image",
                return_value=(complete_text, 88.0, [], "5.5.0"),
            ):
                result = procesar_documento(source, "image/png", "png")

        self.assertEqual(len(complete_text.splitlines()), 70)
        self.assertEqual(result["texto"].splitlines(), complete_text.splitlines())
        self.assertEqual(result["ocr"]["textoCompleto"], complete_text)
        self.assertEqual(result["metadata"]["totalLineas"], 70)
        self.assertGreater(result["metadata"]["totalLineasNoClasificadas"], 0)
        self.assertIn("LINEA LIBRE 63 CONTENIDO SIN CLASIFICAR", result["texto"])

    def test_no_pierde_texto_operativo_aunque_el_parser_no_lo_use(self):
        complete_text = (
            "FACTURA 001-002-000012345\n"
            "DESPACHADOR: JUAN\n"
            "MANGUERA: 04\n"
            "PIE SIN REGLA   CONSERVA ESPACIOS"
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "operational.png"
            Image.new("RGB", (1200, 1600), "white").save(source)
            with patch(
                "facturas_fisicas_ocr._ocr_image",
                return_value=(complete_text, 80.0, [], "5.5.0"),
            ):
                result = procesar_documento(source, "image/png", "png")

        self.assertIn("DESPACHADOR: JUAN", result["texto"])
        self.assertIn("MANGUERA: 04", result["texto"])
        self.assertIn("PIE SIN REGLA   CONSERVA ESPACIOS", result["texto"])

    def test_fallo_del_parser_no_convierte_ocr_con_texto_en_error(self):
        complete_text = "TEXTO COMPLETO RECONOCIDO\nLINEA QUE DEBE SOBREVIVIR"
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "parser-failure.png"
            Image.new("RGB", (1200, 1600), "white").save(source)
            with patch(
                "facturas_fisicas_ocr._ocr_image",
                return_value=(complete_text, 75.0, [], "5.5.0"),
            ), patch(
                "facturas_fisicas_ocr.extraer_campos",
                side_effect=RuntimeError("parser test"),
            ):
                result = procesar_documento(source, "image/png", "png")

        self.assertTrue(result["ok"])
        self.assertEqual(result["texto"], complete_text)
        self.assertIsNone(result["campos"]["proveedor"])
        self.assertTrue(any("se conservo completo" in warning for warning in result["advertencias"]))

    def test_salida_ocr_vacia_es_error_tecnico(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "empty.png"
            Image.new("RGB", (1200, 1600), "white").save(source)
            with patch(
                "facturas_fisicas_ocr._ocr_image",
                return_value=(" \n ", None, [], "5.5.0"),
            ):
                with self.assertRaises(OcrEmptyOutputError):
                    procesar_documento(source, "image/png", "png")

    def test_jpg_png_y_webp_usan_copia_temporal_sin_cambiar_original(self):
        sample_text = "RUC: 1790012345001\nFACTURA 001-002-000012345\nTOTAL 115.00"
        formats = [
            ("jpg", "JPEG", "image/jpeg"),
            ("png", "PNG", "image/png"),
            ("webp", "WEBP", "image/webp"),
        ]
        for extension, image_format, mime in formats:
            with self.subTest(extension=extension), tempfile.TemporaryDirectory() as temp_dir:
                source = Path(temp_dir) / f"invoice.{extension}"
                Image.new("RGB", (1200, 1600), "white").save(source, format=image_format)
                original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
                temporary_paths = []

                def fake_ocr(image, output_path):
                    temporary_paths.append(output_path)
                    _prepare_image(image, output_path)
                    return sample_text, 90.0, [], "5.5.0"

                with patch("facturas_fisicas_ocr._ocr_image", side_effect=fake_ocr):
                    result = procesar_documento(source, mime, extension)

                self.assertTrue(result["ok"])
                self.assertEqual(result["metadata"]["motor"], "tesseract")
                self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), original_hash)
                self.assertTrue(temporary_paths)
                self.assertTrue(all(not path.exists() for path in temporary_paths))

    def test_pdf_con_texto_evitar_ocr(self):
        page = MagicMock()
        page.extract_text.return_value = (
            "Razon Social: EMPRESA XYZ S.A.\nRUC: 1790012345001\n"
            "FACTURA 001-002-000012345\nTOTAL 115.00"
        )
        pdf_context = MagicMock()
        pdf_context.__enter__.return_value.pages = [page]
        pdfium_document = MagicMock()

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "invoice.pdf"
            source.write_bytes(b"pdf-test")
            with patch("pdfplumber.open", return_value=pdf_context), patch(
                "pypdfium2.PdfDocument", pdfium_document
            ):
                result = procesar_documento(source, "application/pdf", "pdf")

        self.assertEqual(result["metadata"]["motor"], "pdfplumber")
        self.assertEqual(result["metadata"]["modosPorPagina"], ["texto_pdf"])
        pdfium_document.assert_not_called()

    def test_pdf_multipagina_extrae_productos_y_omite_encabezado_repetido(self):
        first_page = MagicMock()
        first_page.extract_text.return_value = (
            "Razon Social: EMPRESA XYZ S.A.\nRUC: 1790012345001\n"
            "FACTURA 001-002-000012345\nDESCRIPCION CANT PRECIO TOTAL\n"
            "Monitor profesional 1 100.00 100.00"
        )
        second_page = MagicMock()
        second_page.extract_text.return_value = (
            "EMPRESA XYZ S.A. CONTINUACION DE FACTURA\n"
            "DESCRIPCION CANT PRECIO TOTAL\nTeclado mecanico 2 40.00 80.00\n"
            "SUBTOTAL 180.00\nIVA 27.00\nTOTAL 207.00"
        )
        pdf_context = MagicMock()
        pdf_context.__enter__.return_value.pages = [first_page, second_page]
        pdfium_document = MagicMock()

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "multipage.pdf"
            source.write_bytes(b"pdf-multipage-test")
            with patch("pdfplumber.open", return_value=pdf_context), patch(
                "pypdfium2.PdfDocument", pdfium_document
            ):
                result = procesar_documento(source, "application/pdf", "pdf")

        self.assertEqual(result["metadata"]["paginas"], 2)
        self.assertEqual(result["metadata"]["modosPorPagina"], ["texto_pdf", "texto_pdf"])
        self.assertEqual(
            [product["descripcion"] for product in result["productos"]],
            ["Monitor profesional", "Teclado mecanico"],
        )
        self.assertEqual([product["orden"] for product in result["productos"]], [1, 2])
        pdfium_document.assert_not_called()

    def test_pdf_escaneado_renderiza_y_limpia_temporal(self):
        page_text = MagicMock()
        page_text.extract_text.return_value = ""
        pdf_context = MagicMock()
        pdf_context.__enter__.return_value.pages = [page_text]
        rendered_page = MagicMock()
        rendered_page.render.return_value.to_pil.return_value = Image.new(
            "RGB", (1200, 1600), "white"
        )
        pdf_document = MagicMock()
        pdf_document.__getitem__.return_value = rendered_page
        temporary_paths = []

        def fake_ocr(_image, output_path):
            temporary_paths.append(output_path)
            output_path.write_bytes(b"temporary")
            return "FACTURA 001-002-000012345\nTOTAL 115.00", 82.0, [], "5.5.0"

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "scan.pdf"
            source.write_bytes(b"scanned-pdf-test")
            original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            with patch("pdfplumber.open", return_value=pdf_context), patch(
                "pypdfium2.PdfDocument", return_value=pdf_document
            ), patch("facturas_fisicas_ocr._ocr_image", side_effect=fake_ocr):
                result = procesar_documento(source, "application/pdf", "pdf")
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), original_hash)

        self.assertEqual(result["metadata"]["motor"], "tesseract")
        self.assertEqual(result["metadata"]["modosPorPagina"], ["ocr"])
        self.assertTrue(temporary_paths)
        self.assertTrue(all(not path.exists() for path in temporary_paths))
        rendered_page.close.assert_called_once()
        pdf_document.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
