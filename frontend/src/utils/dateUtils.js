export const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-CA");
};

export const getHoyLocal = () => formatDate(new Date());