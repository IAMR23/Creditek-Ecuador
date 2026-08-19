import unittest
from pathlib import Path
import sys
import hashlib
import tempfile
from unittest.mock import MagicMock, patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from facturas_fisicas_ocr import (
    _prepare_image,
    extraer_campos,
    extraer_productos,
    normalizar_monto,
    procesar_documento,
)


class FacturasFisicasOcrParserTest(unittest.TestCase):
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
