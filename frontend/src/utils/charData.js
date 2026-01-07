export const mapToChart = (obj) => ({
  labels: Object.keys(obj),
  data: Object.values(obj),
});
