export const Platform = {
  OS: 'web',
  select: (obj: any) => obj.web || obj.default,
};

export const StyleSheet = {
  create: (styles: any) => styles,
};

export const Alert = {
  alert: () => {},
};

export default {
  Platform,
  StyleSheet,
  Alert,
};
