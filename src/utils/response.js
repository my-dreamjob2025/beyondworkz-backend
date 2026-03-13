export const sendResponse = (res, status, success, data) =>
  res.status(status).json({ success, ...data });
