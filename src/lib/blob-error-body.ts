import axios from "axios";

const parseBody = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Requests made with `responseType: "blob"` (exports, downloads) receive their
 * error body as a Blob too. Decodes it in place so that the WebAdmin
 * `message` / `details` can be shown instead of the generic Axios message.
 */
export const decodeBlobErrorBody = async (error: unknown): Promise<never> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = parseBody(await error.response.data.text());
    } catch {
      // keep the undecodable Blob: the generic Axios message will be shown
    }
  }
  return Promise.reject(error);
};
