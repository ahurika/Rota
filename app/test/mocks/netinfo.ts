export const netInfoMock = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
};

export const useNetInfo = () => netInfoMock;

export const addEventListener = (callback: (state: any) => void) => {
  callback(netInfoMock);
  return () => {};
};

export const fetch = async () => netInfoMock;

export default {
  useNetInfo,
  addEventListener,
  fetch,
};
