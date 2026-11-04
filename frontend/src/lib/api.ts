import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Normalize error message
    const message =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.message ??
      "Terjadi kesalahan";
    return Promise.reject({ ...error, normalizedMessage: message });
  },
);

export function getErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "normalizedMessage" in err) {
    return String((err as { normalizedMessage: string }).normalizedMessage);
  }
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message;
  }
  return "Terjadi kesalahan";
}
