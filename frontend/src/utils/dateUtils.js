export const getHoyLocal = () => {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Guayaquil"
  });
};