import { useMemo } from "react";
import { Search } from "lucide-react";
import PropTypes from "prop-types";

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const defaultOptionId = (option) => option.usuarioId ?? option.id;
const defaultOptionLabel = (option) => option.nombre || "";
const defaultOptionDetail = (option) =>
  option.cargoComision || option.cargo || option.rol || "";

export default function CollaboratorSearchInput({
  label = "Colaborador",
  options = [],
  searchValue,
  selectedId,
  open,
  placeholder = "Seleccione un colaborador",
  disabled = false,
  getOptionId = defaultOptionId,
  getOptionLabel = defaultOptionLabel,
  getOptionDetail = defaultOptionDetail,
  onOpenChange,
  onSearchChange,
  onShowAll,
  onSelect,
}) {
  const matchingOptions = useMemo(() => {
    const search = normalizeSearchText(searchValue);
    if (!search) return options;

    return options.filter((option) =>
      normalizeSearchText(
        [getOptionLabel(option), getOptionDetail(option)].filter(Boolean).join(" "),
      ).includes(search),
    );
  }, [getOptionDetail, getOptionLabel, options, searchValue]);

  return (
    <div
      className="relative text-sm font-medium text-slate-700"
      onBlur={() => window.setTimeout(() => onOpenChange(false), 120)}
    >
      {label}
      <div className={`mt-1 flex overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 ${disabled ? "opacity-60" : ""}`}>
        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={() => onOpenChange(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="min-w-0 flex-1 px-3 py-2 text-sm font-normal text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onShowAll}
          disabled={disabled}
          title="Ver colaboradores"
          aria-label="Ver colaboradores"
          className="inline-flex w-11 items-center justify-center border-l border-slate-300 text-slate-600 transition hover:bg-slate-50 hover:text-emerald-700 disabled:cursor-not-allowed"
        >
          <Search size={17} />
        </button>
      </div>
      {open && !disabled ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matchingOptions.length ? (
            matchingOptions.map((option) => {
              const id = String(getOptionId(option));
              const detail = getOptionDetail(option);
              return (
                <button
                  type="button"
                  key={id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                  className={`flex w-full flex-col px-3 py-2 text-left text-sm transition hover:bg-emerald-50 ${
                    String(selectedId) === id
                      ? "bg-emerald-100 text-emerald-900"
                      : "text-slate-800"
                  }`}
                >
                  <span className="font-semibold">{getOptionLabel(option)}</span>
                  {detail ? (
                    <span className="text-[11px] font-normal text-slate-500">
                      {detail}
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm font-normal text-slate-500">
              Sin coincidencias
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

CollaboratorSearchInput.propTypes = {
  label: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.object),
  searchValue: PropTypes.string.isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  open: PropTypes.bool.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  getOptionId: PropTypes.func,
  getOptionLabel: PropTypes.func,
  getOptionDetail: PropTypes.func,
  onOpenChange: PropTypes.func.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onShowAll: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};
