import argparse
import json
import os
import sys

from processor_celulares import process_celulares
from processor_tvs import process_tvs


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Procesador de PDFs RVE")
    parser.add_argument("--tipo", required=True, choices=["CELULAR", "TV"])
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    try:
        if args.tipo == "CELULAR":
            payload = process_celulares(args.input)
        else:
            payload = process_tvs(args.input)

        write_json(args.output, payload)
        print(
            json.dumps(
                {
                    "ok": payload["ok"],
                    "tipo": payload["tipo"],
                    "total_registros": payload["total_registros"],
                    "validos": len(payload["registros_validos"]),
                    "errores": len(payload["errores"]),
                },
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as exc:
        payload = {
            "ok": False,
            "tipo": args.tipo,
            "total_registros": 0,
            "registros_validos": [],
            "errores": [{"motivo": "ERROR_PROCESADOR", "detalle": str(exc)}],
        }
        write_json(args.output, payload)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
