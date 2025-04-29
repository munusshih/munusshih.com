export const toTitleCase = (str) => {
  return str.toLowerCase().replace(/\b(\w)/g, (match) => match.toUpperCase()); // Capitalizes the first letter of each word
};
